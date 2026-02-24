package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// LinkHandler 短链接处理器
type LinkHandler struct {
	linkService *service.LinkService
}

// NewLinkHandler 创建短链接处理器
func NewLinkHandler(linkService *service.LinkService) *LinkHandler {
	return &LinkHandler{
		linkService: linkService,
	}
}

// CreateLink 创建短链接
// @Summary 创建短链接
// @Tags links
// @Accept json
// @Produce json
// @Param request body service.CreateLinkRequest true "创建请求"
// @Success 200 {object} response.Response{data=service.CreateLinkResponse}
// @Router /api/links [post]
func (h *LinkHandler) CreateLink(c *gin.Context) {
	var req service.CreateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 获取用户ID（从认证中间件设置）
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.BadRequest(c, "user not authenticated")
		return
	}
	req.UserID = userID

	result, err := h.linkService.Create(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, result)
}

// ListLinks 获取短链接列表
// @Summary 获取短链接列表
// @Tags links
// @Produce json
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.Response{data=service.ListLinksResponse}
// @Router /api/links [get]
func (h *LinkHandler) ListLinks(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "user not authenticated")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	req := &service.ListLinksRequest{
		UserID:   userID,
		Page:     page,
		PageSize: pageSize,
	}

	result, err := h.linkService.List(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// GetLink 获取短链接详情
// @Summary 获取短链接详情
// @Tags links
// @Produce json
// @Param code path string true "短码"
// @Success 200 {object} response.Response{data=models.ShortLink}
// @Router /api/links/{code} [get]
func (h *LinkHandler) GetLink(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c, "code is required")
		return
	}

	link, err := h.linkService.GetLink(c.Request.Context(), code)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.Success(c, link)
}

// UpdateLink 更新短链接
// @Summary 更新短链接
// @Tags links
// @Accept json
// @Produce json
// @Param code path string true "短码"
// @Param request body service.UpdateLinkRequest true "更新请求"
// @Success 200 {object} response.Response
// @Router /api/links/{code} [put]
func (h *LinkHandler) UpdateLink(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c, "code is required")
		return
	}

	var req service.UpdateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	req.Code = code
	userID := c.GetUint("user_id")

	if err := h.linkService.Update(c.Request.Context(), &req, userID); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "link updated successfully"})
}

// DeleteLink 删除短链接
// @Summary 删除短链接
// @Tags links
// @Produce json
// @Param code path string true "短码"
// @Success 200 {object} response.Response
// @Router /api/links/{code} [delete]
func (h *LinkHandler) DeleteLink(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c, "code is required")
		return
	}

	userID := c.GetUint("user_id")

	if err := h.linkService.Delete(c.Request.Context(), code, userID); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "link deleted successfully"})
}

// GetLinkStats 获取短链接统计
// @Summary 获取短链接统计
// @Tags links
// @Produce json
// @Param code path string true "短码"
// @Success 200 {object} response.Response{data=service.LinkStats}
// @Router /api/links/{code}/stats [get]
func (h *LinkHandler) GetLinkStats(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c, "code is required")
		return
	}

	userID := c.GetUint("user_id")

	stats, err := h.linkService.GetStats(c.Request.Context(), code, userID)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, stats)
}

// GetLinkLogs 获取短链接访问日志
// @Summary 获取短链接访问日志
// @Tags links
// @Produce json
// @Param code path string true "短码"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Success 200 {object} response.Response{data=service.LinkLogsResponse}
// @Router /api/links/{code}/logs [get]
func (h *LinkHandler) GetLinkLogs(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c, "code is required")
		return
	}

	userID := c.GetUint("user_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := h.linkService.GetAccessLogs(c.Request.Context(), code, userID, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateLinkRequest 创建请求（供API使用）
type CreateLinkRequest struct {
	URL       string    `json:"url" binding:"required"`
	Code      string    `json:"code"`
	Title     string    `json:"title"`
	ExpiresAt time.Time `json:"expires_at"`
	DomainID  uint      `json:"domain_id"` // 域名ID，用于多域名隔离
}

// CreateLinkAPI 创建短链接API（供外部API使用）
func (h *LinkHandler) CreateLinkAPI(c *gin.Context) {
	var req CreateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}

	serviceReq := &service.CreateLinkRequest{
		URL:       req.URL,
		Code:      req.Code,
		Title:     req.Title,
		ExpiresAt: req.ExpiresAt,
		UserID:    userID,
		DomainID:  req.DomainID,
	}

	result, err := h.linkService.Create(c.Request.Context(), serviceReq)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, result)
}
