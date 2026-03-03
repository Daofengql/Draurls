package api

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/auth"
	"github.com/surls/backend/internal/config"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// AuthHandler 认证相关处理器
type AuthHandler struct {
	config     *config.Config
	secretKey  []byte
	userService *service.UserService
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(cfg *config.Config, userService *service.UserService) *AuthHandler {
	secretKey := []byte(cfg.Security.JWTSecret)
	return &AuthHandler{
		config:     cfg,
		secretKey:  secretKey,
		userService: userService,
	}
}

// ==================== 请求/响应结构 ====================

// GetLoginURLRequest 获取登录 URL 请求
type GetLoginURLRequest struct {
	RedirectTo string `json:"redirect_to" binding:"required"` // 登录成功后要返回的页面
}

// GetLoginURLResponse 获取登录 URL 响应
type GetLoginURLResponse struct {
	LoginURL string `json:"login_url"` // Keycloak 登录 URL
	State    string `json:"state"`     // 状态参数（用于 CSRF 防护）
}

// KeycloakCallbackRequest Keycloak 回调请求
type KeycloakCallbackRequest struct {
	Code  string `form:"code" binding:"required"`
	State string `form:"state" binding:"required"`
}

// TokenResponse Token 响应
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType     string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
}

// ==================== 待确认用户存储 ====================

// PendingUser 待确认用户信息
type PendingUser struct {
	UserInfo      *auth.UserInfo
	TokenResponse *TokenResponse
	RedirectTo    string
	ExpiresAt     time.Time
}

// PendingUserStore 待确认用户存储（使用 sync.Map 保证并发安全）
type PendingUserStore struct {
	data sync.Map // key: sessionID, value: *PendingUser
}

// Store 存储待确认用户
func (s *PendingUserStore) Store(sessionID string, pending *PendingUser) {
	s.data.Store(sessionID, pending)
}

// Load 获取待确认用户
func (s *PendingUserStore) Load(sessionID string) (*PendingUser, bool) {
	value, ok := s.data.Load(sessionID)
	if !ok {
		return nil, false
	}
	return value.(*PendingUser), true
}

// Delete 删除待确认用户
func (s *PendingUserStore) Delete(sessionID string) {
	s.data.Delete(sessionID)
}

// 全局待确认用户存储
var globalPendingStore = &PendingUserStore{}

// ==================== API 端点 ====================

// GetLoginURL 获取登录 URL
//
// 前端调用此接口获取 Keycloak 登录 URL，然后打开弹窗跳转
//
// 流程：
// 1. 前端传入当前页面 URL（redirect_to）
// 2. 后端生成 state（包含 redirect_to 和签名）
// 3. 后端返回 Keycloak 授权 URL
// 4. 前端用 window.open() 打开弹窗
func (h *AuthHandler) GetLoginURL(c *gin.Context) {
	var req GetLoginURLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 如果是相对路径，补全为完整 URL
	redirectTo := req.RedirectTo
	if strings.HasPrefix(redirectTo, "/") {
		redirectTo = fmt.Sprintf("%s%s", h.config.Server.GetBaseURL(), redirectTo)
	}

	// 验证 redirect_to 格式（防止开放重定向攻击）
	if !h.isValidRedirectURL(redirectTo) {
		response.BadRequest(c, "invalid redirect_to URL: "+redirectTo)
		return
	}

	// 生成 state = base64(redirect_to|timestamp|signature)
	state := h.buildState(redirectTo)

	// 构建 Keycloak 登录 URL（传入 redirectTo 以获取正确的 origin）
	authURL := h.buildKeycloakAuthURL(state, redirectTo)

	response.Success(c, GetLoginURLResponse{
		LoginURL: authURL,
		State:    state,
	})
}

