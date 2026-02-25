package middleware

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
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
	httpClient    *http.Client
	publicKey     *rsa.PublicKey
	keyExpiry     time.Time
	keyCache      map[string]*rsa.PublicKey
}

// JWKSResponse JSON Web Key Set 响应
type JWKSResponse struct {
	Keys []JWK `json:"keys"`
}

// JWK JSON Web Key
type JWK struct {
	Kid string `json:"kid"` // Key ID
	Kty string `json:"kty"` // Key Type (RSA)
	Alg string `json:"alg"` // Algorithm (RS256)
	N   string `json:"n"`   // Modulus (Base64 URL encoded)
	E   string `json:"e"`   // Exponent (Base64 URL encoded)
	Use string `json:"use"` // Public key use (sig)
}

// KeycloakClaims Keycloak JWT Claims
type KeycloakClaims struct {
	jwt.RegisteredClaims
	Email            string `json:"email"`
	PreferredUsername string `json:"preferred_username"`
	Name             string `json:"name"`
	Nickname         string `json:"nickname"`
	Picture          string `json:"picture"`
	KeycloakID       string `json:"sub"` // subject is unique user ID
	RealmAccess      map[string]interface{} `json:"realm_access,omitempty"` // 角色信息
}

// NewKeycloakOIDCAuthenticator 创建 Keycloak OIDC 认证器
func NewKeycloakOIDCAuthenticator(baseURL, realm, clientID string) *KeycloakOIDCAuthenticator {
	realmURL := fmt.Sprintf("%s/realms/%s", strings.TrimSuffix(baseURL, "/"), realm)
	return &KeycloakOIDCAuthenticator{
		realmURL:  realmURL,
		clientID:  clientID,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		keyCache:  make(map[string]*rsa.PublicKey),
	}
}

// ExtractUserInfo 从 JWT Token 中提取用户信息
func (k *KeycloakOIDCAuthenticator) ExtractUserInfo(tokenString string) (UserInfo, error) {
	// 解析 JWT header 获取 kid
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, apperrors.ErrUnauthorized
	}

	headerB64 := parts[0]
	// 添加 padding 如果需要
	if len(headerB64)%4 != 0 {
		headerB64 += strings.Repeat("=", 4-len(headerB64)%4)
	}

	headerBytes, err := base64.URLEncoding.DecodeString(headerB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header: %w", err)
	}

	var header map[string]interface{}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("failed to unmarshal header: %w", err)
	}

	kid, ok := header["kid"].(string)
	if !ok {
		return nil, apperrors.ErrUnauthorized
	}

	// 获取公钥
	publicKey, err := k.getPublicKey(kid)
	if err != nil {
		return nil, err
	}

	// 验证 JWT Token
	token, err := jwt.ParseWithClaims(tokenString, &KeycloakClaims{}, func(token *jwt.Token) (interface{}, error) {
		return publicKey, nil
	})

	if err != nil || !token.Valid {
		return nil, apperrors.ErrUnauthorized
	}

	claims, ok := token.Claims.(*KeycloakClaims)
	if !ok {
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

	// 从 realm_access 提取角色
	role := k.extractRole(claims.RealmAccess)

	// 处理 Nickname 和 Picture
	// Keycloak 默认不返回 nickname 和 picture 字段
	// 如果 nickname 为空，使用 name 或 preferred_username 作为 fallback
	nickname := claims.Nickname
	if nickname == "" {
		if claims.Name != "" {
			nickname = claims.Name
		} else {
			nickname = claims.PreferredUsername
		}
	}

	return &KeycloakUserInfo{
		KeycloakID: claims.KeycloakID,
		Username:   claims.PreferredUsername,
		Email:      claims.Email,
		Name:       claims.Name,
		Nickname:   nickname,
		Picture:    claims.Picture, // Keycloak 默认不返回此字段
		Claims:     claims,
		Role:       role,
	}, nil
}

// extractRole 从 realm_access 提取角色
func (k *KeycloakOIDCAuthenticator) extractRole(realmAccess map[string]interface{}) models.UserRole {
	if realmAccess == nil {
		return models.RoleUser // 默认为普通用户
	}

	// 检查是否有管理员角色
	// Keycloak 默认角色: realm_admin, user, admin, offline_access
	roles, ok := realmAccess["roles"]
	if !ok {
		return models.RoleUser
	}

	roleList, ok := roles.([]interface{})
	if !ok {
		return models.RoleUser
	}

	for _, r := range roleList {
		if roleStr, ok := r.(string); ok {
			if roleStr == "realm_admin" || roleStr == "admin" {
				return models.RoleAdmin
			}
		}
	}

	return models.RoleUser
}

