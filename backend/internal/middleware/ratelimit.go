package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/pkg/cache"
)

// RateLimitMiddleware 限流中间件
type RateLimitMiddleware struct {
	service *cache.RateLimitService
}

// NewRateLimitMiddleware 创建限流中间件
func NewRateLimitMiddleware(service *cache.RateLimitService) *RateLimitMiddleware {
	return &RateLimitMiddleware{service: service}
}

// IPLimit IP限流
func (m *RateLimitMiddleware) IPLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		allowed, err := m.service.CheckIPLimit(c.Request.Context(), ip)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "rate limit check failed"})
			c.Abort()
			return
		}

		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests",
				"code":  "RATE_LIMIT_EXCEEDED",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// UserLimit 用户限流
func (m *RateLimitMiddleware) UserLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("user")
		if !exists {
			c.Next()
			return
		}

		u, ok := user.(*models.User)
		if !ok {
			c.Next()
			return
		}

		allowed, err := m.service.CheckUserLimit(c.Request.Context(), u.ID)
		if err != nil {
			c.Next()
			return
		}

		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "user rate limit exceeded",
				"code":  "USER_RATE_LIMIT_EXCEEDED",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// APILimit API密钥限流
func (m *RateLimitMiddleware) APILimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			c.Next()
			return
		}

		allowed, err := m.service.CheckAPILimit(c.Request.Context(), apiKey)
		if err != nil {
			c.Next()
			return
		}

		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "api rate limit exceeded",
				"code":  "API_RATE_LIMIT_EXCEEDED",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
