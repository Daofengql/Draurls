package repository

import (
	"context"

	"github.com/surls/backend/internal/models"
	"gorm.io/gorm"
)

// AuditLogRepository 审计日志仓储
type AuditLogRepository struct {
	db *gorm.DB
}

// NewAuditLogRepository 创建审计日志仓储
func NewAuditLogRepository(db *gorm.DB) *AuditLogRepository {
	return &AuditLogRepository{db: db}
}

// Create 创建审计日志
func (r *AuditLogRepository) Create(ctx context.Context, log *models.AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// List 查询审计日志列表
func (r *AuditLogRepository) List(ctx context.Context, page, pageSize int, actorID *uint, action string) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&models.AuditLog{})

	// 筛选条件
	if actorID != nil {
		query = query.Where("actor_id = ?", *actorID)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}

	// 计数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&logs).Error

	return logs, total, err
}
