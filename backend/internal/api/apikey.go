package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// APIKeyHandler API密钥处理器
type APIKeyHandler struct {
	apiKeyService *service.APIKeyService
}

// NewAPIKeyHandler 创建API密钥处理器
func NewAPIKeyHandler(apiKeyService *service.APIKeyService) *APIKeyHandler {
	return &APIKeyHandler{
		apiKeyService: apiKeyService,
	}
}

// CreateAPIKey 创建API密钥
// @Summary 创建API密钥
// @Tags apikeys
// @Accept json
// @Produce json
// @Param request body service.CreateAPIKeyRequest true "创建请求"
// @Success 200 {object} response.Response{data=service.CreateAPIKeyResponse}
// @Router /api/apikeys [post]
func (h *APIKeyHandler) CreateAPIKey(c *gin.Context) {
	var req service.CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}

	req.UserID = userID

	result, err := h.apiKeyService.Create(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, result)
}

// ListAPIKeys 获取API密钥列表
// @Summary 获取API密钥列表
// @Tags apikeys
// @Produce json
// @Success 200 {object} response.Response{data=[]models.APIKey}
// @Router /api/apikeys [get]
func (h *APIKeyHandler) ListAPIKeys(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}

	keys, err := h.apiKeyService.List(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, keys)
}

// DeleteAPIKey 删除API密钥
// @Summary 删除API密钥
// @Tags apikeys
// @Produce json
// @Param id path int true "密钥ID"
// @Success 200 {object} response.Response
// @Router /api/apikeys/{id} [delete]
func (h *APIKeyHandler) DeleteAPIKey(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}

	idStr := c.Param("id")
	keyID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid key id")
		return
	}

	if err := h.apiKeyService.Delete(c.Request.Context(), uint(keyID), userID); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "API key deleted successfully"})
}

// CreateAPIKeyRequest 创建请求简化版
type CreateAPIKeyRequest struct {
	Name      string        `json:"name" binding:"required"`
	ExpiresIn time.Duration `json:"expires_in"` // 过期时长（秒），0表示永久
}
