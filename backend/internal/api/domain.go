package api

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// DomainHandler 域名处理器
type DomainHandler struct {
	domainService *service.DomainService
	auditService  *service.AuditService
}

// NewDomainHandler 创建域名处理器
func NewDomainHandler(domainService *service.DomainService, auditService *service.AuditService) *DomainHandler {
	return &DomainHandler{
		domainService: domainService,
		auditService:  auditService,
	}
}

// CreateDomain 创建域名
// @Summary 创建域名
// @Tags admin
// @Produce json
// @Param request body service.CreateDomainRequest true "创建请求"
// @Success 200 {object} response.Response{data=models.Domain}
// @Router /api/admin/domains [post]
func (h *DomainHandler) CreateDomain(c *gin.Context) {
	var req service.CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	actorID := c.GetUint("user_id")

	domain, err := h.domainService.Create(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// 记录审计日志
	if h.auditService != nil {
		resourceID := domain.ID
		details := fmt.Sprintf("name:%s,ssl:%v", domain.Name, domain.SSL)
		h.auditService.RecordFromGin(
			c.Request.Context(),
			actorID,
			models.ActionDomainCreate,
			"domain",
			&resourceID,
			details,
			func() (string, string) {
				return c.ClientIP(), c.GetHeader("User-Agent")
			},
		)
	}

	response.Success(c, domain)
}

// ListDomains 获取域名列表
// @Summary 获取域名列表
// @Tags admin
// @Produce json
// @Success 200 {object} response.Response{data=[]models.Domain}
// @Router /api/admin/domains [get]
func (h *DomainHandler) ListDomains(c *gin.Context) {
	domains, err := h.domainService.List(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, domains)
}

// ListActiveDomains 获取启用的域名列表
// @Summary 获取启用的域名列表
// @Tags domains
// @Produce json
// @Success 200 {object} response.Response{data=[]models.Domain}
// @Router /api/domains [get]
func (h *DomainHandler) ListActiveDomains(c *gin.Context) {
	domains, err := h.domainService.ListActive(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, domains)
}

// UpdateDomain 更新域名
// @Summary 更新域名
// @Tags admin
// @Produce json
// @Param id path int true "域名ID"
// @Param request body service.UpdateDomainRequest true "更新请求"
// @Success 200 {object} response.Response
// @Router /api/admin/domains/{id} [put]
func (h *DomainHandler) UpdateDomain(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid domain id")
		return
	}

	var req service.UpdateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	req.ID = uint(id)

	// Debug log the received request data
	c.Set("debug_request", fmt.Sprintf("ID=%d, SSL=%v, IsActive=%v, Description=%v",
		req.ID, req.SSL, req.IsActive, req.Description))

	actorID := c.GetUint("user_id")

	if err := h.domainService.Update(c.Request.Context(), &req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// 记录审计日志
	if h.auditService != nil {
		resourceID := uint(id)
		h.auditService.RecordFromGin(
			c.Request.Context(),
			actorID,
			models.ActionDomainUpdate,
			"domain",
			&resourceID,
			"id:"+idStr,
			func() (string, string) {
				return c.ClientIP(), c.GetHeader("User-Agent")
			},
		)
	}

	response.Success(c, gin.H{"message": "domain updated successfully"})
}

// DeleteDomain 删除域名
// @Summary 删除域名
// @Tags admin
// @Produce json
// @Param id path int true "域名ID"
// @Success 200 {object} response.Response
// @Router /api/admin/domains/{id} [delete]
func (h *DomainHandler) DeleteDomain(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid domain id")
		return
	}

	actorID := c.GetUint("user_id")

	if err := h.domainService.Delete(c.Request.Context(), uint(id)); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// 记录审计日志
	if h.auditService != nil {
		resourceID := uint(id)
		h.auditService.RecordFromGin(
			c.Request.Context(),
			actorID,
			models.ActionDomainDelete,
			"domain",
			&resourceID,
			"id:"+idStr,
			func() (string, string) {
				return c.ClientIP(), c.GetHeader("User-Agent")
			},
		)
	}

	response.Success(c, gin.H{"message": "domain deleted successfully"})
}

// SetDefaultDomain 设置默认域名
// @Summary 设置默认域名
// @Tags admin
// @Produce json
// @Param id path int true "域名ID"
// @Success 200 {object} response.Response
// @Router /api/admin/domains/{id}/default [post]
func (h *DomainHandler) SetDefaultDomain(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid domain id")
		return
	}

	if err := h.domainService.SetDefault(c.Request.Context(), uint(id)); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "default domain set successfully"})
}

// ListUserDomains 获取当前���户可用的域名列表
// @Summary 获取当前用户可用的域名列表
// @Tags user
// @Produce json
// @Success 200 {object} response.Response{data=[]models.Domain}
// @Router /api/user/domains [get]
func (h *DomainHandler) ListUserDomains(c *gin.Context) {
	// 获取用户角色（需要类型断言，因为 context 中存储的是 models.UserRole 类型）
	roleValue, exists := c.Get("role")
	if !exists {
		response.InternalError(c, "user role not found in context")
		return
	}

	role, ok := roleValue.(models.UserRole)
	if !ok {
		response.InternalError(c, "invalid user role type in context")
		return
	}

	groupID := c.GetUint("group_id")

	var domains []models.Domain
	var err error

	// 管理员可以看到所有启用的域名
	if role == models.RoleAdmin {
		domains, err = h.domainService.ListActive(c.Request.Context())
	} else {
		// 普通用户只能看到其用户组被授权使用的域名
		if groupID == 0 {
			// 用户没有用户组，返回空列表
			domains = []models.Domain{}
		} else {
			domains, err = h.domainService.GetDomainsByGroup(c.Request.Context(), groupID)
		}
	}

	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, domains)
}
