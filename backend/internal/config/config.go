package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config 应用配置
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Keycloak KeycloakConfig
	Cache    CacheConfig
	Security SecurityConfig
	Shortcode ShortcodeConfig
	Worker   WorkerConfig
	RateLimit RateLimitConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Port         int
	Mode         string
	BaseURL      string        // 短链基础域名（用于生成完整短链接）
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// GetBaseURL 获取短链基础URL
func (c *ServerConfig) GetBaseURL() string {
	if c.BaseURL != "" {
		return c.BaseURL
	}
	return fmt.Sprintf("http://localhost:%d", c.Port)
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host         string
	Port         int
	Username     string
	Password     string
	Database     string
	Charset      string
	ParseTime    bool
	MaxIdleConns int
	MaxOpenConns int
	MaxLifetime  time.Duration
	LogLevel     string // 日志级别: silent, error, warn, info
}

// GetDSN 获取数据库连接字符串
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=%t&loc=Local",
		c.Username,
		c.Password,
		c.Host,
		c.Port,
		c.Database,
		c.Charset,
		c.ParseTime,
	)
}

// GetLogLevel 获取数据库日志级别
func (c *DatabaseConfig) GetLogLevel(serverMode string) string {
	if c.LogLevel != "" {
		return c.LogLevel
	}
	// 根据 Server Mode 决定
	if serverMode == "debug" || serverMode == "test" {
		return "info"
	}
	return "silent"
}

// RedisConfig Redis 配置
type RedisConfig struct {
	Host         string
	Port         int
	Password     string
	DB           int
	PoolSize     int
	MinIdleConns int
}

// KeycloakConfig Keycloak 配置
type KeycloakConfig struct {
	BaseURL    string
	Realm      string
	ClientID   string
	Secret     string
	CallbackURL string
}

// CacheConfig 缓存配置
type CacheConfig struct {
	HotTTL  time.Duration
	WarmTTL time.Duration
	ColdTTL time.Duration
}

// SecurityConfig 安全配置
type SecurityConfig struct {
	JWTSecret    string
	EnableHTTPS   bool
	AllowOrigins  []string
	APIKeyExpiry  time.Duration
}

// ShortcodeConfig 短码生成配置
type ShortcodeConfig struct {
	Mode     string // random, sequence
	Length   int    // 随机模式下的短码长度
}

// WorkerConfig Worker 配置
type WorkerConfig struct {
	PoolSize     int
	TaskQueueSize int
}

// RateLimitConfig 限流配置
type RateLimitConfig struct {
	IP     int // IP 限流: 请求数/分钟
	User   int // 用户限流: 请求数/分钟
	API    int // API密钥限流: 请求数/分钟
	Global int // 全局限流: 请求数/秒
}

// Load 加载配置
func Load() (*Config, error) {
	// 加载 .env 文件
	_ = godotenv.Load()

	serverMode := getEnv("SERVER_MODE", "debug")

	cfg := &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			Mode:         serverMode,
			BaseURL:      getEnv("SERVER_BASE_URL", ""),
			ReadTimeout:  60 * time.Second,
			WriteTimeout: 60 * time.Second,
		},
		Database: DatabaseConfig{
			Host:         getEnv("DB_HOST", "127.0.0.1"),
			Port:         getEnvInt("DB_PORT", 3306),
			Username:     getEnv("DB_USER", "root"),
			Password:     getEnv("DB_PASSWORD", ""),
			Database:     getEnv("DB_NAME", "surls"),
			Charset:      getEnv("DB_CHARSET", "utf8mb4"),
			ParseTime:    getEnvBool("DB_PARSE_TIME", true),
			MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 10),
			MaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 100),
			MaxLifetime:  time.Duration(getEnvInt("DB_CONN_MAX_LIFETIME", 300)) * time.Second,
			LogLevel:     getEnv("DB_LOG_LEVEL", ""),
		},
		Redis: RedisConfig{
			Host:         getEnv("REDIS_HOST", "127.0.0.1"),
			Port:         getEnvInt("REDIS_PORT", 6379),
			Password:     getEnv("REDIS_PASSWORD", ""),
			DB:           getEnvInt("REDIS_DB", 0),
			PoolSize:     getEnvInt("REDIS_POOL_SIZE", 10),
			MinIdleConns: getEnvInt("REDIS_MIN_IDLE_CONNS", 5),
		},
		Keycloak: KeycloakConfig{
			BaseURL:     getEnv("KEYCLOAK_BASE_URL", "http://localhost:8081"),
			Realm:       getEnv("KEYCLOAK_REALM", "surls"),
			ClientID:    getEnv("KEYCLOAK_CLIENT_ID", "surls"),
			Secret:      getEnv("KEYCLOAK_SECRET", ""),
			CallbackURL: getEnv("KEYCLOAK_CALLBACK_URL", "http://localhost:3000/callback"),
		},
		Cache: CacheConfig{
			HotTTL:  time.Duration(getEnvInt("CACHE_HOT_TTL", 3600)) * time.Second,
			WarmTTL: time.Duration(getEnvInt("CACHE_WARM_TTL", 86400)) * time.Second,
			ColdTTL: time.Duration(getEnvInt("CACHE_COLD_TTL", 604800)) * time.Second,
		},
		Security: SecurityConfig{
			JWTSecret:    getEnv("JWT_SECRET", "change-me-in-production"),
			EnableHTTPS:  getEnvBool("ENABLE_HTTPS", false),
			AllowOrigins: []string{"http://localhost:3000"},
			APIKeyExpiry: 365 * 24 * time.Hour,
		},
		Shortcode: ShortcodeConfig{
			Mode:   getEnv("SHORTCODE_MODE", "sequence"),
			Length: getEnvInt("SHORTCODE_LENGTH", 6),
		},
		Worker: WorkerConfig{
			PoolSize:     getEnvInt("WORKER_POOL_SIZE", 100),
			TaskQueueSize: getEnvInt("WORKER_TASK_QUEUE_SIZE", 1000),
		},
		RateLimit: RateLimitConfig{
			IP:     getEnvInt("RATE_LIMIT_IP", 100),
			User:   getEnvInt("RATE_LIMIT_USER", 200),
			API:    getEnvInt("RATE_LIMIT_API", 500),
			Global: getEnvInt("RATE_LIMIT_GLOBAL", 10000),
		},
	}

	return cfg, nil
}

// GetAddr 获取服务器监听地址
func (c *ServerConfig) GetAddr() string {
	return fmt.Sprintf(":%d", c.Port)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		intValue, err := strconv.Atoi(value)
		if err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1"
	}
	return defaultValue
}
