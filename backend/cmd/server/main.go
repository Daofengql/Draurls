package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/api"
	"github.com/surls/backend/internal/config"
	"github.com/surls/backend/internal/middleware"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
	"github.com/surls/backend/internal/service"
	"github.com/surls/backend/pkg/cache"
	"github.com/surls/backend/pkg/database"
	"github.com/surls/backend/pkg/shortcode"
	"github.com/surls/backend/pkg/worker"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// App 应用程序结构
type App struct {
	router        *gin.Engine
	db            *gorm.DB
	redis         *redis.Client
	sigMiddleware *middleware.APIAuthMiddleware
	config        *config.Config
	server        *http.Server
	clickCounter  *cache.ClickCounter
}

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 初始化数据库
	db, err := initDB(cfg)
	if err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}
	defer closeDB(db)

	// 初始化Redis
	redisClient := initRedis(cfg)
	defer closeRedis(redisClient)

	// 初始化缓存
	cacheCfg := &cache.CacheConfig{
		HotTTL:   cfg.Cache.HotTTL,
		WarmTTL:  cfg.Cache.WarmTTL,
		ColdTTL:  cfg.Cache.ColdTTL,
		Enabled:  true,
		Strategy: cache.StrategyWriteThrough,
	}
	redisCache := cache.NewRedisCache(redisClient, cacheCfg)
	linkCache := cache.NewLinkCache(redisCache, db, redisClient)

	// 初始化限流服务
	rateLimitService := cache.NewRateLimitService(redisClient)

	// 初始化API签名中间件（使用APIKeyRepository作为密钥提供者）
	apiKeyRepo := repository.NewAPIKeyRepository(db)
	sigMiddleware := middleware.NewAPIAuthMiddleware(apiKeyRepo, 5*time.Minute)

	// 初始化短码生成器
	// 先创建 siteConfigRepo 和 configService 以获取数据库配置
	siteConfigRepo := repository.NewSiteConfigRepository(db)
	configService := service.NewConfigService(siteConfigRepo)

	// 从数据库获取短码配置（使用默认值作为回退）
	ctx := context.Background()
	allConfigs, err := configService.GetAllConfig(ctx)
	if err != nil {
		log.Printf("Warning: failed to load site config, using defaults: %v", err)
		allConfigs = make(map[string]string)
	}

	// 获取短码模式，默认为 sequence
	shortcodeModeStr := allConfigs[models.ConfigShortcodeMode]
	if shortcodeModeStr == "" {
		shortcodeModeStr = "sequence"
	}

	// 获取短码长度，默认为 6
	shortcodeLength := 6
	if lengthStr := allConfigs[models.ConfigMaxLinkLength]; lengthStr != "" {
		if length, err := strconv.Atoi(lengthStr); err == nil && length >= 3 && length <= 20 {
			shortcodeLength = length
		}
	}

	// 根据配置确定模式
	var shortcodeGeneratorMode shortcode.GeneratorMode
	if shortcodeModeStr == "random" {
		shortcodeGeneratorMode = shortcode.ModeRandom
	} else {
		shortcodeGeneratorMode = shortcode.ModeSequence
	}

	codeGenerator := shortcode.NewGenerator(db, &shortcode.GeneratorConfig{
		CodeLength: shortcodeLength,
		Blacklist:  []string{"admin", "api", "static", "assets", "config", "user", "health", "readiness", "liveness", "r"},
		Mode:       shortcodeGeneratorMode,
		Redis:      redisClient,
	})
	log.Printf("Shortcode generator initialized: mode=%s, length=%d", shortcodeModeStr, shortcodeLength)

	// 初始化Repository
	userRepo := repository.NewUserRepository(db)
	linkRepo := repository.NewShortLinkRepository(db)
	groupRepo := repository.NewUserGroupRepository(db)
	accessLogRepo := repository.NewAccessLogRepository(db)
	domainRepo := repository.NewDomainRepository(db)
	templateRepo := repository.NewRedirectTemplateRepository(db)
	auditLogRepo := repository.NewAuditLogRepository(db)

	// 初始化访问日志缓冲区（需要先创建 batchWriter）
	// 1. 先创建一个没有 batchWriter 的 buffer
	accessLogBuffer := cache.NewAccessLogBuffer(redisClient, nil)
	// 2. 创建 batchWriter，它会自动将自己注册到 buffer 中
	batchWriter := service.NewAccessLogBatchWriter(accessLogRepo, accessLogBuffer)
	// 3. 将 batchWriter 设置到 buffer 中
	accessLogBuffer.SetBatchWriter(batchWriter)

	// 初始化点击计数器
	clickCounter := cache.NewClickCounter(redisClient)

	// 设置点击计数器的数据库更新函数
	clickCounter.SetDBUpdateFunc(func(counts map[uint]int64) error {
		return linkRepo.BatchUpdateClickCounts(context.Background(), counts)
	})

	// 初始化 Worker Pool（限制并发 Goroutine 数量）
	// 100 个 worker，任务队列大小 1000
	workerPool := worker.NewPool(100, 1000)
	defer workerPool.Stop(true)

	// 初始化Service
	baseURL := cfg.Server.GetBaseURL()
	userService := service.NewUserService(userRepo, groupRepo)
	groupService := service.NewGroupService(groupRepo, userRepo)
	auditService := service.NewAuditService(auditLogRepo)
	accessLogService := service.NewAccessLogService(accessLogRepo, accessLogBuffer)
	linkService := service.NewLinkService(linkRepo, userRepo, domainRepo, accessLogService, configService, codeGenerator, baseURL, clickCounter, workerPool)
	apiKeyService := service.NewAPIKeyService(apiKeyRepo, userRepo)
	domainService := service.NewDomainService(domainRepo)
	dashboardService := service.NewDashboardService(userRepo, linkRepo, accessLogRepo)
	templateService := service.NewTemplateService(templateRepo)

	// 初始化Handler
	linkHandler := api.NewLinkHandler(linkService, auditService)
	apiKeyHandler := api.NewAPIKeyHandler(apiKeyService, auditService)
	userHandler := api.NewUserHandler(userService, auditService)
	groupHandler := api.NewGroupHandler(groupService, auditService)
	configHandler := api.NewConfigHandler(configService, auditService)
	dashboardHandler := api.NewDashboardHandler(dashboardService)
	redirectHandler := api.NewRedirectHandler(linkService, domainService, linkCache, rateLimitService, redisClient, configService)
	healthHandler := api.NewHealthHandler(db, redisClient, baseURL)
	domainHandler := api.NewDomainHandler(domainService, auditService)
	templateHandler := api.NewTemplateHandler(templateService, auditService)
	authHandler := api.NewAuthHandler(cfg)
	auditHandler := api.NewAuditHandler(auditService)

	// 设置循环链接检测（需要在 redirectHandler 初始化后）
	linkService.SetCircularCheck(redirectHandler.CheckCircular)

	// 设置Gin模式
	gin.SetMode(cfg.Server.Mode)

	// 创建路由
	router := gin.Default()

	// 加载 HTML 模板（用于 callback.html）
	router.LoadHTMLGlob("internal/api/templates/*")

	// 全局中间件
	router.Use(middleware.CORS(cfg.Security.AllowOrigins))
	router.Use(middleware.NewRateLimitMiddleware(rateLimitService).IPLimit())

	// 健康检查
	router.GET("/health", healthHandler.Health)
	router.GET("/readiness", healthHandler.Readiness)
	router.GET("/liveness", healthHandler.Liveness)

	// 初始化 Keycloak OIDC 认证中间件
	// 配置说明：
	// 1. 确保 Keycloak 已启动并可访问
	// 2. 在 Keycloak 中创建 Realm 和 Client
	// 3. 配置正确的环境变量
	keycloakBaseURL := cfg.Keycloak.BaseURL
	keycloakRealm := cfg.Keycloak.Realm
	keycloakClientID := cfg.Keycloak.ClientID

	// 创建 OIDC 认证器
	oidcAuth := middleware.NewKeycloakOIDCAuthenticator(
		keycloakBaseURL,
		keycloakRealm,
		keycloakClientID,
	)
	authMiddleware := middleware.NewAuthMiddleware(oidcAuth)
	authMiddleware.SetUserService(userService)

	log.Printf("Keycloak OIDC configured: %s/realms/%s", keycloakBaseURL, keycloakRealm)

	// 公开API（不需要认证）
	public := router.Group("/api")
	{
		public.GET("/config", redirectHandler.GetSiteConfig)
		// 认证相关接口（公开，用于登录流程）
		public.POST("/auth/login-url", authHandler.GetLoginURL)    // 获取登录 URL
		public.GET("/auth/callback", authHandler.KeycloakCallback) // Keycloak 回调（返回 HTML）
		public.POST("/auth/refresh", authHandler.RefreshToken)     // 刷新 Token
		public.POST("/auth/logout", authHandler.Logout)            // 登出
	}

	// 需要认证的API（使用模拟认证）
	authRequired := router.Group("/api")
	authRequired.Use(authMiddleware.Authenticate())
	{
		// 用户相关
		authRequired.GET("/user/profile", userHandler.GetProfile)
		authRequired.GET("/user/quota", userHandler.GetQuotaStatus)
		authRequired.GET("/user/dashboard", dashboardHandler.GetUserDashboard)

		// 短链接
		authRequired.POST("/links", linkHandler.CreateLink)
		authRequired.GET("/links", linkHandler.ListLinks)
		authRequired.GET("/links/:code", linkHandler.GetLink)
		authRequired.PUT("/links/:code", linkHandler.UpdateLink)
		authRequired.DELETE("/links/:code", linkHandler.DeleteLink)
		authRequired.GET("/links/:code/stats", linkHandler.GetLinkStats)
		authRequired.GET("/links/:code/logs", linkHandler.GetLinkLogs)

		// API密钥
		authRequired.POST("/apikeys", apiKeyHandler.CreateAPIKey)
		authRequired.GET("/apikeys", apiKeyHandler.ListAPIKeys)
		authRequired.DELETE("/apikeys/:id", apiKeyHandler.DeleteAPIKey)

		// 管理员API
		admin := authRequired.Group("/admin")
		admin.Use(middleware.RequireAdmin())
		{
			// 用户管理
			admin.GET("/users", userHandler.ListUsers)
			admin.PUT("/users/quota", userHandler.UpdateQuota)
			admin.PUT("/users/group", userHandler.SetGroup)
			admin.POST("/users/:id/disable", userHandler.DisableUser)
			admin.POST("/users/:id/enable", userHandler.EnableUser)

			// 用户组管理
			admin.GET("/groups", groupHandler.ListGroups)
			admin.POST("/groups", groupHandler.CreateGroup)
			admin.GET("/groups/:id", groupHandler.GetGroup)
			admin.PUT("/groups/:id", groupHandler.UpdateGroup)
			admin.DELETE("/groups/:id", groupHandler.DeleteGroup)
			admin.POST("/groups/:id/default", groupHandler.SetDefaultGroup)
			admin.POST("/groups/:id/domains", groupHandler.AddDomainToGroup)
			admin.DELETE("/groups/:id/domains/:domainId", groupHandler.RemoveDomainFromGroup)

			// 站点配置管理
			admin.GET("/config", configHandler.GetAdminConfig)
			admin.PUT("/config", configHandler.UpdateConfig)
			admin.PUT("/config/batch", configHandler.BatchUpdateConfig)

			// 域名管理
			admin.GET("/domains", domainHandler.ListDomains)
			admin.POST("/domains", domainHandler.CreateDomain)
			admin.PUT("/domains/:id", domainHandler.UpdateDomain)
			admin.DELETE("/domains/:id", domainHandler.DeleteDomain)
			admin.POST("/domains/:id/default", domainHandler.SetDefaultDomain)

			// 仪表盘统计
			admin.GET("/dashboard/summary", dashboardHandler.GetAdminSummary)
			admin.GET("/dashboard/trends", dashboardHandler.GetAdminTrends)

			// 跳转模板管理
			admin.GET("/templates", templateHandler.ListTemplates)
			admin.POST("/templates", templateHandler.CreateTemplate)
			admin.GET("/templates/:id", templateHandler.GetTemplate)
			admin.PUT("/templates/:id", templateHandler.UpdateTemplate)
			admin.DELETE("/templates/:id", templateHandler.DeleteTemplate)
			admin.POST("/templates/:id/default", templateHandler.SetDefaultTemplate)

			// 审计日志
			admin.GET("/audit-logs", auditHandler.ListAuditLogs)
		}
	}

	// 公开域名列表
	router.GET("/api/domains", domainHandler.ListActiveDomains)

	// API签名认证路由（供外部调用）
	apiSignature := router.Group("/api/v1")
	apiSignature.Use(sigMiddleware.Authenticate())
	{
		apiSignature.POST("/shorten", linkHandler.CreateLinkAPI)
	}

	// 短链接跳转（使用 /r/:code 格式）
	// 这样可以避免与前端路由冲突
	router.GET("/r/:code", func(c *gin.Context) {
		code := c.Param("code")

		// 跳过包含点号的请求（如 favicon.ico）
		if strings.Contains(code, ".") {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}

		// 跳过空路径
		if code == "" {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}

		// 调用 RedirectHandler
		redirectHandler.Redirect(c)
	})

	// 创建应用
	app := &App{
		router:        router,
		db:            db,
		redis:         redisClient,
		sigMiddleware: sigMiddleware,
		config:        cfg,
		clickCounter:  clickCounter,
		server: &http.Server{
			Addr:         cfg.Server.GetAddr(),
			Handler:      router,
			ReadTimeout:  cfg.Server.ReadTimeout,
			WriteTimeout: cfg.Server.WriteTimeout,
		},
	}

	// 启动服务器
	app.run()
}