// KeycloakCallback Keycloak 回调处理
//
// 此端点由 Keycloak 在用户登录成功后回调
//
// 流程：
// 1. 验证 state 参数（防止 CSRF 攻击）
// 2. 用授权码换取 Token
// 3. 检查用户是否已存在
// 4. 如果是第一个用户（管理员）或已存在用户，设置 Cookie 并返回成功页面
// 5. 如果是新用户，显示授权确认页面
func (h *AuthHandler) KeycloakCallback(c *gin.Context) {
	var req KeycloakCallbackRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		h.renderCallbackPage(c, false, "Invalid request", "")
		return
	}

	// 1. 验证 state，获取原始页面 URL
	redirectTo, err := h.verifyState(req.State)
	if err != nil {
		h.renderCallbackPage(c, false, fmt.Sprintf("Invalid state: %v", err), "")
		return
	}

	// 2. 用授权码换取 Token
	tokenResp, err := h.requestTokenFromKeycloak(req.Code, redirectTo)
	if err != nil {
		h.renderCallbackPage(c, false, fmt.Sprintf("Failed to get token: %v", err), redirectTo)
		return
	}

	// 3. 检查用户是否已存在
	userInfo, userExists, isFirstUser, err := h.checkUserExists(tokenResp.IDToken)
	if err != nil {
		log.Printf("Error checking user: %v", err)
		// 出错时继续流程，让中间件处理
	}

	// 4a. 如果用户已存在，直接设置 Cookie 并返回成功
	if userExists {
		h.setAuthCookies(c, tokenResp, redirectTo)
		h.renderCallbackPage(c, true, "Login successful", redirectTo)
		return
	}

	// 4b. 如果是第一个用户（管理员），直接注册，不显示确认页面
	if isFirstUser {
		h.setAuthCookies(c, tokenResp, redirectTo)
		h.renderCallbackPage(c, true, "Admin account created", redirectTo)
		return
	}

	// 5. 新用户：生成 session ID 并存储待确认信息
	sessionID := generateSessionID()
	globalPendingStore.Store(sessionID, &PendingUser{
		UserInfo:      userInfo,
		TokenResponse: tokenResp,
		RedirectTo:    redirectTo,
		ExpiresAt:     time.Now().Add(5 * time.Minute),
	})

	// 6. 渲染授权确认页面
	h.renderConsentPage(c, sessionID, userInfo, redirectTo)
}

// ==================== 辅助方法 ====================

// buildState 构建安全的 state 参数
// 格式: base64(redirect_to|timestamp|signature)
func (h *AuthHandler) buildState(redirectTo string) string {
	timestamp := time.Now().Unix()

	// 构建待签名数据: redirect_to|timestamp
	data := fmt.Sprintf("%s|%d", redirectTo, timestamp)

	// 计算签名
	signature := h.sign(data)

	// state 格式: base64(data|signature)
	stateData := data + "|" + signature
	state := base64.URLEncoding.EncodeToString([]byte(stateData))

	return state
}

// verifyState 验证 state 参数
// 返回: redirect_to, error
func (h *AuthHandler) verifyState(state string) (string, error) {
	// Base64 解码
	stateBytes, err := base64.URLEncoding.DecodeString(state)
	if err != nil {
		return "", fmt.Errorf("invalid state encoding: %w", err)
	}

	// 解析: redirect_to|timestamp|signature
	parts := strings.Split(string(stateBytes), "|")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid state format, expected 3 parts, got %d", len(parts))
	}

	redirectTo := parts[0]
	timestampStr := parts[1]
	actualSignature := parts[2]

	var timestamp int64
	_, err = fmt.Sscanf(timestampStr, "%d", &timestamp)
	if err != nil {
		return "", fmt.Errorf("invalid timestamp format: %w", err)
	}

	// 检查时间戳（5分钟内有效）
	if time.Now().Unix()-timestamp > 300 {
		return "", fmt.Errorf("state expired, max 5 minutes")
	}

	// 重新计算签名验证
	data := fmt.Sprintf("%s|%d", redirectTo, timestamp)
	expectedSignature := h.sign(data)

	if actualSignature != expectedSignature {
		return "", fmt.Errorf("invalid state signature")
	}

	return redirectTo, nil
}

