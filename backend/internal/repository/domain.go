package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
)

// DomainRepository 域名数据访问层
type DomainRepository struct {
	db *gorm.DB
}

// NewDomainRepository 创建域名仓库
func NewDomainRepository(db *gorm.DB) *DomainRepository {
	return &DomainRepository{db: db}
}

// Create 创建域名
func (r *DomainRepository) Create(ctx context.Context, domain *models.Domain) error {
	return r.db.WithContext(ctx).Create(domain).Error
}

// FindByID 根据ID查找域名
func (r *DomainRepository) FindByID(ctx context.Context, id uint) (*models.Domain, error) {
	var domain models.Domain
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&domain).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &domain, nil
}

// FindByName 根据名称查找域名
func (r *DomainRepository) FindByName(ctx context.Context, name string) (*models.Domain, error) {
	var domain models.Domain
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&domain).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &domain, nil
}

// List 获取所有域名
func (r *DomainRepository) List(ctx context.Context) ([]models.Domain, error) {
	var domains []models.Domain
	err := r.db.WithContext(ctx).Order("is_default DESC, created_at ASC").Find(&domains).Error
	return domains, err
}

// ListActive 获取所有启用的域名
func (r *DomainRepository) ListActive(ctx context.Context) ([]models.Domain, error) {
	var domains []models.Domain
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("is_default DESC, created_at ASC").Find(&domains).Error
	return domains, err
}

// Update 更新域名
func (r *DomainRepository) Update(ctx context.Context, domain *models.Domain) error {
	return r.db.WithContext(ctx).Save(domain).Error
}

// UpdateFields 更新域名的指定字段
func (r *DomainRepository) UpdateFields(ctx context.Context, id uint, updates map[string]interface{}) error {
	return r.db.WithContext(ctx).Model(&models.Domain{}).Where("id = ?", id).Updates(updates).Error
}

// Delete 删除域名（软删除）
func (r *DomainRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Domain{}, id).Error
}

// GetDefault 获取默认域名
func (r *DomainRepository) GetDefault(ctx context.Context) (*models.Domain, error) {
	var domain models.Domain
	err := r.db.WithContext(ctx).Where("is_default = ? AND is_active = ?", true, true).First(&domain).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &domain, nil
}

// SetDefault 设置默认域名（会先将其他域名的 is_default 设为 false）
func (r *DomainRepository) SetDefault(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 将所有当前默认的域名设为非默认
		if err := tx.Model(&models.Domain{}).Where("is_default = ?", true).Update("is_default", false).Error; err != nil {
			return err
		}
		// 将指定域名设为默认
		return tx.Model(&models.Domain{}).Where("id = ?", id).Update("is_default", true).Error
	})
}

// BuildDomainURL 构建���整的域名URL
func (r *DomainRepository) BuildDomainURL(domain *models.Domain) string {
	protocol := "https"
	if !domain.SSL {
		protocol = "http"
	}
	return protocol + "://" + domain.Name
}

// GetAllowedGroupsForDomain 获取允许使用指定域名的用户组列表
func (r *DomainRepository) GetAllowedGroupsForDomain(ctx context.Context, domainID uint) ([]models.UserGroup, error) {
	var groups []models.UserGroup
	err := r.db.WithContext(ctx).
		Joins("JOIN domain_group_domains ON domain_group_domains.group_id = user_groups.id").
		Where("domain_group_domains.domain_id = ?", domainID).
		Find(&groups).Error
	return groups, err
}

// CheckUserGroupAccessDomain 检查用户组是否有权限访问指定域名
func (r *DomainRepository) CheckUserGroupAccessDomain(ctx context.Context, groupID, domainID uint) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.DomainGroupDomain{}).
		Where("group_id = ? AND domain_id = ?", groupID, domainID).
		Count(&count).Error
	return count > 0, err
}

// AddGroupToDomain 将用户组添加到域名白名单
func (r *DomainRepository) AddGroupToDomain(ctx context.Context, domainID, groupID uint) error {
	return r.db.WithContext(ctx).Create(&models.DomainGroupDomain{
		DomainID: domainID,
		GroupID:  groupID,
	}).Error
}

// RemoveGroupFromDomain 从域名白名单中移除用户组
func (r *DomainRepository) RemoveGroupFromDomain(ctx context.Context, domainID, groupID uint) error {
	return r.db.WithContext(ctx).
		Where("domain_id = ? AND group_id = ?", domainID, groupID).
		Delete(&models.DomainGroupDomain{}).Error
}
