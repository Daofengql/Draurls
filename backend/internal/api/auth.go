package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/config"
	"github.com/surls/backend/internal/response"
)

// AuthHandler 认证相关处理器
type AuthHandler struct {
	config    *config.Config
	secretKey []byte
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(cfg *config.Config) *AuthHandler {
	secretKey := []byte(cfg.Security.JWTSecret)
	return &AuthHandler{
		config:    cfg,
		secretKey: secretKey,
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

	// 构建 Keycloak 登录 URL
	authURL := h.buildKeycloakAuthURL(state)

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
// 3. 设置 HttpOnly Cookie（存储 token）
// 4. 返回 HTML 页面，该页面会通知父窗口并关闭弹窗
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
	tokenResp, err := h.requestTokenFromKeycloak(req.Code)
	if err != nil {
		h.renderCallbackPage(c, false, fmt.Sprintf("Failed to get token: %v", err), redirectTo)
		return
	}

	// 3. 设置 HttpOnly Cookie
	// Cookie 配置：
	// - HttpOnly: 始终启用，防止 XSS 攻击读取 Cookie
	// - Secure: HTTPS 时启用
	// - SameSite: 防止 CSRF 攻击
	cookieDomain := h.getCookieDomain(redirectTo)
	// 根据重定向 URL 判断是否使用 HTTPS
	secure := strings.HasPrefix(redirectTo, "https://")
	// 始终启用 HttpOnly，防止 XSS 攻击窃取 token
	httpOnly := true

	// 打印 token 过期时间（调试用）
	log.Printf("Setting access_token cookie: expires_in=%d seconds", tokenResp.ExpiresIn)

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		"access_token",          // Cookie 名称
		tokenResp.AccessToken,   // Token 值
		int(tokenResp.ExpiresIn),// 过期时间（秒）
		"/",                     // 路径
		cookieDomain,            // Domain
		secure,                  // Secure
		httpOnly,                // HttpOnly (debug 模式下关闭)
	)

	// 可选：同时设置 refresh_token cookie
	if tokenResp.RefreshToken != "" {
		// refresh_token 有效期通常更长（30天）
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(
			"refresh_token",
			tokenResp.RefreshToken,
			30*24*3600, // 30天
			"/",
			cookieDomain,
			secure,
			httpOnly,
		)
	}

	// 同时保存 id_token，用于获取用户信息（包含 nickname, picture 等）
	// id_token 的过期时间通常与 access_token 相同
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

	// 4. 返回 HTML 页面，通知父窗口登录成功
	h.renderCallbackPage(c, true, "Login successful", redirectTo)
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
func (h *AuthHandler) buildKeycloakAuthURL(state string) string {
	baseURL := strings.TrimSuffix(h.config.Keycloak.BaseURL, "/")
	realm := h.config.Keycloak.Realm
	authURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/auth", baseURL, realm)

	callbackURL := fmt.Sprintf("%s/api/auth/callback", h.config.Server.GetBaseURL())

	params := url.Values{}
	params.Set("client_id", h.config.Keycloak.ClientID)
	params.Set("redirect_uri", callbackURL)
	params.Set("response_type", "code")
	params.Set("scope", "openid profile email")
	params.Set("state", state)

	return fmt.Sprintf("%s?%s", authURL, params.Encode())
}

// requestTokenFromKeycloak 向 Keycloak 请求 Token
func (h *AuthHandler) requestTokenFromKeycloak(code string) (*TokenResponse, error) {
	baseURL := strings.TrimSuffix(h.config.Keycloak.BaseURL, "/")
	realm := h.config.Keycloak.Realm
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", baseURL, realm)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", h.config.Keycloak.ClientID)
	data.Set("client_secret", h.config.Keycloak.Secret)
	data.Set("code", code)
	// redirect_uri 必须与之前发送的一致
	callbackURL := fmt.Sprintf("%s/api/auth/callback", h.config.Server.GetBaseURL())
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
	RefreshToken string `json:"refresh_token" binding:"required"`
	RedirectTo   string `json:"redirect_to,omitempty"` // 用于获取正确的 Cookie domain
}

// Logout 登出
func (h *AuthHandler) Logout(c *gin.Context) {
	var req LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 调用 Keycloak 登出
	baseURL := strings.TrimSuffix(h.config.Keycloak.BaseURL, "/")
	realm := h.config.Keycloak.Realm
	logoutURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/logout", baseURL, realm)

	data := url.Values{}
	data.Set("client_id", h.config.Keycloak.ClientID)
	data.Set("client_secret", h.config.Keycloak.Secret)
	data.Set("refresh_token", req.RefreshToken)

	resp, err := http.PostForm(logoutURL, data)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		response.InternalError(c, "logout failed")
		return
	}

	// 清除 Cookie - 使用正确的参数
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