// sign HMAC SHA256 签名
func (h *AuthHandler) sign(data string) string {
	mac := hmac.New(sha256.New, h.secretKey)
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

// buildKeycloakAuthURL 构建 Keycloak 认证 URL
func (h *AuthHandler) buildKeycloakAuthURL(state string, redirectTo string) string {
	baseURL := strings.TrimSuffix(h.config.Keycloak.BaseURL, "/")
	realm := h.config.Keycloak.Realm
	authURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/auth", baseURL, realm)

	// 从 redirectTo 提取 origin 作为 callback URL
	// 如果 redirectTo 是完整 URL，使用它的 origin；否则使用配置的 BaseURL
	callbackOrigin := h.config.Server.GetBaseURL()
	if strings.HasPrefix(redirectTo, "http://") || strings.HasPrefix(redirectTo, "https://") {
		if parsedURL, err := url.Parse(redirectTo); err == nil {
			callbackOrigin = fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
		}
	}
	callbackURL := fmt.Sprintf("%s/api/auth/callback", callbackOrigin)

	params := url.Values{}
	params.Set("client_id", h.config.Keycloak.ClientID)
	params.Set("redirect_uri", callbackURL)
	params.Set("response_type", "code")
	params.Set("scope", "openid profile email")
	params.Set("state", state)

	return fmt.Sprintf("%s?%s", authURL, params.Encode())
}

// requestTokenFromKeycloak 向 Keycloak 请求 Token
func (h *AuthHandler) requestTokenFromKeycloak(code string, redirectTo string) (*TokenResponse, error) {
	baseURL := strings.TrimSuffix(h.config.Keycloak.BaseURL, "/")
	realm := h.config.Keycloak.Realm
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", baseURL, realm)

	// 从 redirectTo 提取 origin 作为 callback URL（必须与登录时的 redirect_uri 一致）
	callbackOrigin := h.config.Server.GetBaseURL()
	if strings.HasPrefix(redirectTo, "http://") || strings.HasPrefix(redirectTo, "https://") {
		if parsedURL, err := url.Parse(redirectTo); err == nil {
			callbackOrigin = fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
		}
	}
	callbackURL := fmt.Sprintf("%s/api/auth/callback", callbackOrigin)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", h.config.Keycloak.ClientID)
	data.Set("client_secret", h.config.Keycloak.Secret)
	data.Set("code", code)
	data.Set("redirect_uri", callbackURL)

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to request token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token request failed with status %d", resp.StatusCode)
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// renderCallbackPage 渲染回调页面
// 此页面会通过 postMessage 通知父窗口，然后关闭自身
func (h *AuthHandler) renderCallbackPage(c *gin.Context, success bool, message, redirectTo string) {
	c.HTML(http.StatusOK, "callback.html", gin.H{
		"Success":     success,
		"Message":     message,
		"RedirectTo":  redirectTo,
	})
}

// isValidRedirectURL 验证重定向 URL 是否有效
// 防止开放重定向攻击
func (h *AuthHandler) isValidRedirectURL(urlStr string) bool {
	if urlStr == "" {
		return false
	}

	// 解析 URL
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return false
	}

	// 只允许 http 和 https 协议
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return false
	}

	// 开发阶段允许 localhost 和 127.0.0.1
	host := parsedURL.Host
	if strings.Contains(host, ":") {
		host, _, _ = strings.Cut(host, ":")
	}

	allowedHosts := []string{"localhost", "127.0.0.1"}
	for _, allowed := range allowedHosts {
		if host == allowed {
			return true
		}
	}

	// 生产环境：允许与 BaseURL 同域的请求
	baseURL := h.config.Server.GetBaseURL()
	if baseURL != "" {
		if parsedBaseURL, err := url.Parse(baseURL); err == nil {
			if parsedURL.Host == parsedBaseURL.Host {
				return true
			}
		}
	}

	// 默认拒绝，防止开放重定向攻击
	// 如需允许其他域名，请在配置中添加 ALLOWED_REDIRECT_ORIGINS
	return false
}

// getCookieDomain 获取 Cookie 域名
func (h *AuthHandler) getCookieDomain(redirectTo string) string {
	// 解析重定向 URL 获取域名
	parsedURL, err := url.Parse(redirectTo)
	if err != nil {
		return ""
	}

	host := parsedURL.Host
	// 移除端口号
	if strings.Contains(host, ":") {
		host, _, _ = strings.Cut(host, ":")
	}

	// localhost 不设置 domain
	if host == "localhost" || host == "127.0.0.1" {
		return ""
	}

	return host
}

// generateSessionID 生成随机会话 ID
func generateSessionID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// extractUserInfo 从 id_token 中提取用户信息
func (h *AuthHandler) extractUserInfo(idToken string) (*auth.UserInfo, error) {
	// 使用 auth 包的 ExtractUserInfoFromToken 函数
	return auth.ExtractUserInfoFromToken(idToken)
}

// checkUserExists 检查用户是否已存在，返回 (用户信息, 是否已存在, 是否为第一个用户, 错误)
func (h *AuthHandler) checkUserExists(idToken string) (*auth.UserInfo, bool, bool, error) {
	userInfo, err := h.extractUserInfo(idToken)
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to extract user info: %w", err)
	}

	// 检查用户是否已存在
	_, err = h.userService.GetByKeycloakID(context.Background(), userInfo.KeycloakID)
	if err == nil {
		// 用户已存在
		return userInfo, true, false, nil
	}

	// 用户不存在，检查是否为系统第一个用户
	count, err := h.userService.CountUsers(context.Background())
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to count users: %w", err)
	}

	// 如果是第一个用户（count == 0），不显示确认页面
	isFirstUser := (count == 0)

	return userInfo, false, isFirstUser, nil
}

