package service

import (
	"context"
	"time"

	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// DashboardService 仪表盘服务
type DashboardService struct {
	userRepo     *repository.UserRepository
	linkRepo     *repository.ShortLinkRepository
	accessLogRepo *repository.AccessLogRepository
}

// NewDashboardService 创建仪表盘服务
func NewDashboardService(
	userRepo *repository.UserRepository,
	linkRepo *repository.ShortLinkRepository,
	accessLogRepo *repository.AccessLogRepository,
) *DashboardService {
	return &DashboardService{
		userRepo:     userRepo,
		linkRepo:     linkRepo,
		accessLogRepo: accessLogRepo,
	}
}

// UserDashboard 用户仪表盘数据
type UserDashboard struct {
	// 短链统计
	TotalLinks    int64 `json:"total_links"`
	ActiveLinks   int64 `json:"active_links"`
	TodayLinks    int64 `json:"today_links"`

	// 点击统计
	TotalClicks   int64 `json:"total_clicks"`
	TodayClicks   int64 `json:"today_clicks"`
	YesterdayClicks int64 `json:"yesterday_clicks"`

	// 配额信息
	Quota         *QuotaStatus `json:"quota"`

	// 最近创建的短链
	RecentLinks   []*models.ShortLink `json:"recent_links"`
}

// AdminSummary 管理员统计数据
type AdminSummary struct {
	// 用户统计
	TotalUsers    int64 `json:"total_users"`
	ActiveUsers   int64 `json:"active_users"`
	TodayUsers    int64 `json:"today_users"`

	// 短链统计
	TotalLinks    int64 `json:"total_links"`
	ActiveLinks   int64 `json:"active_links"`
	TodayLinks    int64 `json:"today_links"`

	// 点击统计
	TotalClicks   int64 `json:"total_clicks"`
	TodayClicks   int64 `json:"today_clicks"`

	// 系统信息
	UptimeSeconds int64 `json:"uptime_seconds"`
	DBConnections int  `json:"db_connections"`
}

// TrendData 趋势数据
type TrendData struct {
	StartDate string   `json:"start_date"`
	EndDate   string   `json:"end_date"`
	Days      int      `json:"days"`
	// 每日数据
	DailyData []DailyTrend `json:"daily_data"`
}

// DailyTrend 每日趋势
type DailyTrend struct {
	Date        string `json:"date"`
	Links       int64  `json:"links"`
	Clicks      int64  `json:"clicks"`
	NewUsers    int64  `json:"new_users"`
}

// GetUserDashboard 获取用户仪表盘数据
func (s *DashboardService) GetUserDashboard(ctx context.Context, userID uint) (*UserDashboard, error) {
	dashboard := &UserDashboard{}

	// 获取短链统计
	totalLinks, err := s.linkRepo.CountByUserID(ctx, userID)
	if err == nil {
		dashboard.TotalLinks = totalLinks
	}

	activeLinks, err := s.linkRepo.CountActiveByUserID(ctx, userID)
	if err == nil {
		dashboard.ActiveLinks = activeLinks
	}

	// 获取今日新增短链
	today := time.Now().Format("2006-01-02")
	todayLinks, err := s.linkRepo.CountByUserIDAndDate(ctx, userID, today)
	if err == nil {
		dashboard.TodayLinks = todayLinks
	}

	// 获取点击统计
	totalClicks, err := s.linkRepo.SumClicksByUserID(ctx, userID)
	if err == nil {
		dashboard.TotalClicks = totalClicks
	}

	todayClicks, err := s.accessLogRepo.CountClicksByUserIDAndDate(ctx, userID, today)
	if err == nil {
		dashboard.TodayClicks = todayClicks
	}

	// 获取昨天的点击数
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	yesterdayClicks, err := s.accessLogRepo.CountClicksByUserIDAndDate(ctx, userID, yesterday)
	if err == nil {
		dashboard.YesterdayClicks = yesterdayClicks
	}

	// 获取最近创建的短链
	recentLinks, err := s.linkRepo.GetRecentByUserID(ctx, userID, 5)
	if err == nil {
		dashboard.RecentLinks = recentLinks
	}

	return dashboard, nil
}

// GetAdminSummary 获取管理员统计数据
func (s *DashboardService) GetAdminSummary(ctx context.Context) (*AdminSummary, error) {
	summary := &AdminSummary{}

	// 用户统计
	totalUsers, err := s.userRepo.Count(ctx)
	if err == nil {
		summary.TotalUsers = totalUsers
	}

	activeUsers, err := s.userRepo.CountActive(ctx)
	if err == nil {
		summary.ActiveUsers = activeUsers
	}

	today := time.Now().Format("2006-01-02")
	todayUsers, err := s.userRepo.CountByDate(ctx, today)
	if err == nil {
		summary.TodayUsers = todayUsers
	}

	// 短链统计
	totalLinks, err := s.linkRepo.CountAll(ctx)
	if err == nil {
		summary.TotalLinks = totalLinks
	}

	activeLinks, err := s.linkRepo.CountActive(ctx)
	if err == nil {
		summary.ActiveLinks = activeLinks
	}

	todayLinks, err := s.linkRepo.CountByDate(ctx, today)
	if err == nil {
		summary.TodayLinks = todayLinks
	}

	// 点击统计
	totalClicks, err := s.linkRepo.SumAllClicks(ctx)
	if err == nil {
		summary.TotalClicks = totalClicks
	}

	todayClicks, err := s.accessLogRepo.CountClicksByDate(ctx, today)
	if err == nil {
		summary.TodayClicks = todayClicks
	}

	// 系统运行时间（实际应该从启动时记录）
	summary.UptimeSeconds = int64(time.Since(time.Now().AddDate(0, 0, -30)).Seconds()) // 示例值

	return summary, nil
}

// GetTrends 获取趋势数据
func (s *DashboardService) GetTrends(ctx context.Context, days int) (*TrendData, error) {
	trend := &TrendData{
		Days:      days,
		DailyData: make([]DailyTrend, 0, days),
	}

	now := time.Now()
	endDate := now.Format("2006-01-02")
	startDate := now.AddDate(0, 0, -days+1).Format("2006-01-02")

	trend.StartDate = startDate
	trend.EndDate = endDate

	// 获取每日数据
	for i := days - 1; i >= 0; i-- {
		date := now.AddDate(0, 0, -i).Format("2006-01-02")

		links, _ := s.linkRepo.CountByDate(ctx, date)
		clicks, _ := s.accessLogRepo.CountClicksByDate(ctx, date)
		newUsers, _ := s.userRepo.CountByDate(ctx, date)

		trend.DailyData = append(trend.DailyData, DailyTrend{
			Date:     date,
			Links:    links,
			Clicks:   clicks,
			NewUsers: newUsers,
		})
	}

	return trend, nil
}