// getPublicKey 获取 Keycloak 公钥（带缓存和 JWKS 获取）
func (k *KeycloakOIDCAuthenticator) getPublicKey(kid string) (*rsa.PublicKey, error) {
	// 检查缓存
	if key, ok := k.keyCache[kid]; ok && time.Now().Before(k.keyExpiry) {
		return key, nil
	}

	// 从 Keycloak JWKS 端点获取公钥
	jwksURL := fmt.Sprintf("%s/protocol/openid-connect/certs", k.realmURL)

	req, err := http.NewRequest("GET", jwksURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	var jwks JWKSResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("failed to decode JWKS: %w", err)
	}

	// 找到对应的 key
	var jwk *JWK
	for _, key := range jwks.Keys {
		if key.Kid == kid {
			jwk = &key
			break
		}
	}

	if jwk == nil {
		return nil, fmt.Errorf("key with kid %s not found in JWKS", kid)
	}

	// 解析 RSA 公钥
	publicKey, err := k.parseRSAPublicKey(jwk)
	if err != nil {
		return nil, fmt.Errorf("failed to parse RSA public key: %w", err)
	}

	// 缓存公钥，设置过期时间（Keycloak 默认 24 小时轮换）
	k.keyCache[kid] = publicKey
	k.keyExpiry = time.Now().Add(24 * time.Hour)

	return publicKey, nil
}

// parseRSAPublicKey 从 JWK 解析 RSA 公钥
func (k *KeycloakOIDCAuthenticator) parseRSAPublicKey(jwk *JWK) (*rsa.PublicKey, error) {
	// 解码 modulus (n)
	nBytes, err := base64.RawURLEncoding.DecodeString(jwk.N)
	if err != nil {
		return nil, fmt.Errorf("failed to decode modulus: %w", err)
	}

	n := new(big.Int).SetBytes(nBytes)

	// 解码 exponent (e)，通常是很小的数字，如 65537 (0x10001)
	eBytes, err := base64.RawURLEncoding.DecodeString(jwk.E)
	if err != nil {
		return nil, fmt.Errorf("failed to decode exponent: %w", err)
	}

	eInt := new(big.Int).SetBytes(eBytes)

	// 构建 RSA 公钥
	pubKey := &rsa.PublicKey{
		N: n,
		E: int(eInt.Int64()),
	}

	return pubKey, nil
}

// KeycloakUserInfo Keycloak 用户信息
type KeycloakUserInfo struct {
	KeycloakID string
	Username   string
	Email      string
	Name       string
	Nickname   string
	Picture    string
	Claims     *KeycloakClaims
	Role       models.UserRole
}

func (u *KeycloakUserInfo) GetKeycloakID() string { return u.KeycloakID }
func (u *KeycloakUserInfo) GetUsername() string   { return u.Username }
func (u *KeycloakUserInfo) GetEmail() string      { return u.Email }
func (u *KeycloakUserInfo) GetRole() models.UserRole { return u.Role }
func (u *KeycloakUserInfo) GetNickname() string  { return u.Nickname }
func (u *KeycloakUserInfo) GetPicture() string   { return u.Picture }

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
	GetNickname() string
	GetPicture() string
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
// 支持 Authorization header 和 Cookie (优先使用 id_token，其次是 access_token)
func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// 1. 首先尝试从 Authorization header 获取
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}

		// 2. 如果 header 中没有，尝试从 Cookie 获取
		// 优先使用 id_token（包含 nickname, picture 等用户信息）
		if token == "" {
			if idToken, err := c.Cookie("id_token"); err == nil && idToken != "" {
				token = idToken
			} else if accessToken, err := c.Cookie("access_token"); err == nil && accessToken != "" {
				token = accessToken
			}
		}

		// 3. 仍然没有 token，返回 401
		if token == "" {
			c.JSON(401, gin.H{"error": "missing authorization token"})
			c.Abort()
			return
		}

		// 从 Token 提取用户信息
		userInfo, err := m.oidcAuth.ExtractUserInfo(token)
		if err != nil {
			c.JSON(401, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// 设置基本信息到上下文
		c.Set("keycloak_id", userInfo.GetKeycloakID())
		c.Set("username", userInfo.GetUsername())
		c.Set("email", userInfo.GetEmail())

		// 从数据库加载或创建用户
		if m.userService != nil {
			user, err := m.userService.GetOrCreateUser(
				c.Request.Context(),
				userInfo.GetKeycloakID(),
				userInfo.GetUsername(),
				userInfo.GetEmail(),
				userInfo.GetNickname(),
				userInfo.GetPicture(),
			)
			if err == nil {
				c.Set("user", user)
				c.Set("user_id", user.ID)
				// 使用数据库中的角色，而不是 JWT 中的角色
				c.Set("role", user.Role)
			} else {
				// 如果数据库加载失败，使用 JWT 中的角色作为 fallback
				c.Set("role", userInfo.GetRole())
			}
		} else {
			// 如果没有 userService，使用 JWT 中的角色
			c.Set("role", userInfo.GetRole())
		}

		c.Next()
	}
}

// OptionalAuth 可选认证中间件
// 支持 Authorization header 和 Cookie (优先使用 id_token，其次是 access_token)
func (m *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// 1. 首先尝试从 Authorization header 获取
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}

		// 2. 如果 header 中没有，尝试从 Cookie 获取
		// 优先使用 id_token（包含 nickname, picture 等用户信息）
		if token == "" {
			if idToken, err := c.Cookie("id_token"); err == nil && idToken != "" {
				token = idToken
			} else if accessToken, err := c.Cookie("access_token"); err == nil && accessToken != "" {
				token = accessToken
			}
		}

		// 3. 没有 token，直接继续
		if token == "" {
			c.Next()
			return
		}
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
				userInfo.GetNickname(),
				userInfo.GetPicture(),
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
