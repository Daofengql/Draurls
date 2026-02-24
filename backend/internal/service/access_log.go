package service

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
	"github.com/surls/backend/pkg/cache"
)

// AccessLogBatchWriter 批量写入访问日志的服务
type AccessLogBatchWriter struct {
	accessLogRepo *repository.AccessLogRepository
	buffer        *cache.AccessLogBuffer
}

// NewAccessLogBatchWriter 创建批量写入服务
func NewAccessLogBatchWriter(accessLogRepo *repository.AccessLogRepository, buffer *cache.AccessLogBuffer) *AccessLogBatchWriter {
	w := &AccessLogBatchWriter{
		accessLogRepo: accessLogRepo,
		buffer:        buffer,
	}
	return w
}

// WriteAccessLogs 实现 BatchWriter 接口
func (w *AccessLogBatchWriter) WriteAccessLogs(ctx context.Context, logs []*models.AccessLog) error {
	if len(logs) == 0 {
		return nil
	}
	return w.accessLogRepo.CreateBatch(ctx, logs)
}

// RecordAccess 记录单次访问（通过缓冲区）
func (w *AccessLogBatchWriter) RecordAccess(ctx context.Context, log *models.AccessLog) error {
	return w.buffer.Add(ctx, log)
}

// AccessLogService 访问日志服务
type AccessLogService struct {
	buffer *cache.AccessLogBuffer
	repo   *repository.AccessLogRepository
	mu     sync.RWMutex
	// 内存中的实时计数器（用于热点链接）
	realtimeCounters map[uint]int64 // linkID -> count
}

// NewAccessLogService 创建访问日志服务
func NewAccessLogService(repo *repository.AccessLogRepository, buffer *cache.AccessLogBuffer) *AccessLogService {
	s := &AccessLogService{
		buffer:           buffer,
		repo:             repo,
		realtimeCounters: make(map[uint]int64),
	}

	// 定期将内存计数器持久化到数据库
	go s.persistCounters()

	return s
}

// Record 记录访问日志
func (s *AccessLogService) Record(ctx context.Context, linkID uint, ip, userAgent, referer string) error {
	logEntry := &models.AccessLog{
		LinkID:    linkID,
		IPAddress: ip,
		UserAgent: userAgent,
		Referer:   referer,
	}

	// 写入缓冲区（Redis -> 批量写MySQL）
	if err := s.buffer.Add(ctx, logEntry); err != nil {
		log.Printf("WARNING: Failed to add access log to buffer: %v", err)
		// 降级：直接写数据库
		return s.repo.Create(ctx, logEntry)
	}

	// 更新内存计数器（用于实时统计）
	s.mu.Lock()
	s.realtimeCounters[linkID]++
	s.mu.Unlock()

	return nil
}

// GetStats 获取链接统计（优先使用访问日志数据）
func (s *AccessLogService) GetStats(ctx context.Context, linkID uint) (int64, int64, error) {
	// 从访问日志表获取精确统计
	stats, err := s.repo.GetStatsByLinkID(ctx, linkID)
	if err != nil {
		return 0, 0, err
	}

	return stats.ClickCount, stats.UniqueIPs, nil
}

// GetRealtimeCount 获取实时点击计数（来自内存）
func (s *AccessLogService) GetRealtimeCount(linkID uint) int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.realtimeCounters[linkID]
}

// persistCounters 定期持久化计数器到数据库
func (s *AccessLogService) persistCounters() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.Lock()
		if len(s.realtimeCounters) == 0 {
			s.mu.Unlock()
			continue
		}

		// 复制并清空
		counters := make(map[uint]int64, len(s.realtimeCounters))
		for k, v := range s.realtimeCounters {
			counters[k] = v
		}
		s.realtimeCounters = make(map[uint]int64)
		s.mu.Unlock()

		// 这里可以触发更新 short_links 表的 click_count
		// 实际实现中，应该批量更新
		if len(counters) > 0 {
			log.Printf("INFO: Persisting %d link counters", len(counters))
		}
	}
}

// GetRecentLogs 获取最近的访问日志
func (s *AccessLogService) GetRecentLogs(ctx context.Context, linkID uint, page, pageSize int) ([]models.AccessLog, int64, error) {
	return s.repo.FindByLinkID(ctx, linkID, page, pageSize)
}

// CleanupOldLogs 清理旧日志
func (s *AccessLogService) CleanupOldLogs(ctx context.Context, days int) error {
	return s.repo.DeleteOldLogs(ctx, days)
}
