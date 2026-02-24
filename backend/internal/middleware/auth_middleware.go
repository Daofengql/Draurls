package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// AuthMiddleware 认证中间件
type AuthMiddleware struct {
	keycloakAuth KeycloakAuthenticator
	userRepo     *repository.UserRepository
}

// KeycloakAuthenticator Keycloak认证器接口
type KeycloakAuthenticator interface {
	ExtractUserInfo(tokenString string) (UserInfo, error)
}

// UserInfo 用户信息接口
type UserInfo interface {
	GetKeycloakID() string
	GetUsername() string
	GetEmail() string
	GetRole() models.UserRole
}

// NewAuthMiddleware 创建认证中间件
func NewAuthMiddleware(auth KeycloakAuthenticator) *AuthMiddleware {
	return &AuthMiddleware{
		keycloakAuth: auth,
	}
}

// SetUserRepository 设置用户仓库（用于加载完整用户信息）
func (m *AuthMiddleware) SetUserRepository(repo *repository.UserRepository) {
	m.userRepo = repo
}

// Authenticate 认证中间件
func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从Authorization头获取Token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		// Bearer Token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(401, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		token := parts[1]

		// 从Token中提取用户信息
		userInfo, err := m.keycloakAuth.ExtractUserInfo(token)
		if err != nil {
			c.JSON(401, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// 将用户信息存入上下文
		c.Set("keycloak_id", userInfo.GetKeycloakID())
		c.Set("username", userInfo.GetUsername())
		c.Set("email", userInfo.GetEmail())
		c.Set("role", userInfo.GetRole())

		// 如果有 UserRepository，从数据库加载完整用户信息
		if m.userRepo != nil {
			user, err := m.userRepo.FindByKeycloakID(c.Request.Context(), userInfo.GetKeycloakID())
			if err == nil {
				c.Set("user", user)
				c.Set("user_id", user.ID)
			}
			// 如果数据库中没有用户记录，继续处理请求（可能需要自动创建用户）
		}

		c.Next()
	}
}

// OptionalAuth 可选认证中间件
func (m *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		token := parts[1]
		userInfo, err := m.keycloakAuth.ExtractUserInfo(token)
		if err == nil {
			c.Set("keycloak_id", userInfo.GetKeycloakID())
			c.Set("username", userInfo.GetUsername())
			c.Set("email", userInfo.GetEmail())
			c.Set("role", userInfo.GetRole())

			// 如果有 UserRepository，从数据库加载完整用户信息
			if m.userRepo != nil {
				user, err := m.userRepo.FindByKeycloakID(c.Request.Context(), userInfo.GetKeycloakID())
				if err == nil {
					c.Set("user", user)
					c.Set("user_id", user.ID)
				}
			}
		}

		c.Next()
	}
}

// MockAuthenticator 模拟认证器（用于开发测试）
type MockAuthenticator struct {
	users map[string]*MockUser
}

type MockUser struct {
	KeycloakID string
	Username   string
	Email      string
	Role       models.UserRole
}

func NewMockAuthenticator() *MockAuthenticator {
	return &MockAuthenticator{
		users: map[string]*MockUser{
			"admin-token": {
				KeycloakID: "admin",
				Username:   "admin",
				Email:      "admin@surls.local",
				Role:       models.RoleAdmin,
			},
			"user-token": {
				KeycloakID: "user123",
				Username:   "testuser",
				Email:      "user@surls.local",
				Role:       models.RoleUser,
			},
		},
	}
}

func (m *MockAuthenticator) ExtractUserInfo(tokenString string) (UserInfo, error) {
	user, ok := m.users[tokenString]
	if !ok {
		return nil, apperrors.ErrUnauthorized
	}
	return user, nil
}

func (u *MockUser) GetKeycloakID() string { return u.KeycloakID }
func (u *MockUser) GetUsername() string   { return u.Username }
func (u *MockUser) GetEmail() string      { return u.Email }
func (u *MockUser) GetRole() models.UserRole { return u.Role }

// GetAuthenticatedUser 获取当前认证用户
func GetAuthenticatedUser(c *gin.Context) *models.User {
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(*models.User); ok {
			return u
		}
	}
	return nil
}

// GetKeycloakID 获取当前用户的Keycloak ID
func GetKeycloakID(c *gin.Context) string {
	if id, exists := c.Get("keycloak_id"); exists {
		if idStr, ok := id.(string); ok {
			return idStr
		}
	}
	return ""
}

// RequireAuth 检查是否已认证
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		keycloakID := GetKeycloakID(c)
		if keycloakID == "" {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}
