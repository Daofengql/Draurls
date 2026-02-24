package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// ConfigHandler 站点配置处理器
type ConfigHandler struct {
	configService *service.ConfigService
}

// NewConfigHandler 创建站点配置处理器
func NewConfigHandler(configService *service.ConfigService) *ConfigHandler {
	return &ConfigHandler{
		configService: configService,
	}
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

	if err := h.configService.Update(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
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

	if err := h.configService.BatchUpdate(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "config updated successfully"})
}
