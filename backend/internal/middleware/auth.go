package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/models"
)

// RequireRole 角色验证中间件
func RequireRole(roles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文获取角色
		role, exists := c.Get("role")
		if !exists {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		userRole, ok := role.(models.UserRole)
		if !ok {
			c.JSON(401, gin.H{"error": "invalid user context"})
			c.Abort()
			return
		}

		// 检查角色
		hasRole := false
		for _, r := range roles {
			if userRole == r {
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
// 支持 CORS 安全规范：当 AllowCredentials 为 true 时，不能使用 * 通配符
func CORS(allowOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			// 非 CORS 请求（如同源请求），直接放行
			c.Next()
			return
		}

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
			// CORS 安全：当配置了通配符时，不启用 Credentials
			if hasWildcard {
				c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
				// 不设置 Allow-Credentials，避免违反 CORS 规范
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
