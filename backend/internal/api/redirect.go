package api

import (
	"context"
	"encoding/json"
	"html/template"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
	"github.com/surls/backend/pkg/cache"
	"github.com/surls/backend/pkg/urlutil"
)

// RedirectHandler 跳转处理器
type RedirectHandler struct {
	linkService    *service.LinkService
	cache          *cache.LinkCache
	rateLimiter    *cache.RateLimitService
	redisClient    *redis.Client
	siteConfig     map[string]string
}

// NewRedirectHandler 创建跳转处理器
func NewRedirectHandler(
	linkService *service.LinkService,
	linkCache *cache.LinkCache,
	rateLimiter *cache.RateLimitService,
	redisClient *redis.Client,
) *RedirectHandler {
	return &RedirectHandler{
		linkService: linkService,
		cache:       linkCache,
		rateLimiter: rateLimiter,
		redisClient: redisClient,
		siteConfig:  make(map[string]string),
	}
}

// LoadSiteConfig 加载站点配置
func (h *RedirectHandler) LoadSiteConfig(ctx context.Context) error {
	// 从 Redis 或数据库加载站点配置
	val, err := h.redisClient.Get(ctx, "site:config").Result()
	if err == nil && val != "" {
		if err := json.Unmarshal([]byte(val), &h.siteConfig); err != nil {
			return err
		}
	}
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

	// 检查短码格式
	if len(code) < 3 || len(code) > 20 {
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
	resolveOpts := &service.ResolveOptions{
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
		Referer:   c.GetHeader("Referer"),
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

	// 检查是否启用跳转页
	redirectPageEnabled := h.siteConfig["redirect_page_enabled"] == "true"

	if redirectPageEnabled {
		h.renderRedirectPage(c, link.URL, code)
	} else {
		// 直接跳转（302）
		c.Redirect(http.StatusFound, link.URL)
	}
}

// renderRedirectPage 渲染跳转页
func (h *RedirectHandler) renderRedirectPage(c *gin.Context, targetURL, code string) {
	siteName := h.siteConfig["site_name"]
	if siteName == "" {
		siteName = "Surls"
	}

	logoURL := h.siteConfig["logo_url"]

	data := gin.H{
		"SiteName":  siteName,
		"LogoURL":   logoURL,
		"TargetURL": targetURL,
		"Code":      code,
		"Timestamp": time.Now().Format("2006-01-02 15:04:05"),
	}

	// 使用HTML模板
	tmpl := `<!DOCTYPE html>
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

	t, err := template.New("redirect").Parse(tmpl)
	if err != nil {
		c.String(http.StatusInternalServerError, "Internal error")
		return
	}

	c.Header("Content-Type", "text/html; charset=utf-8")
	t.Execute(c.Writer, data)
}

// renderError 渲染错误页面
func (h *RedirectHandler) renderError(c *gin.Context, message string, statusCode int) {
	siteName := h.siteConfig["site_name"]
	if siteName == "" {
		siteName = "Surls"
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
	// 从配置中获取自定义域名
	domainsJSON := h.siteConfig["custom_domains"]
	var domains []string
	if domainsJSON != "" {
		json.Unmarshal([]byte(domainsJSON), &domains)
	}

	// 添加默认域名
	domains = append(domains, "localhost:8080", "surls.local")

	return urlutil.IsInternalURL(targetURL, domains)
}

// GetSiteConfig 获取站点配置（供前端使用）
func (h *RedirectHandler) GetSiteConfig(c *gin.Context) {
	if err := h.LoadSiteConfig(c.Request.Context()); err != nil {
		response.InternalError(c, "failed to load config")
		return
	}

	// 隐藏敏感信息
	publicConfig := map[string]string{
		"site_name":             h.siteConfig["site_name"],
		"logo_url":              h.siteConfig["logo_url"],
		"redirect_page_enabled":   h.siteConfig["redirect_page_enabled"],
		"enable_signup":          h.siteConfig["enable_signup"],
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

	// 更新配置
	for key, value := range config {
		h.siteConfig[key] = value
	}

	// 保存到 Redis
	configJSON, _ := json.Marshal(h.siteConfig)
	h.redisClient.Set(c.Request.Context(), "site:config", configJSON, 24*time.Hour)

	response.Success(c, gin.H{"message": "config updated successfully"})
}
