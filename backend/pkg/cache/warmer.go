package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheWarmer 缓存预热器
type CacheWarmer struct {
	cache    *RedisCache
	client   *redis.Client
	loader   DataLoader
	stopCh   chan struct{}
}

// DataLoader 数据加载接口
type DataLoader interface {
	// LoadHotLinks 加载热点链接
	LoadHotLinks(ctx context.Context, limit int) ([]string, error)
	// LoadLinkByCode 根据短码加载链接
	LoadLinkByCode(ctx context.Context, code string) (interface{}, error)
}

// NewCacheWarmer 创建缓存预热器
func NewCacheWarmer(cache *RedisCache, client *redis.Client, loader DataLoader) *CacheWarmer {
	return &CacheWarmer{
		cache:  cache,
		client: client,
		loader: loader,
		stopCh: make(chan struct{}),
	}
}

// Start 启动预热任务
func (w *CacheWarmer) Start(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.warmCache(ctx)
		case <-w.stopCh:
			return
		case <-ctx.Done():
			return
		}
	}
}

// Stop 停止预热任务
func (w *CacheWarmer) Stop() {
	close(w.stopCh)
}

// warmCache 执行预热
func (w *CacheWarmer) warmCache(ctx context.Context) {
	// 获取热点短码
	hotCodes, err := w.cache.GetHotLinks(ctx, 1000)
	if err != nil {
		return
	}

	// 批量加载并缓存
	for _, code := range hotCodes {
		select {
		case <-ctx.Done():
			return
		default:
			w.warmLink(ctx, code)
		}
	}
}

// warmLink 预热单个链接
func (w *CacheWarmer) warmLink(ctx context.Context, code string) {
	// 检查是否已缓存
	key := fmt.Sprintf("link:%s", code)

	// 尝试从缓存获取
	var cached interface{}
	err := w.cache.Get(ctx, key, &cached, TemperatureHot)
	if err == nil {
		return // 已存在热缓存
	}

	// 从数据库加载
	link, err := w.loader.LoadLinkByCode(ctx, code)
	if err != nil {
		return
	}

	// 写入热缓存
	_ = w.cache.Set(ctx, key, link, TemperatureHot)
}

// WarmByCode 预热指定链接（手动触发）
func (w *CacheWarmer) WarmByCode(ctx context.Context, code string) error {
	link, err := w.loader.LoadLinkByCode(ctx, code)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("link:%s", code)
	return w.cache.Set(ctx, key, link, TemperatureHot)
}
