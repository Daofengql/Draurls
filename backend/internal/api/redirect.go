package api

import (
	"context"
	"encoding/json"
	"errors"
	"html/template"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
	"github.com/surls/backend/pkg/cache"
	"github.com/surls/backend/pkg/urlutil"
)

// cachedTemplate 缓存的模板
type cachedTemplate struct {
	content  string
	expireAt time.Time
}

// RedirectHandler 跳转处理器
type RedirectHandler struct {
	linkService       *service.LinkService
	domainService     *service.DomainService
	cache             *cache.LinkCache
	rateLimiter       *cache.RateLimitService
	redisClient       *redis.Client
	configService     *service.ConfigService
	templateService   *service.TemplateService
	siteConfig        map[string]string
	siteConfigMu      sync.RWMutex
	lastConfigCheck   time.Time // 记录上一次更新配置的时间，避免频繁抢占写锁
	templateCache     sync.Map  // 模板缓存: key(uint/string) -> *cachedTemplate
	templateCacheTTL  time.Duration // 模板缓存过期时间（默认 10 分钟）
}

// 短码验证正则（仅允许字母、数字、连字符和下划线，3-20位）
var shortCodePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,20}$`)

// NewRedirectHandler 创建跳转处理器
func NewRedirectHandler(
	linkService *service.LinkService,
	domainService *service.DomainService,
	linkCache *cache.LinkCache,
	rateLimiter *cache.RateLimitService,
	redisClient *redis.Client,
	configService *service.ConfigService,
	templateService *service.TemplateService,
) *RedirectHandler {
	return &RedirectHandler{
		linkService:       linkService,
		domainService:     domainService,
		cache:             linkCache,
		rateLimiter:       rateLimiter,
		redisClient:       redisClient,
		configService:     configService,
		templateService:   templateService,
		siteConfig:        make(map[string]string),
		templateCacheTTL:  10 * time.Minute, // 默认缓存 10 分钟
	}
}

// LoadSiteConfig 加载站点配置
// 使用内存级 TTL 缓存，避免每次请求都抢占写锁
func (h *RedirectHandler) LoadSiteConfig(ctx context.Context) error {
	// 第一步：使用代价极小的读锁，检查内存中的配置是否还在有效期内（1 分钟）
	// 如果在有效期内，直接返回，避免对 Redis 的查询和昂贵的写锁抢占
	h.siteConfigMu.RLock()
	if len(h.siteConfig) > 0 && time.Since(h.lastConfigCheck) < time.Minute {
		h.siteConfigMu.RUnlock()
		return nil
	}
	h.siteConfigMu.RUnlock()

	// 缓存过期或为空，尝试从 Redis 加载
	val, err := h.redisClient.Get(ctx, "site:config").Result()
	if err == nil && val != "" {
		var newConfig map[string]string
		if err := json.Unmarshal([]byte(val), &newConfig); err != nil {
			return err
		}

		// 获取写锁更新内存配置，同时更新最后检查时间
		h.siteConfigMu.Lock()
		h.siteConfig = newConfig
		h.lastConfigCheck = time.Now()
		h.siteConfigMu.Unlock()
		return nil
	}

	// Redis 没有数据，从数据库加载配置
	dbConfig, err := h.configService.GetPublicConfig(ctx)
	if err != nil {
		// 如果数据库也失败，使用默认值
		dbConfig = map[string]string{
			models.ConfigSiteName:        "Draurls",
			models.ConfigLogoURL:          "",
			models.ConfigRedirectPage:     "false",
			models.ConfigEnableSignup:     "true",
		}
	}

	// 保存到内存并更新时间戳
	h.siteConfigMu.Lock()
	h.siteConfig = dbConfig
	h.lastConfigCheck = time.Now()
	h.siteConfigMu.Unlock()

	// 异步更新 Redis，避免阻塞当前的跳转请求
	go func() {
		configJSON, _ := json.Marshal(dbConfig)
		// 使用后台 context 防止因原请求结束导致操作被取消
		h.redisClient.Set(context.Background(), "site:config", configJSON, 24*time.Hour)
	}()

	return nil
}

// Redirect 跳转到目标URL
// @Summary 短链接跳转
// @Tags redirect
// @Param code path string true "短码"
// @Success 302
// @Router /{code} [get]
func (h *RedirectHandler) Redirect(c *gin.Context) {
	code := c.Param("code")

	// 检查短码格式（仅允许字母、数字、连字符和下划线）
	if !shortCodePattern.MatchString(code) {
		h.renderError(c, "Invalid short code", http.StatusBadRequest)
		return
	}

	// 检查IP限流
	ip := c.ClientIP()
	allowed, err := h.rateLimiter.CheckIPLimit(c.Request.Context(), ip)
	if err == nil && !allowed {
		h.renderError(c, "Too many requests", http.StatusTooManyRequests)
		return
	}

	// 获取目标URL并记录访问日志
	// 获取请求的 Host（用于分域名跳转）
	// 优先使用 X-Forwarded-Host（由反向代理设置），否则使用请求的原始 Host
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}

	resolveOpts := &service.ResolveOptions{
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
		Referer:   c.GetHeader("Referer"),
		Host:      host, // 传递 Host 用于域名解析
	}
	link, err := h.linkService.Resolve(c.Request.Context(), code, resolveOpts)
	if err != nil {
		switch err.Error() {
		case "link not found":
			h.renderError(c, "Short link not found", http.StatusNotFound)
		case "link has expired":
			h.renderError(c, "Short link has expired", http.StatusGone)
		case "link is disabled":
			h.renderError(c, "Short link is disabled", http.StatusForbidden)
		default:
			h.renderError(c, "Internal error", http.StatusInternalServerError)
		}
		return
	}

	// 确保站点配置已加载（从 Redis 或数据库重新加载）
	_ = h.LoadSiteConfig(c.Request.Context())

	// 检查是否启用跳转页
	h.siteConfigMu.RLock()
	redirectPageEnabled := h.siteConfig["redirect_page_enabled"] == "true"
	h.siteConfigMu.RUnlock()

	if redirectPageEnabled {
		h.renderRedirectPage(c, link)
	} else {
		// 直接跳转（302）
		c.Redirect(http.StatusFound, link.URL)
	}
}

// renderRedirectPage 渲染跳转页
func (h *RedirectHandler) renderRedirectPage(c *gin.Context, link *models.ShortLink) {
	// 获取站点配置
	h.siteConfigMu.RLock()
	siteName := h.siteConfig["site_name"]
	logoURL := h.siteConfig["logo_url"]
	h.siteConfigMu.RUnlock()

	if siteName == "" {
		siteName = "Draurls"
	}

	// 获取模板内容
	var templateContent string
	var err error

	// 如果链接指定了模板，使用链接的模板
	if link.TemplateID != nil {
		templateContent, err = h.getTemplateContent(c.Request.Context(), *link.TemplateID)
	}

	// 如果没有指定模板或获取失败，使用默认模板
	if err != nil || templateContent == "" {
		templateContent, err = h.getDefaultTemplateContent(c.Request.Context())
		if err != nil {
			// 如果获取默认模板失败，使用备用硬编码模板
			templateContent = h.getFallbackTemplate()
		}
	}

	// 准备模板数据
	data := gin.H{
		"SiteName":  siteName,
		"LogoURL":   logoURL,
		"TargetURL": link.URL,
		"URL":       link.URL, // 兼容旧模板变量名
		"Code":      link.Code,
		"Timestamp": time.Now().Format("2006-01-02 15:04:05"),
	}

	// 解析并渲染模板
	t, err := template.New("redirect").Parse(templateContent)
	if err != nil {
		c.String(http.StatusInternalServerError, "Template parse error")
		return
	}

	c.Header("Content-Type", "text/html; charset=utf-8")
	t.Execute(c.Writer, data)
}

// getTemplateContent 获取指定ID的模板内容（带缓��）
func (h *RedirectHandler) getTemplateContent(ctx context.Context, templateID uint) (string, error) {
	// 1. 尝试从内存缓存获取
	if val, ok := h.templateCache.Load(templateID); ok {
		cached := val.(*cachedTemplate)
		// 检查是否过期
		if time.Now().Before(cached.expireAt) {
			return cached.content, nil
		}
		// 缓存过期，删除
		h.templateCache.Delete(templateID)
	}

	// 2. 从数据库获取
	template, err := h.templateService.GetByID(ctx, templateID)
	if err != nil {
		return "", err
	}
	if !template.Enabled {
		return "", errors.New("template is disabled")
	}

	// 3. 写入缓存
	h.templateCache.Store(templateID, &cachedTemplate{
		content:  template.Content,
		expireAt: time.Now().Add(h.templateCacheTTL),
	})

	return template.Content, nil
}

// getDefaultTemplateContent 获取默认模板内容（带缓存）
func (h *RedirectHandler) getDefaultTemplateContent(ctx context.Context) (string, error) {
	const defaultCacheKey = "default"

	// 1. 尝试从内存缓存获取
	if val, ok := h.templateCache.Load(defaultCacheKey); ok {
		cached := val.(*cachedTemplate)
		// 检查是否过期
		if time.Now().Before(cached.expireAt) {
			return cached.content, nil
		}
		// 缓存过期，删除
		h.templateCache.Delete(defaultCacheKey)
	}

	// 2. 从数据库获取
	template, err := h.templateService.GetDefault(ctx)
	if err != nil {
		return "", err
	}

	// 3. 写入缓存
	h.templateCache.Store(defaultCacheKey, &cachedTemplate{
		content:  template.Content,
		expireAt: time.Now().Add(h.templateCacheTTL),
	})

	return template.Content, nil
}

// InvalidateTemplateCache 使模板缓存失效
// 当模板被更新时调用此方法
func (h *RedirectHandler) InvalidateTemplateCache(templateID uint) {
	h.templateCache.Delete(templateID)
}

// InvalidateDefaultTemplateCache 使默认模板缓存失效
func (h *RedirectHandler) InvalidateDefaultTemplateCache() {
	h.templateCache.Delete("default")
}

// InvalidateAllTemplateCache 使所有模板缓存失效
func (h *RedirectHandler) InvalidateAllTemplateCache() {
	h.templateCache.Range(func(key, value any) bool {
		h.templateCache.Delete(key)
		return true
	})
}

// getFallbackTemplate 获取备用硬编码模板（当数据库查询失败时使用）
func (h *RedirectHandler) getFallbackTemplate() string {
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>即将跳转 - {{.SiteName}}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 480px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .logo {
            text-align: center;
            margin-bottom: 24px;
        }
        .logo img {
            max-width: 80px;
            max-height: 80px;
        }
        .logo h1 {
            font-size: 28px;
            color: #333;
            margin-top: 12px;
        }
        .message {
            text-align: center;
            margin: 32px 0;
        }
        .message h2 {
            font-size: 20px;
            color: #666;
            margin-bottom: 16px;
        }
        .url-box {
            background: #f5f7fa;
            border-radius: 8px;
            padding: 16px;
            word-break: break-all;
            color: #333;
            font-size: 14px;
        }
        .actions {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }
        .btn {
            flex: 1;
            padding: 14px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
            background: #e0e0e0;
            color: #333;
        }
        .btn-secondary:hover {
            background: #d0d0d0;
        }
        .warning {
            text-align: center;
            margin-top: 20px;
            font-size: 13px;
            color: #999;
        }
        .warning span {
            color: #f5a623;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            {{if .LogoURL}}
            <img src="{{.LogoURL}}" alt="{{.SiteName}}">
            {{else}}
            <h1>{{.SiteName}}</h1>
            {{end}}
        </div>
        <div class="message">
            <h2>您即将离开 {{.SiteName}}</h2>
            <div class="url-box">{{.TargetURL}}</div>
        </div>
        <div class="actions">
            <button onclick="window.location.href='{{.TargetURL}}'" class="btn btn-primary">
                继续访问
            </button>
            <button onclick="window.history.back()" class="btn btn-secondary">
                返回
            </button>
        </div>
        <div class="warning">
            <span>⚠️</span> 请确认您要访问的网站是可信的
        </div>
    </div>
</body>
</html>`
}

