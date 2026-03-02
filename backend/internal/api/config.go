package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// ConfigHandler 站点配置处理器
type ConfigHandler struct {
	configService *service.ConfigService
	auditService  *service.AuditService
	redisClient   *redis.Client
}

// NewConfigHandler 创建站点配置处理器
func NewConfigHandler(configService *service.ConfigService, auditService *service.AuditService, redisClient *redis.Client) *ConfigHandler {
	return &ConfigHandler{
		configService: configService,
		auditService:  auditService,
		redisClient:   redisClient,
	}
}

// invalidateSiteConfig 清除站点配置缓存
func (h *ConfigHandler) invalidateSiteConfig(ctx context.Context) {
	_ = h.redisClient.Del(ctx, "site:config")
}

// GetAdminConfig 获取所有站点配置（管理员）
// @Summary 获取所有站点配置
// @Tags admin
// @Produce json
// @Success 200 {object} response.Response{data=service.ConfigDetail}
// @Router /api/admin/config [get]
func (h *ConfigHandler) GetAdminConfig(c *gin.Context) {
	config, err := h.configService.GetAllConfig(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, config)
}

// UpdateConfig 更新单个配置项
// @Summary 更新配置项
// @Tags admin
// @Accept json
// @Produce json
// @Param request body service.UpdateConfigRequest true "更新请求"
// @Success 200 {object} response.Response
// @Router /api/admin/config [put]
func (h *ConfigHandler) UpdateConfig(c *gin.Context) {
	var req service.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	actorID := c.GetUint("user_id")

	if err := h.configService.Update(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// 清除站点配置缓存
	h.invalidateSiteConfig(c.Request.Context())

	// 记录审计日志
	if h.auditService != nil {
		details := fmt.Sprintf("key:%s,value:%s", req.Key, req.Value)
		h.auditService.RecordFromGin(
			c.Request.Context(),
			actorID,
			models.ActionConfigUpdate,
			"config",
			nil,
			details,
			func() (string, string) {
				return c.ClientIP(), c.GetHeader("User-Agent")
			},
		)
	}

	response.Success(c, gin.H{"message": "config updated successfully"})
}

// BatchUpdateConfig 批量更新配置
// @Summary 批量更新配置
// @Tags admin
// @Accept json
// @Produce json
// @Param request body service.BatchUpdateConfigRequest true "批量更新请求"
// @Success 200 {object} response.Response
// @Router /api/admin/config/batch [put]
func (h *ConfigHandler) BatchUpdateConfig(c *gin.Context) {
	var req service.BatchUpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	actorID := c.GetUint("user_id")

	if err := h.configService.BatchUpdate(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// 清除站点配置缓存
	h.invalidateSiteConfig(c.Request.Context())

	// 记录审计日志
	if h.auditService != nil {
		details := fmt.Sprintf("count:%d", len(req.Configs))
		h.auditService.RecordFromGin(
			c.Request.Context(),
			actorID,
			models.ActionConfigUpdate,
			"config",
			nil,
			details,
			func() (string, string) {
				return c.ClientIP(), c.GetHeader("User-Agent")
			},
		)
	}

	response.Success(c, gin.H{"message": "config updated successfully"})
}
