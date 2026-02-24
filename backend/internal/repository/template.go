package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/surls/backend/internal/models"
	apperrors "github.com/surls/backend/internal/errors"
)

// RedirectTemplateRepository 跳转模板数据访问层
type RedirectTemplateRepository struct {
	db *gorm.DB
}

// NewRedirectTemplateRepository 创建模板仓库
func NewRedirectTemplateRepository(db *gorm.DB) *RedirectTemplateRepository {
	return &RedirectTemplateRepository{db: db}
}

// Create 创建模板
func (r *RedirectTemplateRepository) Create(ctx context.Context, template *models.RedirectTemplate) error {
	return r.db.WithContext(ctx).Create(template).Error
}

// FindByID 根据ID查找模板
func (r *RedirectTemplateRepository) FindByID(ctx context.Context, id uint) (*models.RedirectTemplate, error) {
	var template models.RedirectTemplate
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&template).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &template, nil
}

// FindByName 根据名称查找模板
func (r *RedirectTemplateRepository) FindByName(ctx context.Context, name string) (*models.RedirectTemplate, error) {
	var template models.RedirectTemplate
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&template).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &template, nil
}

// FindDefault 查找默认模板
func (r *RedirectTemplateRepository) FindDefault(ctx context.Context) (*models.RedirectTemplate, error) {
	var template models.RedirectTemplate
	err := r.db.WithContext(ctx).Where("is_default = ?", true).First(&template).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &template, nil
}

// List 列出所有模板
func (r *RedirectTemplateRepository) List(ctx context.Context) ([]models.RedirectTemplate, error) {
	var templates []models.RedirectTemplate
	err := r.db.WithContext(ctx).Order("is_default DESC, created_at DESC").Find(&templates).Error
	return templates, err
}

// ListEnabled 列出所有启用的模板
func (r *RedirectTemplateRepository) ListEnabled(ctx context.Context) ([]models.RedirectTemplate, error) {
	var templates []models.RedirectTemplate
	err := r.db.WithContext(ctx).Where("enabled = ?", true).
		Order("is_default DESC, created_at DESC").
		Find(&templates).Error
	return templates, err
}

// Update 更新模板
func (r *RedirectTemplateRepository) Update(ctx context.Context, template *models.RedirectTemplate) error {
	return r.db.WithContext(ctx).Save(template).Error
}

// Delete 删除模板
func (r *RedirectTemplateRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.RedirectTemplate{}, id).Error
}

// ClearDefault 清除所有默认标记
func (r *RedirectTemplateRepository) ClearDefault(ctx context.Context) error {
	return r.db.WithContext(ctx).Model(&models.RedirectTemplate{}).
		Update("is_default", false).Error
}

// SetDefault 设置指定模板为默认
func (r *RedirectTemplateRepository) SetDefault(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Model(&models.RedirectTemplate{}).
		Where("id = ?", id).
		Update("is_default", true).Error
}
