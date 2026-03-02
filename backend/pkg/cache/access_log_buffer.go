package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/models"
)

// AccessLogBuffer 访问日志缓冲区（先写Redis，批量写MySQL）
type AccessLogBuffer struct {
	redis         *redis.Client
	batchWriter   BatchWriter
	batchSize     int
	flushInterval time.Duration
	streamKey     string
	stopChan      chan struct{}
	wg            sync.WaitGroup
	mu            sync.Mutex
	stats         BufferStats
}

// BufferStats 缓冲区统计
type BufferStats struct {
	TotalAdded   int64 `json:"total_added"`
	TotalFlushed int64 `json:"total_flushed"`
	TotalFailed  int64 `json:"total_failed"`
	QueueSize    int   `json:"queue_size"`
}

// BatchWriter 批量写入接口
type BatchWriter interface {
	WriteAccessLogs(ctx context.Context, logs []*models.AccessLog) error
}

// NewAccessLogBuffer 创建访问日志缓冲区
func NewAccessLogBuffer(redis *redis.Client, writer BatchWriter) *AccessLogBuffer {
	b := &AccessLogBuffer{
		redis:         redis,
		batchWriter:   writer,
		batchSize:     100,              // 每100条批量写入
		flushInterval: 5 * time.Second,  // 或者每5秒写入一次
		streamKey:     "access_log_stream",
		stopChan:      make(chan struct{}),
	}

	// 启动后台刷写协程
	b.wg.Add(1)
	go b.flushLoop()

	// 启动恢复协程（处理Redis中残留的数据）
	b.wg.Add(1)
	go b.recoverLoop()

	return b
}

// Add 添加访问日志
func (b *AccessLogBuffer) Add(ctx context.Context, log *models.AccessLog) error {
	// 不要设置 ID，让数据库自增生成主键
	// 如果 ID 不为 0，将其清零以避免主键冲突
	if log.ID != 0 {
		log.ID = 0
	}

	data, err := json.Marshal(log)
	if err != nil {
		return fmt.Errorf("marshal log failed: %w", err)
	}

	// 写入 Redis Stream，使用 "*" 让 Redis 自动生成符合规范的 ID
	// Redis Stream ID 格式: <millisecondsTime>-<sequenceNumber>
	// 直接使用 UnixNano 作为 ID 会导致格式错误
	err = b.redis.XAdd(ctx, &redis.XAddArgs{
		Stream: b.streamKey,
		ID:     "*", // 让 Redis 自动生成符合规范的 ID
		Values: map[string]interface{}{"data": data},
	}).Err()

	if err != nil {
		b.mu.Lock()
		b.stats.TotalFailed++
		b.mu.Unlock()
		return fmt.Errorf("redis xadd failed: %w", err)
	}

	// 获取 Stream 长度
	length, err := b.redis.XLen(ctx, b.streamKey).Result()
	if err == nil {
		b.mu.Lock()
		b.stats.TotalAdded++
		b.stats.QueueSize = int(length)
		b.mu.Unlock()

		// 达到批量大小时触发立即刷写
		if length >= int64(b.batchSize) {
			b.triggerFlush()
		}
	}

	return nil
}

// triggerFlush 触发立即刷写
func (b *AccessLogBuffer) triggerFlush() {
	// 非阻塞触发
	select {
	case b.stopChan <- struct{}{}:
	default:
	}
}

// flushLoop 定期刷写循环
func (b *AccessLogBuffer) flushLoop() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			b.flush(context.Background())
		case <-b.stopChan:
			return
		}
	}
}

// recoverLoop 恢复循环（处理Redis中残留的数据）
func (b *AccessLogBuffer) recoverLoop() {
	defer b.wg.Done()

	// 启动后延迟5秒执行一次恢复
	time.Sleep(5 * time.Second)
	b.flush(context.Background())
}

// flush 刷写数据到数据库
func (b *AccessLogBuffer) flush(ctx context.Context) error {
	// 从 Redis Stream 读取数据
	result, err := b.redis.XRead(ctx, &redis.XReadArgs{
		Streams: []string{b.streamKey, "0"},
		Count:   int64(b.batchSize),
		Block:   0,
	}).Result()

	if err != nil && err != redis.Nil {
		log.Printf("ERROR: Failed to read from stream: %v", err)
		return err
	}

	if len(result) == 0 || len(result[0].Messages) == 0 {
		return nil
	}

	// 解析日志
	logs := make([]*models.AccessLog, 0, len(result[0].Messages))
	ids := make([]string, 0, len(result[0].Messages))

	for _, msg := range result[0].Messages {
		data, ok := msg.Values["data"].(string)
		if !ok {
			continue
		}

		var logEntry models.AccessLog
		if err := json.Unmarshal([]byte(data), &logEntry); err != nil {
			log.Printf("ERROR: Failed to unmarshal log: %v", err)
			continue
		}

		logs = append(logs, &logEntry)
		ids = append(ids, msg.ID)
	}

	if len(logs) == 0 {
		return nil
	}

	// 检查 batchWriter 是否可用
	if b.batchWriter == nil {
		log.Printf("ERROR: batchWriter is nil, cannot flush logs")
		return nil
	}

	// 批量写入数据库
	if err := b.batchWriter.WriteAccessLogs(ctx, logs); err != nil {
		log.Printf("ERROR: Failed to write logs to database: %v", err)
		b.mu.Lock()
		b.stats.TotalFailed += int64(len(logs))
		b.mu.Unlock()
		return err
	}

	// 写入成功后，从 Redis Stream 中删除已处理的记录
	if len(ids) > 0 {
		b.redis.XDel(ctx, b.streamKey, ids...)
	}

	b.mu.Lock()
	b.stats.TotalFlushed += int64(len(logs))
	b.stats.QueueSize -= len(ids)
	b.mu.Unlock()

	return nil
}

// SetBatchWriter 设置批量写入器
func (b *AccessLogBuffer) SetBatchWriter(writer BatchWriter) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.batchWriter = writer
}

// Stop 停止缓冲区
func (b *AccessLogBuffer) Stop(ctx context.Context) error {
	close(b.stopChan)

	// 等待刷写循环结束
	done := make(chan struct{})
	go func() {
		b.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// 最后刷写一次
		b.flush(ctx)
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(10 * time.Second):
		log.Println("WARNING: AccessLogBuffer shutdown timeout")
	}

	return nil
}

// GetStats 获取统计信息
func (b *AccessLogBuffer) GetStats() BufferStats {
	b.mu.Lock()
	defer b.mu.Unlock()

	// 获取实际队列大小
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if length, err := b.redis.XLen(ctx, b.streamKey).Result(); err == nil {
		b.stats.QueueSize = int(length)
	}

	return b.stats
}
