package api

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// AuditHandler 审计日志处理器
type AuditHandler struct {
	auditService *service.AuditService
}

// NewAuditHandler 创建审计日志处理器
func NewAuditHandler(auditService *service.AuditService) *AuditHandler {
	return &AuditHandler{
		auditService: auditService,
	}
}

// ListAuditLogs 查询审计日志
// @Summary 查询审计日志（管理员）
// @Tags audit
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Param actor_id query int false "操作者ID"
// @Param action query string false "操作类型"
// @Success 200 {object} response.Response{data=service.ListAuditLogsResponse}
// @Router /api/admin/audit-logs [get]
func (h *AuditHandler) ListAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	// 解析可选参数
	var actorID *uint
	if actorStr := c.Query("actor_id"); actorStr != "" {
		if id, err := strconv.ParseUint(actorStr, 10, 32); err == nil {
			idUint := uint(id)
			actorID = &idUint
		}
	}

	action := c.Query("action")

	req := &service.ListAuditLogsRequest{
		Page:     page,
		PageSize: pageSize,
		ActorID:  actorID,
		Action:   action,
	}

	result, err := h.auditService.List(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, result)
}
