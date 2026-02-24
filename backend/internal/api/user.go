package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// UserHandler 用户处理器
type UserHandler struct {
	userService *service.UserService
}

// NewUserHandler 创建用户处理器
func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// GetProfile 获取当前用户资料
// @Summary 获取当前用户资料
// @Tags users
// @Produce json
// @Success 200 {object} response.Response{data=models.User}
// @Router /api/user/profile [get]
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}

	user, err := h.userService.GetByID(c.Request.Context(), userID)
	if err != nil {
		response.NotFound(c, "user not found")
		return
	}

	response.Success(c, user)
}

// GetQuotaStatus 获取配额状态
// @Summary 获取配额状态
// @Tags users
// @Produce json
// @Success 200 {object} response.Response{data=service.QuotaStatus}
// @Router /api/user/quota [get]
func (h *UserHandler) GetQuotaStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}

	status, err := h.userService.GetQuotaStatus(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, status)
}

// ListUsers 获取用户列表（管理员）
// @Summary 获取用户列表
// @Tags admin
// @Produce json
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.Response{data=service.ListUsersResponse}
// @Router /api/admin/users [get]
func (h *UserHandler) ListUsers(c *gin.Context) {
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("page_size", "20")

	req := &service.ListUsersRequest{}

	if page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			req.Page = p
		}
	}

	if pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			req.PageSize = ps
		}
	}

	result, err := h.userService.List(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// UpdateQuota 更新用户配额（管理员）
// @Summary 更新用户配额
// @Tags admin
// @Accept json
// @Produce json
// @Param request body service.UpdateQuotaRequest true "更新请求"
// @Success 200 {object} response.Response
// @Router /api/admin/users/quota [put]
func (h *UserHandler) UpdateQuota(c *gin.Context) {
	var req service.UpdateQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if err := h.userService.UpdateQuota(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "quota updated successfully"})
}

// SetGroup 设置用户组（管理员）
// @Summary 设置用户组
// @Tags admin
// @Accept json
// @Produce json
// @Param request body service.SetGroupRequest true "设置请求"
// @Success 200 {object} response.Response
// @Router /api/admin/users/group [put]
func (h *UserHandler) SetGroup(c *gin.Context) {
	var req service.SetGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if err := h.userService.SetGroup(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "group updated successfully"})
}

// DisableUser 禁用用户（管理员）
// @Summary 禁用用户
// @Tags admin
// @Produce json
// @Param id path int true "用户ID"
// @Success 200 {object} response.Response
// @Router /api/admin/users/{id}/disable [post]
func (h *UserHandler) DisableUser(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid user id")
		return
	}

	if err := h.userService.Disable(c.Request.Context(), uint(userID)); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "user disabled successfully"})
}

// EnableUser 启用用户（管理员）
// @Summary 启用用户
// @Tags admin
// @Produce json
// @Param id path int true "用户ID"
// @Success 200 {object} response.Response
// @Router /api/admin/users/{id}/enable [post]
func (h *UserHandler) EnableUser(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid user id")
		return
	}

	if err := h.userService.Enable(c.Request.Context(), uint(userID)); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "user enabled successfully"})
}
