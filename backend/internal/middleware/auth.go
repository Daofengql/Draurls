package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/models"
)

// RequireRole 角色验证中间件
func RequireRole(roles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("user")
		if !exists {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		u, ok := user.(*models.User)
		if !ok {
			c.JSON(401, gin.H{"error": "invalid user context"})
			c.Abort()
			return
		}

		// 检查角色
		hasRole := false
		for _, role := range roles {
			if u.Role == role {
				hasRole = true
				break
			}
		}

		if !hasRole {
			c.JSON(403, gin.H{"error": "forbidden"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAdmin 要求管理员权限
func RequireAdmin() gin.HandlerFunc {
	return RequireRole(models.RoleAdmin)
}

// CORS 跨域中间件
func CORS(allowOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// 检查是否在允许列表中
		allowed := false
		for _, allowedOrigin := range allowOrigins {
			if allowedOrigin == "*" || allowedOrigin == origin {
				allowed = true
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Signature, X-Timestamp, X-Nonce, X-API-Key")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