// setAuthCookies 设置认证 Cookie
func (h *AuthHandler) setAuthCookies(c *gin.Context, tokenResp *TokenResponse, redirectTo string) {
	cookieDomain := h.getCookieDomain(redirectTo)
	secure := strings.HasPrefix(redirectTo, "https://")
	httpOnly := true

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		"access_token",
		tokenResp.AccessToken,
		int(tokenResp.ExpiresIn),
		"/",
		cookieDomain,
		secure,
		httpOnly,
	)

	if tokenResp.RefreshToken != "" {
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(
			"refresh_token",
			tokenResp.RefreshToken,
			30*24*3600,
			"/",
			cookieDomain,
			secure,
			httpOnly,
		)
	}

	if tokenResp.IDToken != "" {
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(
			"id_token",
			tokenResp.IDToken,
			int(tokenResp.ExpiresIn),
			"/",
			cookieDomain,
			secure,
			httpOnly,
		)
	}
}

// renderConsentPage 渲染授权确认页面
func (h *AuthHandler) renderConsentPage(c *gin.Context, sessionID string, userInfo *auth.UserInfo, redirectTo string) {
	// TODO: 从配置中读取站点名称
	siteName := "短链接系统"

	c.HTML(http.StatusOK, "consent.html", gin.H{
		"SessionID":  sessionID,
		"SiteName":   siteName,
		"Username":   userInfo.Username,
		"Email":      userInfo.Email,
		"RedirectTo": redirectTo,
	})
}

// ==================== Token 刷新和登出（可选） ====================

// RefreshTokenRequest 刷新 Token 请求
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// RefreshToken 刷新 Token
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	tokenResp, err := h.refreshTokenFromKeycloak(req.RefreshToken)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, tokenResp)
}

// refreshTokenFromKeycloak 向 Keycloak 刷新 Token
func (h *AuthHandler) refreshTokenFromKeycloak(refreshToken string) (*TokenResponse, error) {
	baseURL := strings.TrimSuffix(h.config.Keycloak.BaseURL, "/")
	realm := h.config.Keycloak.Realm
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", baseURL, realm)

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("client_id", h.config.Keycloak.ClientID)
	data.Set("client_secret", h.config.Keycloak.Secret)
	data.Set("refresh_token", refreshToken)

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token refresh failed with status %d", resp.StatusCode)
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// LogoutRequest 登出请求
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"` // 可选，优先从 Cookie 读取
	RedirectTo   string `json:"redirect_to,omitempty"` // 用于获取正确的 Cookie domain
}

// Logout 登出
func (h *AuthHandler) Logout(c *gin.Context) {
	var req LogoutRequest
	c.ShouldBindJSON(&req) // refresh_token 不再必需，允许空 body

	// 优先从 Cookie 读取 refresh_token
	refreshToken := req.RefreshToken
	if refreshToken == "" {
		if rt, err := c.Cookie("refresh_token"); err == nil && rt != "" {
			refreshToken = rt
		}
	}

	// 调用 Keycloak 登出（如果有 refresh_token）
	if refreshToken != "" {
		baseURL := strings.TrimSuffix(h.config.Keycloak.BaseURL, "/")
		realm := h.config.Keycloak.Realm
		logoutURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/logout", baseURL, realm)

		data := url.Values{}
		data.Set("client_id", h.config.Keycloak.ClientID)
		data.Set("client_secret", h.config.Keycloak.Secret)
		data.Set("refresh_token", refreshToken)

		resp, err := http.PostForm(logoutURL, data)
		if err != nil {
			// Keycloak 登出失败，但仍然清除本地 Cookie
			log.Printf("Keycloak logout failed: %v", err)
		} else {
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
				log.Printf("Keycloak logout returned status: %d", resp.StatusCode)
			}
		}
	}

	// 清除 Cookie - 无论 Keycloak 登出是否成功都清除
	// 从 RedirectTo 或 Referer 获取域名信息
	cookieDomain := ""
	secure := strings.HasPrefix(h.config.Server.GetBaseURL(), "https://")

	redirectTo := req.RedirectTo
	if redirectTo == "" {
		redirectTo = c.GetHeader("Referer")
	}
	if redirectTo != "" {
		cookieDomain = h.getCookieDomain(redirectTo)
		// 根据重定向 URL 判断是否使用 HTTPS
		secure = strings.HasPrefix(redirectTo, "https://")
	}

	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("access_token", "", -1, "/", cookieDomain, secure, true)
	c.SetCookie("id_token", "", -1, "/", cookieDomain, secure, true)
	c.SetCookie("refresh_token", "", -1, "/", cookieDomain, secure, true)

	response.Success(c, gin.H{"message": "logged out successfully"})
}

