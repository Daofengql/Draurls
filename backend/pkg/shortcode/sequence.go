package shortcode

import (
	"context"
	"fmt"
	"strconv"
	"sync"

	"github.com/redis/go-redis/v9"
)

// SequenceGenerator 基于 Redis INCR 的序列号生成器
type SequenceGenerator struct {
	redis     *redis.Client
	keyPrefix string // Redis key 前缀，如 "shortcode:seq"
	mu        sync.Mutex
}

// NewSequenceGenerator 创建序列号生成器
func NewSequenceGenerator(redisClient *redis.Client) *SequenceGenerator {
	return &SequenceGenerator{
		redis:     redisClient,
		keyPrefix: "shortcode:seq",
	}
}

// NextID 获取下一个序列号
func (g *SequenceGenerator) NextID(ctx context.Context) (uint64, error) {
	result, err := g.redis.Incr(ctx, g.keyPrefix).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get next id: %w", err)
	}
	return uint64(result), nil
}

// GetCurrentID 获取当前序列号（不增加）
func (g *SequenceGenerator) GetCurrentID(ctx context.Context) (uint64, error) {
	val, err := g.redis.Get(ctx, g.keyPrefix).Result()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	id, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, err
	}
	return id, nil
}

// SetCurrentID 设置当前序列号（用于初始化）
func (g *SequenceGenerator) SetCurrentID(ctx context.Context, id uint64) error {
	return g.redis.Set(ctx, g.keyPrefix, id, 0).Err()
}

// GenerateCode 从序列号生成短码
func (g *SequenceGenerator) GenerateCode(ctx context.Context) (string, error) {
	id, err := g.NextID(ctx)
	if err != nil {
		return "", err
	}
	return GenerateFromID(id), nil
}

// BatchGenerateCodes 批量生成短码（预分配，用于批量创建场景）
func (g *SequenceGenerator) BatchGenerateCodes(ctx context.Context, count int) ([]string, error) {
	if count <= 0 {
		return nil, nil
	}

	// 起始 ID
	startID, err := g.NextID(ctx)
	if err != nil {
		return nil, err
	}

	// 批量增加序列号
	if count > 1 {
		_, err = g.redis.IncrBy(ctx, g.keyPrefix, int64(count-1)).Result()
		if err != nil {
			return nil, err
		}
	}

	codes := make([]string, count)
	for i := 0; i < count; i++ {
		codes[i] = GenerateFromID(startID + uint64(i))
	}

	return codes, nil
}
