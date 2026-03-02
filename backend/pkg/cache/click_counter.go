package cache

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// DBUpdateFunc 数据库更新函数类型
type DBUpdateFunc func(map[uint]int64) error

// ClickCounter 点击计数器（使用Redis INCR + 异步持久化）
type ClickCounter struct {
	redis         *redis.Client
	buffer        map[uint]int64 // linkID -> count
	bufferMu      sync.Mutex
	flushTicker   *time.Ticker
	flushInterval time.Duration
	stopChan      chan struct{}
	dbUpdateFn    DBUpdateFunc // 数据库更新函数
}

// NewClickCounter 创建点击计数器
func NewClickCounter(redisClient *redis.Client) *ClickCounter {
	counter := &ClickCounter{
		redis:         redisClient,
		buffer:        make(map[uint]int64),
		flushInterval: 30 * time.Second, // 每30秒持久化一次
		stopChan:      make(chan struct{}),
	}
	counter.flushTicker = time.NewTicker(counter.flushInterval)

	// 启动后台持久化协程
	go counter.flushLoop()

	return counter
}

// SetDBUpdateFunc 设置数据库更新函数
func (c *ClickCounter) SetDBUpdateFunc(fn DBUpdateFunc) {
	c.bufferMu.Lock()
	c.dbUpdateFn = fn
	c.bufferMu.Unlock()
}

// Increment 增加点击计数（线程安全）
func (c *ClickCounter) Increment(ctx context.Context, linkID uint) error {
	// 1. 立即更新 Redis（用于实时统计）
	redisKey := fmt.Sprintf("clicks:%d", linkID)
	if err := c.redis.Incr(ctx, redisKey).Err(); err != nil {
		return err
	}
	// 设置过期时间（7天）
	c.redis.Expire(ctx, redisKey, 7*24*time.Hour)

	// 2. 更新内存缓冲区（用于批量持久化到数据库）
	c.bufferMu.Lock()
	c.buffer[linkID]++
	c.bufferMu.Unlock()

	return nil
}

// GetCount 获取当前点击计数（Redis + 内存缓冲区）
func (c *ClickCounter) GetCount(ctx context.Context, linkID uint) (int64, error) {
	redisKey := fmt.Sprintf("clicks:%d", linkID)

	// 获取 Redis 中的计数
	redisCount, err := c.redis.Get(ctx, redisKey).Int64()
	if err != nil && err != redis.Nil {
		return 0, err
	}

	// 加上内存缓冲区中未持久化的计数
	c.bufferMu.Lock()
	bufferCount := c.buffer[linkID]
	c.bufferMu.Unlock()

	return redisCount + bufferCount, nil
}

// Flush 立即刷新缓冲区到数据库
// 注意：这个方法需要传入一个回调函数来实际执行数据库更新
func (c *ClickCounter) Flush(ctx context.Context, updateFn func(map[uint]int64) error) error {
	c.bufferMu.Lock()
	if len(c.buffer) == 0 {
		c.bufferMu.Unlock()
		return nil
	}

	// 复制并清空缓冲区
	flushData := make(map[uint]int64, len(c.buffer))
	for k, v := range c.buffer {
		flushData[k] = v
	}
	c.buffer = make(map[uint]int64)
	c.bufferMu.Unlock()

	// 调用回调函数执行数据库更新
	if updateFn != nil {
		if err := updateFn(flushData); err != nil {
			// 如果失败，把数据放回去
			c.bufferMu.Lock()
			for k, v := range flushData {
				c.buffer[k] += v
			}
			c.bufferMu.Unlock()
			return err
		}
	}

	return nil
}

// flushLoop 后台循环，定期刷新缓冲区
func (c *ClickCounter) flushLoop() {
	for {
		select {
		case <-c.flushTicker.C:
			// 触发刷新到数据库
			c.flushToDB()
		case <-c.stopChan:
			// 停止前最后刷新一次
			c.flushToDB()
			return
		}
	}
}

// flushToDB 刷新缓冲区到数据库
func (c *ClickCounter) flushToDB() {
	c.bufferMu.Lock()
	if len(c.buffer) == 0 {
		c.bufferMu.Unlock()
		return
	}

	// 获取数据库更新函数
	updateFn := c.dbUpdateFn
	if updateFn == nil {
		// 没有设置更新函数，保留数据不清空
		c.bufferMu.Unlock()
		return
	}

	// 复制并清空缓冲区
	flushData := make(map[uint]int64, len(c.buffer))
	for k, v := range c.buffer {
		flushData[k] = v
	}
	c.buffer = make(map[uint]int64)
	c.bufferMu.Unlock()

	// 调用数据库更新函数（在锁外执行）
	if err := updateFn(flushData); err != nil {
		// 如果失败，把数据放回去
		c.bufferMu.Lock()
		for k, v := range flushData {
			c.buffer[k] += v
		}
		c.bufferMu.Unlock()
		// 记录错误（使用简单的日志，避免依赖外部日志库）
		fmt.Printf("ERROR: Failed to flush click counts to DB: %v\n", err)
	}
}

// Stop 停止计数器
func (c *ClickCounter) Stop() {
	c.flushTicker.Stop()
	close(c.stopChan)
}