// ==================== 注册确认处理器 ====================

// ConfirmRegistrationHandler 注册确认处理器
type ConfirmRegistrationHandler struct {
	config     *config.Config
	secretKey  []byte
	userService *service.UserService
}

// NewConfirmRegistrationHandler 创建注册确认处理器
func NewConfirmRegistrationHandler(cfg *config.Config, userService *service.UserService) *ConfirmRegistrationHandler {
	secretKey := []byte(cfg.Security.JWTSecret)
	return &ConfirmRegistrationHandler{
		config:     cfg,
		secretKey:  secretKey,
		userService: userService,
	}
}

// ConfirmRegistrationRequest 确认注册请求
type ConfirmRegistrationRequest struct {
	SessionID string `json:"session_id" binding:"required"`
}

// ConfirmRegistration 确认注册
func (h *ConfirmRegistrationHandler) ConfirmRegistration(c *gin.Context) {
	var req ConfirmRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 从存储中获取待确认用户信息
	value, ok := globalPendingStore.data.Load(req.SessionID)
	if !ok {
		response.BadRequest(c, "Invalid or expired session")
		return
	}

	pendingUser := value.(*PendingUser)

	// 检查是否过期
	if time.Now().After(pendingUser.ExpiresAt) {
		globalPendingStore.data.Delete(req.SessionID)
		response.BadRequest(c, "Session expired")
		return
	}

	// 设置 Cookie（用户将由认证中间件自动创建）
	h.setAuthCookies(c, pendingUser.TokenResponse, pendingUser.RedirectTo)

	// 清理存储
	globalPendingStore.data.Delete(req.SessionID)

	response.Success(c, gin.H{
		"message": "Registration successful",
		"redirect_to": pendingUser.RedirectTo,
	})
}

// CancelRegistration 取消注册
func (h *ConfirmRegistrationHandler) CancelRegistration(c *gin.Context) {
	var req ConfirmRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	value, ok := globalPendingStore.data.Load(req.SessionID)
	if !ok {
		response.BadRequest(c, "Invalid session")
		return
	}

	pendingUser := value.(*PendingUser)

	// 记录取消日志
	log.Printf("Registration cancelled: keycloak_id=%s, email=%s",
		pendingUser.UserInfo.KeycloakID, pendingUser.UserInfo.Email)

	// 清理存储
	globalPendingStore.data.Delete(req.SessionID)

	response.Success(c, gin.H{
		"message": "Registration cancelled",
	})
}

// setAuthCookies 设置认证 Cookie（复制自 AuthHandler）
func (h *ConfirmRegistrationHandler) setAuthCookies(c *gin.Context, tokenResp *TokenResponse, redirectTo string) {
	cookieDomain := h.getCookieDomainFromURL(redirectTo)
	secure := strings.HasPrefix(redirectTo, "https://")
	httpOnly := true

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		"access_token",
		tokenResp.AccessToken,
		int(tokenResp.ExpiresIn),
		"/",
		cookieDomain,
		secure,
		httpOnly,
	)

	if tokenResp.RefreshToken != "" {
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(
			"refresh_token",
			tokenResp.RefreshToken,
			30*24*3600,
			"/",
			cookieDomain,
			secure,
			httpOnly,
		)
	}

	if tokenResp.IDToken != "" {
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(
			"id_token",
			tokenResp.IDToken,
			int(tokenResp.ExpiresIn),
			"/",
			cookieDomain,
			secure,
			httpOnly,
		)
	}
}

// getCookieDomainFromURL 从 URL 获取 Cookie 域名
func (h *ConfirmRegistrationHandler) getCookieDomainFromURL(urlStr string) string {
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return ""
	}

	host := parsedURL.Host
	if strings.Contains(host, ":") {
		host, _, _ = strings.Cut(host, ":")
	}

	if host == "localhost" || host == "127.0.0.1" {
		return ""
	}

	return host
}
