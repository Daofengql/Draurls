package api

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// DashboardHandler 仪表盘处理器
type DashboardHandler struct {
	dashboardService *service.DashboardService
}

// NewDashboardHandler 创建仪表盘处理器
func NewDashboardHandler(dashboardService *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{
		dashboardService: dashboardService,
	}
}

// GetUserDashboard 获取用户仪表盘数据
// @Summary 获取用户仪表盘
// @Tags user
// @Produce json
// @Success 200 {object} response.Response{data=service.UserDashboard}
// @Router /api/user/dashboard [get]
func (h *DashboardHandler) GetUserDashboard(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}

	dashboard, err := h.dashboardService.GetUserDashboard(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, dashboard)
}

// GetAdminSummary 获取管理员统计数据
// @Summary 获取管理员统计
// @Tags admin
// @Produce json
// @Success 200 {object} response.Response{data=service.AdminSummary}
// @Router /api/admin/dashboard/summary [get]
func (h *DashboardHandler) GetAdminSummary(c *gin.Context) {
	summary, err := h.dashboardService.GetAdminSummary(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, summary)
}

// GetAdminTrends 获取流量趋势数据
// @Summary 获取流量趋势
// @Tags admin
// @Produce json
// @Param days query int false "天数" default(30)
// @Success 200 {object} response.Response{data=service.TrendData}
// @Router /api/admin/dashboard/trends [get]
func (h *DashboardHandler) GetAdminTrends(c *gin.Context) {
	days := c.DefaultQuery("days", "30")
	daysInt, err := strconv.Atoi(days)
	if err != nil || daysInt <= 0 || daysInt > 365 {
		daysInt = 30
	}

	trends, err := h.dashboardService.GetTrends(c.Request.Context(), daysInt)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, trends)
}
