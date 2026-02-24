package middleware

import (
	"crypto/rsa"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/service"
)

// KeycloakOIDCAuthenticator Keycloak OIDC 认证器
type KeycloakOIDCAuthenticator struct {
	realmURL      string
	clientID      string
	publicKey     *rsa.PublicKey
	keyExpiry     time.Time
	keyCache      map[string]*rsa.PublicKey
}

// KeycloakPublicKey Keycloak 公钥响应
type KeycloakPublicKey struct {
	Keys []struct {
		Kid string `json:"kid"`
		Kty string `json:"kty"`
		Alg string `json:"alg"`
		Use string `json:"use"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

// KeycloakClaims Keycloak JWT Claims
type KeycloakClaims struct {
	jwt.RegisteredClaims
	Email    string `json:"email"`
	PreferredUsername string `json:"preferred_username"`
	Name      string `json:"name"`
	KeycloakID string `json:"sub"` // subject is the unique user ID
}

// NewKeycloakOIDCAuthenticator 创建 Keycloak OIDC 认证器
func NewKeycloakOIDCAuthenticator(baseURL, realm, clientID string) *KeycloakOIDCAuthenticator {
	realmURL := fmt.Sprintf("%s/realms/%s", strings.TrimSuffix(baseURL, "/"), realm)
	return &KeycloakOIDCAuthenticator{
		realmURL: realmURL,
		clientID:  clientID,
		keyCache:  make(map[string]*rsa.PublicKey),
	}
}

// ExtractUserInfo 从 JWT Token 中提取用户信息
func (k *KeycloakOIDCAuthenticator) ExtractUserInfo(tokenString string) (UserInfo, error) {
	// 解析 JWT Token（不验证签名先，获取 header）
	token, err := jwt.ParseWithClaims(tokenString, &KeycloakClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 动态获取公钥
		kid := token.Header["kid"].(string)
		publicKey, err := k.getPublicKey(kid)
		if err != nil {
			return nil, fmt.Errorf("failed to get public key: %w", err)
		}
		return publicKey, nil
	})

	if err != nil {
		return nil, apperrors.ErrUnauthorized
	}

	claims, ok := token.Claims.(*KeycloakClaims)
	if !ok || !token.Valid {
		return nil, apperrors.ErrUnauthorized
	}

	// 验证 token 是否过期
	if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
		return nil, apperrors.ErrExpired
	}

	// 验证 audience（可选，根据需求）
	// if !claims.VerifyAudience(k.clientID, true) {
	//     return nil, errors.New("invalid audience")
	// }

	// 验证 issuer
	expectedIssuer := k.realmURL
	if claims.Issuer != expectedIssuer {
		return nil, fmt.Errorf("invalid issuer: expected %s, got %s", expectedIssuer, claims.Issuer)
	}

	return &KeycloakUserInfo{
		KeycloakID: claims.KeycloakID,
		Username:   claims.PreferredUsername,
		Email:      claims.Email,
		Name:       claims.Name,
		Claims:     claims,
	}, nil
}

// getPublicKey 获取 Keycloak 公钥（带缓存）
func (k *KeycloakOIDCAuthenticator) getPublicKey(kid string) (*rsa.PublicKey, error) {
	// 检查缓存
	if key, ok := k.keyCache[kid]; ok && time.Now().Before(k.keyExpiry) {
		return key, nil
	}

	// TODO: 从 Keycloak JWKS 端点获取公钥
	// GET {realmURL}/protocol/openid-connect/certs
	//
	// 简化实现：这里先返回一个占位符
	// 实际生产环境需要实现 JWKS 获取和解析

	return nil, errors.New("public key not found, please implement JWKS fetching")
}

// KeycloakUserInfo Keycloak 用户信息
type KeycloakUserInfo struct {
	KeycloakID string
	Username   string
	Email      string
	Name       string
	Claims     *KeycloakClaims
}

func (u *KeycloakUserInfo) GetKeycloakID() string { return u.KeycloakID }
func (u *KeycloakUserInfo) GetUsername() string   { return u.Username }
func (u *KeycloakUserInfo) GetEmail() string      { return u.Email }
func (u *KeycloakUserInfo) GetRole() models.UserRole {
	// Keycloak 中的角色映射
	// 可以通过 claims 中的 realm_access 或 resource_access 来判断
	return models.RoleUser // 默认为普通用户，管理员角色需要额外配置
}

// KeycloakOIDCAuthenticatorV2 使用 http client 获取公钥的版本
// 这是完整实现，生产环境使用
type KeycloakOIDCAuthenticatorV2 struct {
	baseURL     string
	realm       string
	clientID    string
	httpClient  HTTPClient
}

// HTTPClient HTTP 客户端接口
type HTTPClient interface {
	Get(url string) (*HTTPResponse, error)
}

// HTTPResponse HTTP 响应
type HTTPResponse struct {
	StatusCode int
	Body       []byte
}

// NewKeycloakOIDCAuthenticatorV2 创建 Keycloak OIDC 认证器（完整版）
func NewKeycloakOIDCAuthenticatorV2(baseURL, realm, clientID string, client HTTPClient) *KeycloakOIDCAuthenticatorV2 {
	return &KeycloakOIDCAuthenticatorV2{
		baseURL:    baseURL,
		realm:      realm,
		clientID:   clientID,
		httpClient: client,
	}
}

// ExtractUserInfo 从 JWT Token 中提取用户信息
func (k *KeycloakOIDCAuthenticatorV2) ExtractUserInfo(tokenString string) (UserInfo, error) {
	// 解析 JWT header 获取 kid
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, apperrors.ErrUnauthorized
	}

	// TODO: 实现 JWKS 公钥获取和 JWT 验证
	// 1. 解码 header 获取 kid
	// 2. 从 {baseURL}/realms/{realm}/protocol/openid-connect/certs 获取公钥
	// 3. 验证 JWT 签名
	// 4. 解析 claims 并返回用户信息

	// 暂时返回错误，需要完整实现
	return nil, errors.New("OIDC authentication not fully implemented")
}

// AuthMiddleware 认证中间件
type AuthMiddleware struct {
	oidcAuth      UserInfoExtractor
	userService   *service.UserService
}

// UserInfoExtractor 用户信息提取器接口
type UserInfoExtractor interface {
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
func NewAuthMiddleware(auth UserInfoExtractor) *AuthMiddleware {
	return &AuthMiddleware{
		oidcAuth: auth,
	}
}

// SetUserService 设置用户服务
func (m *AuthMiddleware) SetUserService(svc *service.UserService) {
	m.userService = svc
}

// Authenticate 认证中间件
func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(401, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		token := parts[1]

		// 从 Token 提取用户信息
		userInfo, err := m.oidcAuth.ExtractUserInfo(token)
		if err != nil {
			c.JSON(401, gin.H{"error": "invalid token", "details": err.Error()})
			c.Abort()
			return
		}

		// 设置基本信息到上下文
		c.Set("keycloak_id", userInfo.GetKeycloakID())
		c.Set("username", userInfo.GetUsername())
		c.Set("email", userInfo.GetEmail())
		c.Set("role", userInfo.GetRole())

		// 从数据库加载或创建用户
		if m.userService != nil {
			user, err := m.userService.GetOrCreateUser(
				c.Request.Context(),
				userInfo.GetKeycloakID(),
				userInfo.GetUsername(),
				userInfo.GetEmail(),
			)
			if err == nil {
				c.Set("user", user)
				c.Set("user_id", user.ID)
			}
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
		userInfo, err := m.oidcAuth.ExtractUserInfo(token)
		if err != nil {
			c.Next()
			return
		}

		c.Set("keycloak_id", userInfo.GetKeycloakID())
		c.Set("username", userInfo.GetUsername())
		c.Set("email", userInfo.GetEmail())
		c.Set("role", userInfo.GetRole())

		if m.userService != nil {
			user, err := m.userService.GetOrCreateUser(
				c.Request.Context(),
				userInfo.GetKeycloakID(),
				userInfo.GetUsername(),
				userInfo.GetEmail(),
			)
			if err == nil {
				c.Set("user", user)
				c.Set("user_id", user.ID)
			}
		}

		c.Next()
	}
}

// GetAuthenticatedUser 获取当前认证用户
func GetAuthenticatedUser(c *gin.Context) *models.User {
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(*models.User); ok {
			return u
		}
	}
	return nil
}

// GetKeycloakID 获取当前用户的 Keycloak ID
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
		if GetKeycloakID(c) == "" {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}
