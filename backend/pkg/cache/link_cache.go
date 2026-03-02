package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// LinkCache 短链接缓存服务
type LinkCache struct {
	cache      *RedisCache
	db         *gorm.DB
	lockMgr    *LockManager
}

// NewLinkCache 创建短链接缓存服务
func NewLinkCache(cache *RedisCache, db *gorm.DB, client *redis.Client) *LinkCache {
	return &LinkCache{
		cache:   cache,
		db:      db,
		lockMgr: NewLockManager(client),
	}
}

// GetLink 获取短链接（带缓存穿透保护）
func (lc *LinkCache) GetLink(ctx context.Context, code string) (*Link, error) {
	key := fmt.Sprintf("link:%s", code)

	// 1. 尝试从热缓存获取
	var link Link
	err := lc.cache.Get(ctx, key, &link, TemperatureHot)
	if err == nil {
		// 缓存命中，记录访问
		_ = lc.cache.IncrementAccess(ctx, code)
		return &link, nil
	}

	// 2. 使用分布式锁防止缓存穿透
	lockKey := fmt.Sprintf("query:%s", code)
	err = lc.lockMgr.WithLock(ctx, lockKey, 10*time.Second, func() error {
		// 二次检查缓存
		err := lc.cache.Get(ctx, key, &link, TemperatureHot)
		if err == nil {
			_ = lc.cache.IncrementAccess(ctx, code)
			return nil
		}

		// 从数据库查询
		err = lc.db.WithContext(ctx).Where("code = ?", code).First(&link).Error
		if err != nil {
			// 缓存空值防止穿透
			if err == gorm.ErrRecordNotFound {
				_ = lc.cache.SetWithTTL(ctx, key+":empty", nil, 5*time.Minute)
			}
			return err
		}

		// 根据访问频率决定缓存温度
		count, _ := lc.cache.GetAccessCount(ctx, code)
		temperature := lc.classifyTemperature(count)

		// 写入缓存
		_ = lc.cache.Set(ctx, key, &link, temperature)
		_ = lc.cache.IncrementAccess(ctx, code)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &link, nil
}

// CreateLink 创建短链接（写透策略）
func (lc *LinkCache) CreateLink(ctx context.Context, link *Link) error {
	// 使用分布式锁防止并发创建
	lockKey := fmt.Sprintf("create:%s", link.URL)
	err := lc.lockMgr.WithLock(ctx, lockKey, 10*time.Second, func() error {
		// 检查是否已存在相同 URL
		var existing Link
		err := lc.db.WithContext(ctx).Where("url = ? AND user_id = ?", link.URL, link.UserID).First(&existing).Error
		if err == nil {
			// 已存在，复用
			link.Code = existing.Code
			link.ID = existing.ID
			return nil
		}

		// 创建新记录
		return lc.db.WithContext(ctx).Create(link).Error
	})

	if err != nil {
		return err
	}

	// 更新缓存
	key := fmt.Sprintf("link:%s", link.Code)
	_ = lc.cache.Set(ctx, key, link, TemperatureWarm)

	return nil
}

// UpdateLink 更新短链接
func (lc *LinkCache) UpdateLink(ctx context.Context, code string, updates map[string]interface{}) error {
	// 先更新数据库
	err := lc.db.WithContext(ctx).Model(&Link{}).Where("code = ?", code).Updates(updates).Error
	if err != nil {
		return err
	}

	// 删除缓存（绕写策略）
	key := fmt.Sprintf("link:%s", code)
	_ = lc.cache.Delete(ctx, key)

	return nil
}

// DeleteLink 删除短链接
func (lc *LinkCache) DeleteLink(ctx context.Context, code string) error {
	// 删除数据库记录
	err := lc.db.WithContext(ctx).Where("code = ?", code).Delete(&Link{}).Error
	if err != nil {
		return err
	}

	// 删除缓存
	key := fmt.Sprintf("link:%s", code)
	_ = lc.cache.Delete(ctx, key)

	return nil
}

// InvalidateUserCache 使用户缓存失效
func (lc *LinkCache) InvalidateUserCache(ctx context.Context, userID uint) error {
	pattern := fmt.Sprintf("user:%d:*", userID)
	return lc.cache.DeleteByPattern(ctx, pattern)
}

// classifyTemperature 根据访问次数分类数据温度
func (lc *LinkCache) classifyTemperature(accessCount int64) DataTemperature {
	// 根据业务需求调整阈值
	if accessCount > 1000 {
		return TemperatureHot
	}
	if accessCount > 100 {
		return TemperatureWarm
	}
	return TemperatureCold
}

// GetUserLinks 获取用户链接列表（带缓存）
func (lc *LinkCache) GetUserLinks(ctx context.Context, userID uint, page, pageSize int) ([]Link, int64, error) {
	// 列表数据通常缓存时间较短
	key := fmt.Sprintf("user:%d:links:%d:%d", userID, page, pageSize)

	// 尝试从缓存获取
	type ListResult struct {
		Links []Link
		Total int64
	}
	var cached ListResult
	err := lc.cache.Get(ctx, key, &cached, TemperatureWarm)
	if err == nil {
		return cached.Links, cached.Total, nil
	}

	// 从数据库查询
	var links []Link
	var total int64

	offset := (page - 1) * pageSize
	err = lc.db.WithContext(ctx).Model(&Link{}).Where("user_id = ?", userID).
		Count(&total).
		Offset(offset).
		Limit(pageSize).
		Order("created_at DESC").
		Find(&links).Error

	if err != nil {
		return nil, 0, err
	}

	// 写入缓存（较短时间）
	result := ListResult{Links: links, Total: total}
	_ = lc.cache.SetWithTTL(ctx, key, result, 5*time.Minute)

	return links, total, nil
}

// Link 短链接模型
type Link struct {
	ID        uint      `gorm:"primarykey"`
	Code      string    `gorm:"uniqueIndex;size:20"`
	URL       string    `gorm:"type:text;not null"`
	UserID    uint      `gorm:"index"`
	ExpiresAt *time.Time `gorm:"index"`
	CreatedAt time.Time
	UpdatedAt time.Time
}
