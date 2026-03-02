package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheStrategy 缓存策略
type CacheStrategy string

const (
	// StrategyWriteThrough 写透：写入时同时更新缓存和数据库
	StrategyWriteThrough CacheStrategy = "write-through"
	// StrategyWriteBack 写回：写入时只更新缓存，异步更新数据库
	StrategyWriteBack CacheStrategy = "write-back"
	// StrategyWriteAround 绕写：写入时只更新数据库，删除缓存
	StrategyWriteAround CacheStrategy = "write-around"
)

// CacheConfig 缓存配置
type CacheConfig struct {
	// 热数据过期时间
	HotTTL time.Duration
	// 温数据过期时间
	WarmTTL time.Duration
	// 冷数据过期时间
	ColdTTL time.Duration
	// 是否启用缓存
	Enabled bool
	// ���存策略
	Strategy CacheStrategy
}

// DefaultCacheConfig 默认缓存配置
func DefaultCacheConfig() *CacheConfig {
	return &CacheConfig{
		HotTTL:   1 * time.Hour,    // 热数据：1小时
		WarmTTL:  24 * time.Hour,   // 温数据：1天
		ColdTTL:  7 * 24 * time.Hour, // 冷数据：7天
		Enabled:  true,
		Strategy: StrategyWriteThrough,
	}
}

// RedisCache Redis 缓存封装
type RedisCache struct {
	client *redis.Client
	config *CacheConfig
}

// NewRedisCache 创建 Redis 缓存
func NewRedisCache(client *redis.Client, config *CacheConfig) *RedisCache {
	if config == nil {
		config = DefaultCacheConfig()
	}
	return &RedisCache{
		client: client,
		config: config,
	}
}

// DataTemperature 数据温度等级
type DataTemperature string

const (
	TemperatureHot  DataTemperature = "hot"   // 热数据：高频访问
	TemperatureWarm DataTemperature = "warm"  // 温数据：中频访问
	TemperatureCold DataTemperature = "cold"  // 冷数据：低频访问
)

// Get 获取缓存（支持温度分级）
func (c *RedisCache) Get(ctx context.Context, key string, dest interface{}, temperature DataTemperature) error {
	if !c.config.Enabled {
		return redis.Nil
	}

	ttl := c.getTTL(temperature)
	if ttl == 0 {
		return redis.Nil
	}

	val, err := c.client.Get(ctx, c.buildKey(key, temperature)).Result()
	if err != nil {
		return err
	}

	return json.Unmarshal([]byte(val), dest)
}

// Set 设置缓存（支持温度分级）
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, temperature DataTemperature) error {
	if !c.config.Enabled {
		return nil
	}

	ttl := c.getTTL(temperature)
	if ttl == 0 {
		return nil
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return c.client.Set(ctx, c.buildKey(key, temperature), data, ttl).Err()
}

// SetWithTTL 设置缓存（指定TTL）
func (c *RedisCache) SetWithTTL(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if !c.config.Enabled {
		return nil
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return c.client.Set(ctx, key, data, ttl).Err()
}

// Delete 删除缓存（所有温度）
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	if !c.config.Enabled {
		return nil
	}

	temperatures := []DataTemperature{TemperatureHot, TemperatureWarm, TemperatureCold}
	for _, temp := range temperatures {
		_ = c.client.Del(ctx, c.buildKey(key, temp)).Err()
	}
	return nil
}

// DeleteByPattern 按模式删除缓存
func (c *RedisCache) DeleteByPattern(ctx context.Context, pattern string) error {
	if !c.config.Enabled {
		return nil
	}

	iter := c.client.Scan(ctx, 0, pattern, 0).Iterator()
	for iter.Next(ctx) {
		_ = c.client.Del(ctx, iter.Val()).Err()
	}
	return iter.Err()
}

// Promote 升级数据温度（冷->温->热）
func (c *RedisCache) Promote(ctx context.Context, key string, current DataTemperature) error {
	if !c.config.Enabled {
		return nil
	}

	// 获取当前数据
	var data string
	var err error

	data, err = c.client.Get(ctx, c.buildKey(key, current)).Result()
	if err != nil {
		return err
	}

	// 删除旧温度缓存
	_ = c.client.Del(ctx, c.buildKey(key, current)).Err()

	// 写入新温度缓存
	newTemp := c.promoteTemperature(current)
	ttl := c.getTTL(newTemp)

	return c.client.Set(ctx, c.buildKey(key, newTemp), data, ttl).Err()
}

// GetHotLinks 获取热点短链接（用于缓存预热）
func (c *RedisCache) GetHotLinks(ctx context.Context, limit int) ([]string, error) {
	// 使用 Redis Sorted Set 存储访问计数
	// 返回访问量最高的短码
	results, err := c.client.ZRevRange(ctx, "stats:links:access", 0, int64(limit-1)).Result()
	if err != nil {
		return nil, err
	}
	return results, nil
}

// IncrementAccess 增加访问计数
func (c *RedisCache) IncrementAccess(ctx context.Context, code string) error {
	// 使用 Sorted Set 记录访问次数，score 使用时间戳确保唯一性
	// 实际计数需要配合 Hash 存储
	pipe := c.client.Pipeline()
	pipe.ZIncrBy(ctx, "stats:links:access", 1, code)
	pipe.HIncrBy(ctx, "stats:links:count", code, 1)
	_, err := pipe.Exec(ctx)
	return err
}

// GetAccessCount 获取访问计数
func (c *RedisCache) GetAccessCount(ctx context.Context, code string) (int64, error) {
	return c.client.HGet(ctx, "stats:links:count", code).Int64()
}

// ResetAccessCount 重置访问计数（定期任务使用）
func (c *RedisCache) ResetAccessCount(ctx context.Context, code string) error {
	return c.client.HDel(ctx, "stats:links:count", code).Err()
}

// getTTL 根据温度获取过期时间
func (c *RedisCache) getTTL(temperature DataTemperature) time.Duration {
	switch temperature {
	case TemperatureHot:
		return c.config.HotTTL
	case TemperatureWarm:
		return c.config.WarmTTL
	case TemperatureCold:
		return c.config.ColdTTL
	default:
		return c.config.WarmTTL
	}
}

// buildKey 构建缓存 key
func (c *RedisCache) buildKey(key string, temperature DataTemperature) string {
	return fmt.Sprintf("cache:%s:%s", temperature, key)
}

// promoteTemperature 升级温度
func (c *RedisCache) promoteTemperature(current DataTemperature) DataTemperature {
	switch current {
	case TemperatureCold:
		return TemperatureWarm
	case TemperatureWarm:
		return TemperatureHot
	case TemperatureHot:
		return TemperatureHot
	default:
		return TemperatureWarm
	}
}

// DemoteTemperature 降级温度（热->温->冷）
func (c *RedisCache) DemoteTemperature(current DataTemperature) DataTemperature {
	switch current {
	case TemperatureHot:
		return TemperatureWarm
	case TemperatureWarm:
		return TemperatureCold
	case TemperatureCold:
		return TemperatureCold
	default:
		return TemperatureCold
	}
}