// run 启动应用并处理优雅关闭
func (a *App) run() {
	// 启动服务器
	go func() {
		addr := a.config.Server.GetAddr()
		log.Printf("Server starting on %s", addr)
		log.Printf("Environment: %s", a.config.Server.Mode)
		log.Printf("Base URL: %s", a.config.Server.GetBaseURL())
		log.Printf("Authentication: Keycloak OIDC")

		if err := a.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// 优雅关闭
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// 停止点击计数器
	if a.clickCounter != nil {
		a.clickCounter.Stop()
	}

	// 停止签名中间件
	if a.sigMiddleware != nil {
		a.sigMiddleware.Stop()
	}

	// 停止HTTP服务器
	if err := a.server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	} else {
		log.Println("Server shutdown complete")
	}
}

// initDB 初始化数据库
func initDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.Database.GetDSN()

	// 使用自定义数据库初始化函数，自动过滤MySQL驱动错误日志
	var logLevel logger.LogLevel
	switch cfg.Server.Mode {
	case "debug", "test":
		logLevel = logger.Info
	default: // release
		logLevel = logger.Silent
	}

	db, err := database.InitDB(&database.Config{
		DSN:          dsn,
		LogLevel:     logLevel,
		MaxIdleConns: cfg.Database.MaxIdleConns,
		MaxOpenConns: cfg.Database.MaxOpenConns,
		MaxLifetime:  cfg.Database.MaxLifetime,
		MaxIdleTime:  10 * time.Minute,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// 自动创建/迁移数据库表
	if err := autoMigrate(db); err != nil {
		return nil, fmt.Errorf("failed to auto migrate: %w", err)
	}

	log.Println("Database connected successfully")

	return db, nil
}

// autoMigrate 自动迁移数据库表结构
func autoMigrate(db *gorm.DB) error {
	log.Println("Running database migrations...")

	return db.AutoMigrate(
		&models.User{},
		&models.UserGroup{},
		&models.ShortLink{},
		&models.APIKey{},
		&models.AccessLog{},
		&models.SiteConfig{},
		&models.RedirectTemplate{},
		&models.Domain{},
		&models.DomainGroupDomain{},
		&models.AuditLog{},
	)
}

// initRedis 初始化Redis
func initRedis(cfg *config.Config) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port),
		Password:     cfg.Redis.Password,
		DB:           cfg.Redis.DB,
		PoolSize:     cfg.Redis.PoolSize,
		MinIdleConns: cfg.Redis.MinIdleConns,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Redis connection failed: %v", err)
	} else {
		log.Println("Redis connected successfully")
	}

	return client
}

// closeDB 关闭数据库连接
func closeDB(db *gorm.DB) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	_ = sqlDB.Close()
}

// closeRedis 关闭Redis连接
func closeRedis(client *redis.Client) {
	_ = client.Close()
}
