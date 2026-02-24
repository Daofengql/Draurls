package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/surls/backend/internal/models"
)

// AccessLogRepository 访问日志数据访问层
type AccessLogRepository struct {
	db *gorm.DB
}

// NewAccessLogRepository 创建访问日志仓库
func NewAccessLogRepository(db *gorm.DB) *AccessLogRepository {
	return &AccessLogRepository{db: db}
}

// Create 创建访问日志
func (r *AccessLogRepository) Create(ctx context.Context, log *models.AccessLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// CreateBatch 批量创建访问日志（异步写入）
func (r *AccessLogRepository) CreateBatch(ctx context.Context, logs []*models.AccessLog) error {
	if len(logs) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(logs, 100).Error
}

// FindByLinkID 获取链接的访问日志
func (r *AccessLogRepository) FindByLinkID(ctx context.Context, linkID uint, page, pageSize int) ([]models.AccessLog, int64, error) {
	var logs []models.AccessLog
	var total int64

	query := r.db.WithContext(ctx).Where("link_id = ?", linkID)

	err := query.Model(&models.AccessLog{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// CountByLinkID 统计链接点击数
func (r *AccessLogRepository) CountByLinkID(ctx context.Context, linkID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.AccessLog{}).
		Where("link_id = ?", linkID).
		Count(&count).Error
	return count, err
}

// DeleteOldLogs 删除旧日志（定期清理任务）
func (r *AccessLogRepository) DeleteOldLogs(ctx context.Context, days int) error {
	return r.db.WithContext(ctx).
		Where("created_at < DATE_SUB(NOW(), INTERVAL ? DAY)", days).
		Delete(&models.AccessLog{}).Error
}

// GetLinkStats 获取链接统计
type LinkStats struct {
	ClickCount  int64   `json:"click_count"`
	UniqueIPs   int64   `json:"unique_ips"`
}

// GetStatsByLinkID 获取链接统计数据
func (r *AccessLogRepository) GetStatsByLinkID(ctx context.Context, linkID uint) (*LinkStats, error) {
	var stats LinkStats

	// 总点击数
	err := r.db.WithContext(ctx).Model(&models.AccessLog{}).
		Where("link_id = ?", linkID).
		Count(&stats.ClickCount).Error
	if err != nil {
		return nil, err
	}

	// 独立IP数
	err = r.db.WithContext(ctx).Model(&models.AccessLog{}).
		Where("link_id = ?", linkID).
		Distinct("ip_address").
		Count(&stats.UniqueIPs).Error
	if err != nil {
		return nil, err
	}

	return &stats, nil
}
