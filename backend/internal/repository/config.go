package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/surls/backend/internal/models"
)

// SiteConfigRepository 站点配置数据访问层
type SiteConfigRepository struct {
	db *gorm.DB
}

// NewSiteConfigRepository 创建站点配置仓库
func NewSiteConfigRepository(db *gorm.DB) *SiteConfigRepository {
	return &SiteConfigRepository{db: db}
}

// Get 根据键获取配置
func (r *SiteConfigRepository) Get(ctx context.Context, key string) (string, error) {
	var config models.SiteConfig
	err := r.db.WithContext(ctx).Where("`key` = ?", key).First(&config).Error
	if err != nil {
		return "", err
	}
	return config.Value, nil
}

// Set 设置配置（不存在则创建，存在则更新）
func (r *SiteConfigRepository) Set(ctx context.Context, key, value, description string) error {
	var config models.SiteConfig
	err := r.db.WithContext(ctx).Where("`key` = ?", key).First(&config).Error

	if err == gorm.ErrRecordNotFound {
		// 创建新配置
		config = models.SiteConfig{
			Key:         key,
			Value:       value,
			Description: description,
		}
		return r.db.WithContext(ctx).Create(&config).Error
	}

	if err != nil {
		return err
	}

	// 更新现有配置
	config.Value = value
	if description != "" {
		config.Description = description
	}
	return r.db.WithContext(ctx).Save(&config).Error
}

// GetAll 获取所有配置
func (r *SiteConfigRepository) GetAll(ctx context.Context) (map[string]string, error) {
	var configs []models.SiteConfig
	err := r.db.WithContext(ctx).Find(&configs).Error
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, config := range configs {
		result[config.Key] = config.Value
	}
	return result, nil
}

// BatchSet 批量设置配置
func (r *SiteConfigRepository) BatchSet(ctx context.Context, configs map[string]string) error {
	for key, value := range configs {
		err := r.Set(ctx, key, value, "")
		if err != nil {
			return err
		}
	}
	return nil
}

// Delete 删除配置
func (r *SiteConfigRepository) Delete(ctx context.Context, key string) error {
	return r.db.WithContext(ctx).Where("`key` = ?", key).Delete(&models.SiteConfig{}).Error
}

// UserGroupRepository 用户组数据访问层
type UserGroupRepository struct {
	db *gorm.DB
}

// NewUserGroupRepository 创建用户组仓库
func NewUserGroupRepository(db *gorm.DB) *UserGroupRepository {
	return &UserGroupRepository{db: db}
}

// Create 创建用户组
func (r *UserGroupRepository) Create(ctx context.Context, group *models.UserGroup) error {
	return r.db.WithContext(ctx).Create(group).Error
}

// FindByID 根据ID查找用户组
func (r *UserGroupRepository) FindByID(ctx context.Context, id uint) (*models.UserGroup, error) {
	var group models.UserGroup
	err := r.db.WithContext(ctx).First(&group, id).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// FindByName 根据名称查找用户组
func (r *UserGroupRepository) FindByName(ctx context.Context, name string) (*models.UserGroup, error) {
	var group models.UserGroup
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// List 列出所有用户组
func (r *UserGroupRepository) List(ctx context.Context) ([]models.UserGroup, error) {
	var groups []models.UserGroup
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&groups).Error
	return groups, err
}

// Update 更新用户组
func (r *UserGroupRepository) Update(ctx context.Context, group *models.UserGroup) error {
	return r.db.WithContext(ctx).Save(group).Error
}

// Delete 删除用户组（软删除）
func (r *UserGroupRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.UserGroup{}, id).Error
}

// GetUsers 获取用户组下的所有用户
func (r *UserGroupRepository) GetUsers(ctx context.Context, groupID uint) ([]*models.User, error) {
	var users []*models.User
	err := r.db.WithContext(ctx).
		Where("group_id = ?", groupID).
		Find(&users).Error
	return users, err
}

// CountUsers 统计用户组下的用户数量
func (r *UserGroupRepository) CountUsers(ctx context.Context, groupID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.User{}).
		Where("group_id = ?", groupID).
		Count(&count).Error
	return count, err
}

// FindDefault 查找默认用户组
func (r *UserGroupRepository) FindDefault(ctx context.Context) (*models.UserGroup, error) {
	var group models.UserGroup
	err := r.db.WithContext(ctx).Where("is_default = ?", true).First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// SetDefault 设置默认用户组（会先将其他组的 is_default 设为 false）
func (r *UserGroupRepository) SetDefault(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 将所有当前默认的组设为非默认
		if err := tx.Model(&models.UserGroup{}).Where("is_default = ?", true).Update("is_default", false).Error; err != nil {
			return err
		}
		// 将指定组设为默认
		return tx.Model(&models.UserGroup{}).Where("id = ?", id).Update("is_default", true).Error
	})
}

// GetAllowedDomains 获取用户组允许使用的域名列表
func (r *UserGroupRepository) GetAllowedDomains(ctx context.Context, groupID uint) ([]models.Domain, error) {
	var domains []models.Domain
	err := r.db.WithContext(ctx).
		Table("domains d").
		Joins("JOIN domain_group_domains dgd ON dgd.domain_id = d.id").
		Where("dgd.group_id = ?", groupID).
		Find(&domains).Error
	return domains, err
}

// AddDomainToGroup 将域名添加到用户组的允许列表
func (r *UserGroupRepository) AddDomainToGroup(ctx context.Context, domainID, groupID uint) error {
	return r.db.WithContext(ctx).Create(&models.DomainGroupDomain{
		DomainID: domainID,
		GroupID:  groupID,
	}).Error
}

// RemoveDomainFromGroup 从用户组的允许列表中移除域名
func (r *UserGroupRepository) RemoveDomainFromGroup(ctx context.Context, domainID, groupID uint) error {
	return r.db.WithContext(ctx).
		Where("domain_id = ? AND group_id = ?", domainID, groupID).
		Delete(&models.DomainGroupDomain{}).Error
}
