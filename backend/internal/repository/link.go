package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
)

// ShortLinkRepository 短链接数据访问层
type ShortLinkRepository struct {
	db *gorm.DB
}

// NewShortLinkRepository 创建短链接仓库
func NewShortLinkRepository(db *gorm.DB) *ShortLinkRepository {
	return &ShortLinkRepository{db: db}
}

// Create 创建短链接
func (r *ShortLinkRepository) Create(ctx context.Context, link *models.ShortLink) error {
	return r.db.WithContext(ctx).Create(link).Error
}

// FindByCode 根据短码查找链接
func (r *ShortLinkRepository) FindByCode(ctx context.Context, code string) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&link).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// FindByID 根据 ID 查找链接
func (r *ShortLinkRepository) FindByID(ctx context.Context, id uint) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).First(&link, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// FindByURL 根据 URL 查找链接（用于去重）
func (r *ShortLinkRepository) FindByURL(ctx context.Context, userID uint, url string) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND url = ? AND status != ?", userID, url, models.LinkStatusExpired).
		First(&link).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// Update 更新短链接
func (r *ShortLinkRepository) Update(ctx context.Context, link *models.ShortLink) error {
	return r.db.WithContext(ctx).Save(link).Error
}

// Delete 删除短链接（软删除）
func (r *ShortLinkRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.ShortLink{}, id).Error
}

// DeleteByCode 根据短码删除链接
func (r *ShortLinkRepository) DeleteByCode(ctx context.Context, code string) error {
	return r.db.WithContext(ctx).Where("code = ?", code).Delete(&models.ShortLink{}).Error
}

// ListByUser 获取用户的短链接列表
func (r *ShortLinkRepository) ListByUser(ctx context.Context, userID uint, page, pageSize int) ([]models.ShortLink, int64, error) {
	var links []models.ShortLink
	var total int64

	query := r.db.WithContext(ctx).Where("user_id = ?", userID)

	err := query.Model(&models.ShortLink{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&links).Error
	if err != nil {
		return nil, 0, err
	}

	return links, total, nil
}

// List 列出所有短链接（管理员）
func (r *ShortLinkRepository) List(ctx context.Context, page, pageSize int) ([]models.ShortLink, int64, error) {
	var links []models.ShortLink
	var total int64

	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&links).Error
	if err != nil {
		return nil, 0, err
	}

	return links, total, nil
}

// IncrementClickCount 增加点击次数
func (r *ShortLinkRepository) IncrementClickCount(ctx context.Context, code string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("code = ?", code).
		Updates(map[string]interface{}{
			"click_count":   gorm.Expr("click_count + 1"),
			"last_click_at": &now,
		}).Error
}

// CountByUserID 统计用户的链接数量
func (r *ShortLinkRepository) CountByUserID(ctx context.Context, userID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("user_id = ?", userID).
		Count(&count).Error
	return count, err
}

// ExistsByCode 检查短码是否存在
func (r *ShortLinkRepository) ExistsByCode(ctx context.Context, code string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("code = ?", code).
		Count(&count).Error
	return count > 0, err
}

// FindExpiredLinks 查找过期的链接
func (r *ShortLinkRepository) FindExpiredLinks(ctx context.Context) ([]models.ShortLink, error) {
	var links []models.ShortLink
	now := time.Now()
	err := r.db.WithContext(ctx).
		Where("expires_at <= ? AND status = ?", now, models.LinkStatusActive).
		Find(&links).Error
	return links, err
}

// UpdateStatus 批量更新链接状态
func (r *ShortLinkRepository) UpdateStatus(ctx context.Context, ids []uint, status models.LinkStatus) error {
	return r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("id IN ?", ids).
		Update("status", status).Error
}
