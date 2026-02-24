package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
)

// UserRepository 用户数据访问层
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓库
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create 创建用户
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// FindByID 根据 ID 查找用户
func (r *UserRepository) FindByID(ctx context.Context, id uint) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("id = ? AND status != ?", id, models.UserStatusDeleted).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

// FindByKeycloakID 根据 Keycloak ID 查找用户
func (r *UserRepository) FindByKeycloakID(ctx context.Context, keycloakID string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("keycloak_id = ? AND status != ?", keycloakID, models.UserStatusDeleted).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

// FindByEmail 根据邮箱查找用户
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("email = ? AND status != ?", email, models.UserStatusDeleted).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

// Update 更新用户
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// Delete 删除用户（软删除）
func (r *UserRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.User{}, id).Error
}

// List 列出用户
func (r *UserRepository) List(ctx context.Context, page, pageSize int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	query := r.db.WithContext(ctx).Where("status != ?", models.UserStatusDeleted)

	err := query.Model(&models.User{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&users).Error
	if err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// UpdateQuota 更新用户配额
func (r *UserRepository) UpdateQuota(ctx context.Context, userID uint, quota, quotaUsed int) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"quota":      quota,
			"quota_used": quotaUsed,
		}).Error
}

// IncrementQuotaUsed 增加已用配额
func (r *UserRepository) IncrementQuotaUsed(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("quota_used", gorm.Expr("quota_used + 1")).Error
}

// DecrementQuotaUsed 减少已用配额
func (r *UserRepository) DecrementQuotaUsed(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("quota_used", gorm.Expr("quota_used - 1")).Error
}

// ExistsByKeycloakID 检查 Keycloak ID 是否存在
func (r *UserRepository) ExistsByKeycloakID(ctx context.Context, keycloakID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("keycloak_id = ? AND status != ?", keycloakID, models.UserStatusDeleted).
		Count(&count).Error
	return count > 0, err
}