// renderError 渲染错误页面
func (h *RedirectHandler) renderError(c *gin.Context, message string, statusCode int) {
	h.siteConfigMu.RLock()
	siteName := h.siteConfig["site_name"]
	h.siteConfigMu.RUnlock()

	if siteName == "" {
		siteName = "Draurls"
	}

	data := gin.H{
		"SiteName": siteName,
		"Message":  message,
		"Code":     statusCode,
	}

	tmpl := `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>错误 - {{.SiteName}}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
        .error-container {
            text-align: center;
            padding: 40px;
        }
        .error-code {
            font-size: 80px;
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 16px;
        }
        .error-message {
            font-size: 20px;
            color: #555;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-code">{{.Code}}</div>
        <div class="error-message">{{.Message}}</div>
    </div>
</body>
</html>`

	t, err := template.New("error").Parse(tmpl)
	if err != nil {
		c.String(http.StatusInternalServerError, "Internal error")
		return
	}
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.Status(statusCode)
	t.Execute(c.Writer, data)
}

// CheckCircular 检查是否为循环链接（供服务层使用）
func (h *RedirectHandler) CheckCircular(targetURL string) bool {
	// 从域名管理模块获取所有启用的域名
	domains, err := h.domainService.ListActive(context.Background())
	if err != nil {
		// 如果获取失败，使用默认域名
		domains = []models.Domain{{Name: "localhost:8080"}, {Name: "draurls.local"}}
	}

	// 提取域名列表
	domainNames := make([]string, 0, len(domains)+2)
	for _, d := range domains {
		domainNames = append(domainNames, d.Name)
	}

	// 添加默认域名（兜底）
	domainNames = append(domainNames, "localhost:8080", "draurls.local")

	return urlutil.IsInternalURL(targetURL, domainNames)
}

