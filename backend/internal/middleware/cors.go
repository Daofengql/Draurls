package middleware

import (
	"context"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// DynamicCORSManager 动态 CORS 管理器
type DynamicCORSManager struct {
	redis          *redis.Client
	siteConfigRepo *repository.SiteConfigRepository
	origins        []string
	mu             sync.RWMutex
}

// NewDynamicCORSManager 创建动态 CORS 管理器
func NewDynamicCORSManager(redisClient *redis.Client, siteConfigRepo *repository.SiteConfigRepository) *DynamicCORSManager {
	return &DynamicCORSManager{
		redis:          redisClient,
		siteConfigRepo: siteConfigRepo,
		origins:        []string{"http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"}, // 默认值
	}
}

// LoadFromDatabase 从数据库加载 CORS 配置
func (m *DynamicCORSManager) LoadFromDatabase(ctx context.Context) error {
	configValue, err := m.siteConfigRepo.Get(ctx, models.ConfigCORSOrigins)
	if err != nil {
		// 如果数据库中没有配置，使用默认值
		return nil
	}

	origins := parseCORSOrigins(configValue)
	m.mu.Lock()
	m.origins = origins
	m.mu.Unlock()

	return nil
}

// UpdateOrigins 更新 CORS origins
func (m *DynamicCORSManager) UpdateOrigins(origins []string) {
	m.mu.Lock()
	m.origins = origins
	m.mu.Unlock()
}

// GetOrigins 获取当前 CORS origins
func (m *DynamicCORSManager) GetOrigins() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.origins
}

// Middleware 返回 CORS 中间件
func (m *DynamicCORSManager) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			c.Next()
			return
		}

		// 获取当前允许的 origins
		allowOrigins := m.GetOrigins()

		// 检查是否配置了通配符
		hasWildcard := false
		for _, allowedOrigin := range allowOrigins {
			if allowedOrigin == "*" {
				hasWildcard = true
				break
			}
		}

		// 检查是否在允许列表中
		allowed := false
		matchedOrigin := ""
		for _, allowedOrigin := range allowOrigins {
			if allowedOrigin == "*" || allowedOrigin == origin {
				allowed = true
				matchedOrigin = allowedOrigin
				break
			}
		}

		if allowed {
			if hasWildcard {
				c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
			} else {
				c.Writer.Header().Set("Access-Control-Allow-Origin", matchedOrigin)
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
				c.Writer.Header().Set("Vary", "Origin")
			}
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Signature, X-Timestamp, X-Nonce, X-API-Key")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
			c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// parseCORSOrigins 解析 CORS 配置字符串为切片
func parseCORSOrigins(s string) []string {
	if s == "" {
		return []string{"http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"}
	}
	origins := []string{}
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			if start < i {
				origin := strings.TrimSpace(s[start:i])
				if origin != "" {
					origins = append(origins, origin)
				}
			}
			start = i + 1
		}
	}
	if start < len(s) {
		origin := strings.TrimSpace(s[start:])
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		return []string{"http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"}
	}
	return origins
}
