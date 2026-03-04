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
	Value       string `json:"value"`
	Description string `json:"description"`
}

// BatchUpdateConfigRequest 批量更新配置请求
type BatchUpdateConfigRequest struct {
	Configs map[string]string `json:"configs"`
}

// predefinedConfigs 预定义的配置项及其描述
var predefinedConfigs = map[string]string{
	models.ConfigSiteName:       "站点名称",
	models.ConfigLogoURL:        "Logo URL",
	models.ConfigRedirectPage:   "是否启用跳转中间页 (true/false)",
	models.ConfigAllowUserTemplate: "是否允许用户选择跳转模板 (true/false)",
	models.ConfigMaxLinkLength:  "最大短链长度",
	models.ConfigEnableSignup:   "是否允许用户注��� (true/false)",
	models.ConfigShortcodeMode:  "短码生成模式 (random/sequence)",
	models.ConfigAllowCustomShortcode: "是否允许普通用户使用自定义短码 (true/false)",
	models.ConfigCORSOrigins:    "CORS 允许的源，多个用逗号分隔，使用 * 表示允许所有���警告：使用 * 时将禁用 Credentials）",
	models.ConfigICPNumber:      "ICP备案号",
}

// GetAllConfig 获取所有配置（管理员专用）
func (s *ConfigService) GetAllConfig(ctx context.Context) (map[string]string, error) {
	// 从数据库获取所有配置
	configs, err := s.configRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	// 确保所有预定义配置都有值（即使数据库中没有）
	for key := range predefinedConfigs {
		if _, exists := configs[key]; !exists {
			configs[key] = ""
		}
	}

	return configs, nil
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
	if len(req.Configs) == 0 {
		return nil // 空配置不处理
	}
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
		models.ConfigRedirectPage,
		models.ConfigAllowUserTemplate,
		models.ConfigEnableSignup,
		models.ConfigICPNumber,
	}

	result := make(map[string]string)
	for _, key := range publicKeys {
		if value, ok := allConfigs[key]; ok {
			result[key] = value
		}
	}

	return result, nil
}
