package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/surls/backend/internal/api"
	"github.com/surls/backend/internal/config"
	"github.com/surls/backend/internal/middleware"
	"github.com/surls/backend/internal/repository"
	"github.com/surls/backend/internal/service"
	"github.com/surls/backend/pkg/cache"
	"github.com/surls/backend/pkg/shortcode"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// App 应用程序结构
type App struct {
	router         *gin.Engine
	db             *gorm.DB
	redis          *redis.Client
	sigMiddleware  *middleware.APIAuthMiddleware
	config         *config.Config
	server         *http.Server
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
	codeGenerator := shortcode.NewGenerator(db, &shortcode.GeneratorConfig{
		CodeLength: 6,
		Blacklist:  []string{"admin", "api", "static", "assets", "config", "user", "health", "readiness", "liveness"},
	})

	// 初始化Repository
	userRepo := repository.NewUserRepository(db)
	linkRepo := repository.NewShortLinkRepository(db)
	groupRepo := repository.NewUserGroupRepository(db)
	accessLogRepo := repository.NewAccessLogRepository(db)

	// 初始化Service
	baseURL := cfg.Server.GetBaseURL()
	userService := service.NewUserService(userRepo, groupRepo)
	linkService := service.NewLinkService(linkRepo, userRepo, accessLogRepo, codeGenerator, baseURL)
	apiKeyService := service.NewAPIKeyService(apiKeyRepo, userRepo)

	// 初始化Handler
	linkHandler := api.NewLinkHandler(linkService)
	apiKeyHandler := api.NewAPIKeyHandler(apiKeyService)
	userHandler := api.NewUserHandler(userService)
	redirectHandler := api.NewRedirectHandler(linkService, linkCache, rateLimitService, redisClient)
	healthHandler := api.NewHealthHandler(db, redisClient, baseURL)

	// 设置Gin模式
	gin.SetMode(cfg.Server.Mode)

	// 创建路由
	router := gin.Default()

	// 全局中间件
	router.Use(middleware.CORS(cfg.Security.AllowOrigins))
	router.Use(middleware.NewRateLimitMiddleware(rateLimitService).IPLimit())

	// 健康检查
	router.GET("/health", healthHandler.Health)
	router.GET("/readiness", healthHandler.Readiness)
	router.GET("/liveness", healthHandler.Liveness)

	// 公开API（不需要认证）
	public := router.Group("/api")
	{
		public.GET("/config", redirectHandler.GetSiteConfig)
	}

	// 需要认证的API（使用模拟认证）
	authRequired := router.Group("/api")
	authRequired.Use(func(c *gin.Context) {
		// 临时使用模拟认证，生产环境替换为真实的Keycloak认证
		mockAuth := middleware.NewMockAuthenticator()
		mockMiddle := middleware.NewAuthMiddleware(mockAuth)
		mockMiddle.Authenticate()(c)

		// 如果认证成功，设置用户ID（临时）
		if c.GetString("keycloak_id") == "admin" {
			c.Set("user_id", uint(1))
		} else if c.GetString("keycloak_id") == "user123" {
			c.Set("user_id", uint(2))
		}
	})
	{
		// 用户相关
		authRequired.GET("/user/profile", userHandler.GetProfile)
		authRequired.GET("/user/quota", userHandler.GetQuotaStatus)

		// 短链接
		authRequired.POST("/links", linkHandler.CreateLink)
		authRequired.GET("/links", linkHandler.ListLinks)
		authRequired.GET("/links/:code", linkHandler.GetLink)
		authRequired.PUT("/links/:code", linkHandler.UpdateLink)
		authRequired.DELETE("/links/:code", linkHandler.DeleteLink)
		authRequired.GET("/links/:code/stats", linkHandler.GetLinkStats)

		// API密钥
		authRequired.POST("/apikeys", apiKeyHandler.CreateAPIKey)
		authRequired.GET("/apikeys", apiKeyHandler.ListAPIKeys)
		authRequired.DELETE("/apikeys/:id", apiKeyHandler.DeleteAPIKey)

		// 管理员API
		admin := authRequired.Group("/admin")
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/users", userHandler.ListUsers)
			admin.PUT("/users/quota", userHandler.UpdateQuota)
			admin.PUT("/users/group", userHandler.SetGroup)
			admin.POST("/users/:id/disable", userHandler.DisableUser)
			admin.POST("/users/:id/enable", userHandler.EnableUser)
			admin.PUT("/config", redirectHandler.SetSiteConfig)
		}
	}

	// API签名认证路由（供外部调用）
	apiSignature := router.Group("/api/v1")
	apiSignature.Use(sigMiddleware.Authenticate())
	{
		apiSignature.POST("/shorten", linkHandler.CreateLinkAPI)
	}

	// 短链接跳转（必须放在最后，排除已定义的路由）
	router.GET("/:code", func(c *gin.Context) {
		code := c.Param("code")
		// 跳过系统路由
		skipRoutes := map[string]bool{
			"health":    true,
			"api":       true,
			"readiness": true,
			"liveness":  true,
		}
		if skipRoutes[code] {
			c.Next()
			return
		}
		redirectHandler.Redirect(c)
	})

	// 创建应用
	app := &App{
		router:        router,
		db:            db,
		redis:         redisClient,
		sigMiddleware: sigMiddleware,
		config:        cfg,
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
		log.Printf("Test tokens:")
		log.Printf("  Admin: Bearer admin-token")
		log.Printf("  User:  Bearer user-token")

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

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// 设置连接池
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(cfg.Database.MaxLifetime)

	log.Println("Database connected successfully")

	return db, nil
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
