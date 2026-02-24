package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// GroupHandler 用户组处理器
type GroupHandler struct {
	groupService *service.GroupService
}

// NewGroupHandler 创建用户组处理器
func NewGroupHandler(groupService *service.GroupService) *GroupHandler {
	return &GroupHandler{
		groupService: groupService,
	}
}

// ListGroups 获取所有用户组列表
// @Summary 获取用户组列表
// @Tags admin
// @Produce json
// @Success 200 {object} response.Response{data=[]models.UserGroup}
// @Router /api/admin/groups [get]
func (h *GroupHandler) ListGroups(c *gin.Context) {
	groups, err := h.groupService.List(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, groups)
}

// CreateGroup 创建用户组
// @Summary 创建用户组
// @Tags admin
// @Accept json
// @Produce json
// @Param request body service.CreateGroupRequest true "创建请求"
// @Success 200 {object} response.Response{data=models.UserGroup}
// @Router /api/admin/groups [post]
func (h *GroupHandler) CreateGroup(c *gin.Context) {
	var req service.CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	group, err := h.groupService.Create(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, group)
}

// GetGroup 获取用户组详情
// @Summary 获取用户组详情
// @Tags admin
// @Produce json
// @Param id path int true "用户组ID"
// @Success 200 {object} response.Response{data=service.GroupDetail}
// @Router /api/admin/groups/{id} [get]
func (h *GroupHandler) GetGroup(c *gin.Context) {
	idStr := c.Param("id")
	groupID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid group id")
		return
	}

	detail, err := h.groupService.GetDetail(c.Request.Context(), uint(groupID))
	if err != nil {
		response.NotFound(c, "group not found")
		return
	}

	response.Success(c, detail)
}

// UpdateGroup 更新用户组
// @Summary 更新用户组
// @Tags admin
// @Accept json
// @Produce json
// @Param id path int true "用户组ID"
// @Param request body service.UpdateGroupRequest true "更新请求"
// @Success 200 {object} response.Response
// @Router /api/admin/groups/{id} [put]
func (h *GroupHandler) UpdateGroup(c *gin.Context) {
	idStr := c.Param("id")
	groupID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid group id")
		return
	}

	var req service.UpdateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	req.ID = uint(groupID)

	if err := h.groupService.Update(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "group updated successfully"})
}

// DeleteGroup 删除用户组
// @Summary 删除用户组
// @Tags admin
// @Produce json
// @Param id path int true "用户组ID"
// @Success 200 {object} response.Response
// @Router /api/admin/groups/{id} [delete]
func (h *GroupHandler) DeleteGroup(c *gin.Context) {
	idStr := c.Param("id")
	groupID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid group id")
		return
	}

	if err := h.groupService.Delete(c.Request.Context(), uint(groupID)); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "group deleted successfully"})
}
