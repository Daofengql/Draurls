package service

import (
	"context"

	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// ConfigService 站点配置服务
type ConfigService struct {
	configRepo *repository.SiteConfigRepository
}

// NewConfigService 创建站点配置服务
func NewConfigService(configRepo *repository.SiteConfigRepository) *ConfigService {
	return &ConfigService{
		configRepo: configRepo,
	}
}

// ConfigItem 配置项
type ConfigItem struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

// ConfigDetail 配置详情
type ConfigDetail struct {
	Configs      []*ConfigItem `json:"configs"`
	CategoryInfo string         `json:"category_info"`
}

// UpdateConfigRequest 更新配置请求
type UpdateConfigRequest struct {
	Key         string `json:"key" binding:"required"`
	Value       string `json:"value" binding:"required"`
	Description string `json:"description"`
}

// BatchUpdateConfigRequest 批量更新配置请求
type BatchUpdateConfigRequest struct {
	Configs map[string]string `json:"configs" binding:"required"`
}

// predefinedConfigs 预定义的配置项及其描述
var predefinedConfigs = map[string]string{
	models.ConfigSiteName:       "站点名称",
	models.ConfigLogoURL:        "Logo URL",
	models.ConfigRedirectPage:   "是否启用跳转中间页 (true/false)",
	models.ConfigCustomDomains:  "自定义域名列表 (逗号分隔)",
	models.ConfigDefaultQuota:   "默认用户配额",
	models.ConfigMaxLinkLength:  "最大短链长度",
	models.ConfigEnableSignup:   "是否允许用户注册 (true/false)",
}

// GetAllConfig 获取所有配置（管理员专用）
func (s *ConfigService) GetAllConfig(ctx context.Context) (*ConfigDetail, error) {
	// 从数据库获取所有配置
	configs, err := s.configRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	// 转换为 ConfigItem 数组
	items := make([]*ConfigItem, 0, len(predefinedConfigs))
	for key, description := range predefinedConfigs {
		item := &ConfigItem{
			Key:         key,
			Value:       configs[key],
			Description: description,
		}
		items = append(items, item)
	}

	return &ConfigDetail{
		Configs: items,
	}, nil
}

// Update 更新单个配置
func (s *ConfigService) Update(ctx context.Context, req *UpdateConfigRequest) error {
	description := req.Description
	if description == "" {
		description = predefinedConfigs[req.Key]
	}
	return s.configRepo.Set(ctx, req.Key, req.Value, description)
}

// BatchUpdate 批量更新配置
func (s *ConfigService) BatchUpdate(ctx context.Context, req *BatchUpdateConfigRequest) error {
	return s.configRepo.BatchSet(ctx, req.Configs)
}

// GetPublicConfig 获取公开的站点配置（供前端使用）
func (s *ConfigService) GetPublicConfig(ctx context.Context) (map[string]string, error) {
	allConfigs, err := s.configRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	// 只返回公开的配置
	publicKeys := []string{
		models.ConfigSiteName,
		models.ConfigLogoURL,
		models.ConfigEnableSignup,
	}

	result := make(map[string]string)
	for _, key := range publicKeys {
		if value, ok := allConfigs[key]; ok {
			result[key] = value
		}
	}

	return result, nil
}
