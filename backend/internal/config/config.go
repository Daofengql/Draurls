package config

import (
	"fmt"
	"os"
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
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Port         int
	Mode         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
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
	JWTSecret     string
	EnableHTTPS   bool
	AllowOrigins  []string
	APIKeyExpiry  time.Duration
}

// Load 加载配置
func Load() (*Config, error) {
	// 加载 .env 文件
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			Mode:         getEnv("SERVER_MODE", "debug"),
			ReadTimeout:  60 * time.Second,
			WriteTimeout: 60 * time.Second,
		},
		Database: DatabaseConfig{
			Host:         getEnv("DB_HOST", "127.0.0.1"),
			Port:          getEnvInt("DB_PORT", 3306),
			Username:     getEnv("DB_USER", "root"),
			Password:     getEnv("DB_PASSWORD", ""),
			Database:     getEnv("DB_NAME", "surls"),
			Charset:      "utf8mb4",
			ParseTime:    true,
			MaxIdleConns: 10,
			MaxOpenConns: 100,
			MaxLifetime:  time.Hour,
		},
		Redis: RedisConfig{
			Host:         getEnv("REDIS_HOST", "127.0.0.1"),
			Port:         getEnvInt("REDIS_PORT", 6379),
			Password:     getEnv("REDIS_PASSWORD", ""),
			DB:           getEnvInt("REDIS_DB", 0),
			PoolSize:     10,
			MinIdleConns: 5,
		},
		Keycloak: KeycloakConfig{
			BaseURL:     getEnv("KEYCLOAK_BASE_URL", "http://localhost:8081"),
			Realm:       getEnv("KEYCLOAK_REALM", "surls"),
			ClientID:    getEnv("KEYCLOAK_CLIENT_ID", "surls"),
			Secret:      getEnv("KEYCLOAK_SECRET", ""),
			CallbackURL: getEnv("KEYCLOAK_CALLBACK_URL", "http://localhost:3000/callback"),
		},
		Cache: CacheConfig{
			HotTTL:  1 * time.Hour,
			WarmTTL: 24 * time.Hour,
			ColdTTL: 7 * 24 * time.Hour,
		},
		Security: SecurityConfig{
			JWTSecret:    getEnv("JWT_SECRET", "change-me-in-production"),
			EnableHTTPS:  getEnvBool("ENABLE_HTTPS", false),
			AllowOrigins: []string{"http://localhost:3000"},
			APIKeyExpiry: 365 * 24 * time.Hour,
		},
	}

	return cfg, nil
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
		var intValue int
		if _, err := fmt.Sscanf(value, "%d", &intValue); err == nil {
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
