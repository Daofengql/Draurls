package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/response"
	"gorm.io/gorm"
)

// HealthHandler 健康检查处理器
type HealthHandler struct {
	db         *gorm.DB
	redis      *redis.Client
	baseURL    string
}

// NewHealthHandler 创建健康检查处理器
func NewHealthHandler(db *gorm.DB, redis *redis.Client, baseURL string) *HealthHandler {
	return &HealthHandler{
		db:      db,
		redis:   redis,
		baseURL: baseURL,
	}
}

// HealthStatus 健康状态
type HealthStatus struct {
	Status    string            `json:"status"`
	Timestamp int64             `json:"timestamp"`
	Services map[string]string `json:"services"`
}

// ServiceStatus 服务状态
type ServiceStatus struct {
	Status    string `json:"status"`
	Message   string `json:"message,omitempty"`
	LatencyMs int64  `json:"latency_ms,omitempty"`
}

// HealthResponse 健康检查响应
type HealthResponse struct {
	Status   string                   `json:"status"`
	Services map[string]ServiceStatus `json:"services"`
	Version  string                   `json:"version"`
}

// Health 基础健康检查
func (h *HealthHandler) Health(c *gin.Context) {
	status := HealthStatus{
		Status:    "ok",
		Timestamp: 0, // 由前端填充
		Services: map[string]string{
			"server": "ok",
		},
	}
	response.Success(c, status)
}

// Readiness 就绪检查（检查依赖服务）
func (h *HealthHandler) Readiness(c *gin.Context) {
	services := make(map[string]ServiceStatus)
	overallStatus := "ok"

	// 检查数据库
	dbStatus := h.checkDatabase()
	services["database"] = dbStatus
	if dbStatus.Status != "ok" {
		overallStatus = "degraded"
	}

	// 检查 Redis
	redisStatus := h.checkRedis()
	services["redis"] = redisStatus
	if redisStatus.Status != "ok" {
		overallStatus = "degraded"
	}

	response.Success(c, HealthResponse{
		Status:   overallStatus,
		Services: services,
		Version:  "1.0.0",
	})
}

// Liveness 存活检查（Kubernetes 使用）
func (h *HealthHandler) Liveness(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "alive",
	})
}

// checkDatabase 检查数据库连接
func (h *HealthHandler) checkDatabase() ServiceStatus {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	sqlDB, err := h.db.DB()
	if err != nil {
		return ServiceStatus{
			Status:  "error",
			Message: "Failed to get database connection",
		}
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		return ServiceStatus{
			Status:  "error",
			Message: err.Error(),
		}
	}

	return ServiceStatus{
		Status:    "ok",
		LatencyMs: time.Since(start).Milliseconds(),
	}
}

// checkRedis 检查 Redis 连接
func (h *HealthHandler) checkRedis() ServiceStatus {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := h.redis.Ping(ctx).Err(); err != nil {
		return ServiceStatus{
			Status:  "error",
			Message: err.Error(),
		}
	}

	return ServiceStatus{
		Status:    "ok",
		LatencyMs: time.Since(start).Milliseconds(),
	}
}

// GetConfig 获取公开配置
func (h *HealthHandler) GetConfig(c *gin.Context) {
	response.Success(c, gin.H{
		"base_url": h.baseURL,
		"version":  "1.0.0",
	})
}
