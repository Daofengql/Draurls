package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
)

// APIKeyRepository API密钥数据访问层
type APIKeyRepository struct {
	db *gorm.DB
}

// NewAPIKeyRepository 创建API密钥仓库
func NewAPIKeyRepository(db *gorm.DB) *APIKeyRepository {
	return &APIKeyRepository{db: db}
}

// Create 创建API密钥
func (r *APIKeyRepository) Create(ctx context.Context, key *models.APIKey) error {
	return r.db.WithContext(ctx).Create(key).Error
}

// FindByKey 根据密钥查找
func (r *APIKeyRepository) FindByKey(ctx context.Context, key string) (*models.APIKey, error) {
	var apiKey models.APIKey
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("key = ? AND status = ?", key, models.APIKeyStatusActive).
		First(&apiKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrInvalidAPIKey
		}
		return nil, err
	}

	// 检查是否过期
	now := time.Now()
	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(now) {
		return nil, apperrors.ErrAPIKeyExpired
	}

	return &apiKey, nil
}

// FindByID 根据ID查找
func (r *APIKeyRepository) FindByID(ctx context.Context, id uint) (*models.APIKey, error) {
	var apiKey models.APIKey
	err := r.db.WithContext(ctx).First(&apiKey, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &apiKey, nil
}

// ListByUser 获取用户的API密钥列表
func (r *APIKeyRepository) ListByUser(ctx context.Context, userID uint) ([]models.APIKey, error) {
	var keys []models.APIKey
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&keys).Error
	return keys, err
}

// Update 更新API密钥
func (r *APIKeyRepository) Update(ctx context.Context, key *models.APIKey) error {
	return r.db.WithContext(ctx).Save(key).Error
}

// Delete 删除API密钥（软删除）
func (r *APIKeyRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.APIKey{}, id).Error
}

// UpdateLastUsed 更新最后使用时间
func (r *APIKeyRepository) UpdateLastUsed(ctx context.Context, key string) error {
	return r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("key = ?", key).
		Update("last_used_at", gorm.Expr("NOW()")).Error
}

// RevokeByKey 撤销密钥
func (r *APIKeyRepository) RevokeByKey(ctx context.Context, key string) error {
	return r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("key = ?", key).
		Update("status", models.APIKeyStatusDisabled).Error
}
