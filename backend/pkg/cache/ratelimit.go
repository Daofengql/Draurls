package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimiterConfig 限流配置
type RateLimiterConfig struct {
	// 时间窗口
	Window time.Duration
	// 窗口内最大请求数
	MaxRequests int
	// 是否使用滑动窗口
	SlidingWindow bool
}

// RateLimiter 限流器
type RateLimiter struct {
	client *redis.Client
}

// NewRateLimiter 创建限流器
func NewRateLimiter(client *redis.Client) *RateLimiter {
	return &RateLimiter{client: client}
}

// Allow 检查是否允许请求（固定窗口算法）
func (rl *RateLimiter) Allow(ctx context.Context, key string, config *RateLimiterConfig) (bool, error) {
	count, err := rl.client.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}

	if count == 1 {
		// 第一次请求，设置过期时间
		_ = rl.client.Expire(ctx, key, config.Window)
	}

	return count <= int64(config.MaxRequests), nil
}

// AllowSliding 检查是否允许请求（滑动窗口算法）
func (rl *RateLimiter) AllowSliding(ctx context.Context, key string, config *RateLimiterConfig) (bool, error) {
	now := time.Now().Unix()
	windowStart := now - int64(config.Window.Seconds())

	// 使用 Redis Sorted Set 实现滑动窗口
	pipe := rl.client.Pipeline()

	// 移除窗口外的记录
	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart))

	// 获取当前窗口内的请求数
	countCmd := pipe.ZCard(ctx, key)

	// 添加当前请求
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: now})

	// 设置过期时间
	pipe.Expire(ctx, key, config.Window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}

	count := countCmd.Val()
	return count < int64(config.MaxRequests), nil
}

// Reset 重置限流
func (rl *RateLimiter) Reset(ctx context.Context, key string) error {
	return rl.client.Del(ctx, key).Err()
}

// GetRemaining 获取剩余请求次数
func (rl *RateLimiter) GetRemaining(ctx context.Context, key string, config *RateLimiterConfig) (int64, error) {
	count, err := rl.client.Get(ctx, key).Int64()
	if err == redis.Nil {
		return int64(config.MaxRequests), nil
	}
	if err != nil {
		return 0, err
	}

	remaining := int64(config.MaxRequests) - count
	if remaining < 0 {
		remaining = 0
	}
	return remaining, nil
}

// LimitType 限流类型
type LimitType string

const (
	LimitTypeIP      LimitType = "ip"       // IP 限流
	LimitTypeUser    LimitType = "user"     // 用户限流
	LimitTypeAPI     LimitType = "api"      // API Key 限流
	LimitTypeGlobal  LimitType = "global"   // 全局限流
)

// LimitConfig 预定义限流配置
var DefaultLimitConfigs = map[LimitType]*RateLimiterConfig{
	LimitTypeIP: {
		Window:        time.Minute,
		MaxRequests:   100,
		SlidingWindow: true,
	},
	LimitTypeUser: {
		Window:        time.Minute,
		MaxRequests:   200,
		SlidingWindow: true,
	},
	LimitTypeAPI: {
		Window:        time.Minute,
		MaxRequests:   500,
		SlidingWindow: true,
	},
	LimitTypeGlobal: {
		Window:        time.Second,
		MaxRequests:   10000,
		SlidingWindow: true,
	},
}

// RateLimitService 限流服务
type RateLimitService struct {
	limiter *RateLimiter
}

// NewRateLimitService 创建限流服务
func NewRateLimitService(client *redis.Client) *RateLimitService {
	return &RateLimitService{
		limiter: NewRateLimiter(client),
	}
}

// CheckLimit 检查限流
func (s *RateLimitService) CheckLimit(ctx context.Context, limitType LimitType, identifier string, config *RateLimiterConfig) (bool, error) {
	if config == nil {
		var ok bool
		config, ok = DefaultLimitConfigs[limitType]
		if !ok {
			return true, nil
		}
	}

	key := fmt.Sprintf("ratelimit:%s:%s", limitType, identifier)

	if config.SlidingWindow {
		return s.limiter.AllowSliding(ctx, key, config)
	}
	return s.limiter.Allow(ctx, key, config)
}

// CheckIPLimit 检查 IP 限流
func (s *RateLimitService) CheckIPLimit(ctx context.Context, ip string) (bool, error) {
	return s.CheckLimit(ctx, LimitTypeIP, ip, DefaultLimitConfigs[LimitTypeIP])
}

// CheckUserLimit 检查用户限流
func (s *RateLimitService) CheckUserLimit(ctx context.Context, userID uint) (bool, error) {
	return s.CheckLimit(ctx, LimitTypeUser, fmt.Sprintf("%d", userID), DefaultLimitConfigs[LimitTypeUser])
}

// CheckAPILimit 检查 API Key 限流
func (s *RateLimitService) CheckAPILimit(ctx context.Context, apiKey string) (bool, error) {
	return s.CheckLimit(ctx, LimitTypeAPI, apiKey, DefaultLimitConfigs[LimitTypeAPI])
}

// CheckUserQuota 检查用户配额
func (s *RateLimitService) CheckUserQuota(ctx context.Context, userID uint, currentCount, maxQuota int) bool {
	return maxQuota <= 0 || currentCount < maxQuota
}