// GetSiteConfig 获取站点配置（供前端使用）
func (h *RedirectHandler) GetSiteConfig(c *gin.Context) {
	// 直接从数据库读取最新配置，不使用缓存
	dbConfig, err := h.configService.GetPublicConfig(c.Request.Context())
	if err != nil {
		// 如果数据库失败，使用默认值
		dbConfig = map[string]string{
			models.ConfigSiteName:         "Draurls",
			models.ConfigLogoURL:          "",
			models.ConfigRedirectPage:     "false",
			models.ConfigAllowUserTemplate: "false",
			models.ConfigEnableSignup:     "true",
		}
	}

	// 隐藏敏感信息
	publicConfig := map[string]string{
		"site_name":             dbConfig[models.ConfigSiteName],
		"logo_url":              dbConfig[models.ConfigLogoURL],
		"redirect_page_enabled": dbConfig[models.ConfigRedirectPage],
		"allow_user_template":   dbConfig[models.ConfigAllowUserTemplate],
		"enable_signup":         dbConfig[models.ConfigEnableSignup],
	}

	response.Success(c, publicConfig)
}

// SetSiteConfig 设置站点配置（管理员）
func (h *RedirectHandler) SetSiteConfig(c *gin.Context) {
	var config map[string]string
	if err := c.ShouldBindJSON(&config); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 更新配置 - 使用写锁保护
	h.siteConfigMu.Lock()
	for key, value := range config {
		h.siteConfig[key] = value
	}
	h.lastConfigCheck = time.Now() // 更新时间戳，确保变更立即生效
	// 创建副本用于序列化，避免长时间持锁
	configCopy := make(map[string]string, len(h.siteConfig))
	for k, v := range h.siteConfig {
		configCopy[k] = v
	}
	h.siteConfigMu.Unlock()

	// 保存到 Redis
	configJSON, _ := json.Marshal(configCopy)
	h.redisClient.Set(c.Request.Context(), "site:config", configJSON, 24*time.Hour)

	response.Success(c, gin.H{"message": "config updated successfully"})
}
