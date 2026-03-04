package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"github.com/surls/backend/internal/models"
)

// LinkCache 短链接缓存服务
type LinkCache struct {
	cache   *RedisCache
	db      *gorm.DB
	lockMgr *LockManager
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
// 支持域名隔离：使用 code + domainID 作为缓存键
func (lc *LinkCache) GetLink(ctx context.Context, code string, domainID uint) (*models.ShortLink, error) {
	key := lc.buildLinkKey(code, domainID)

	// 1. 尝试从所有温度级别的缓存获取（hot -> warm -> cold）
	var link models.ShortLink
	temperatures := []DataTemperature{TemperatureHot, TemperatureWarm, TemperatureCold}
	var foundTemp DataTemperature
	var err error

	for _, temp := range temperatures {
		err = lc.cache.Get(ctx, key, &link, temp)
		if err == nil {
			// 缓存命中，检查链接状态
			if lc.isLinkValid(&link) {
				foundTemp = temp
				break
			}
			// 缓存的链接已失效，删除缓存
			_ = lc.cache.Delete(ctx, key)
		}
	}

	if foundTemp != "" {
		// 缓存命中，记录访问并可能升级温度
		_ = lc.cache.IncrementAccess(ctx, key)

		// 如果是冷或温数据，考虑升级温度
		if foundTemp == TemperatureCold || foundTemp == TemperatureWarm {
			count, _ := lc.cache.GetAccessCount(ctx, key)
			newTemp := lc.classifyTemperature(count)
			if newTemp != foundTemp {
				// 升级温度
				_ = lc.cache.Set(ctx, key, &link, newTemp)
			}
		}

		return &link, nil
	}

	// 2. 缓存未命中，使用分布式锁防止缓存穿透
	lockKey := fmt.Sprintf("query:link:%s:%d", code, domainID)
	err = lc.lockMgr.WithLock(ctx, lockKey, 10*time.Second, func() error {
		// 二次检查缓存（所有温度）
		for _, temp := range temperatures {
			err := lc.cache.Get(ctx, key, &link, temp)
			if err == nil && lc.isLinkValid(&link) {
				_ = lc.cache.IncrementAccess(ctx, key)
				return nil
			}
		}

		// 从数据库查询
		err = lc.db.WithContext(ctx).
			Where("code = ? AND domain_id = ?", code, domainID).
			First(&link).Error
		if err != nil {
			// 缓存空值防止穿透
			if err == gorm.ErrRecordNotFound {
				_ = lc.cache.SetWithTTL(ctx, key+":empty", nil, 5*time.Minute)
			}
			return err
		}

		// 检查链接有效性
		if !lc.isLinkValid(&link) {
			// 链接已失效，返回错误
			if link.Status == models.LinkStatusDisabled {
				return fmt.Errorf("link is disabled")
			}
			if link.ExpiresAt != nil && link.ExpiresAt.Before(time.Now()) {
				return fmt.Errorf("link has expired")
			}
			return fmt.Errorf("link not found")
		}

		// 新数据从冷数据开始缓存
		temperature := TemperatureCold
		_ = lc.cache.Set(ctx, key, &link, temperature)
		_ = lc.cache.IncrementAccess(ctx, key)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &link, nil
}

// CreateLink 创建短链接后更新缓存（写透策略）
func (lc *LinkCache) CreateLink(ctx context.Context, link *models.ShortLink) error {
	// 写透策略：先写数据库（在调用此方法前已完成），再更新缓存
	// 新链接从冷数据开始，随着访问次数增加自动升级
	key := lc.buildLinkKey(link.Code, link.DomainID)
	_ = lc.cache.Set(ctx, key, link, TemperatureCold)
	return nil
}

// UpdateLink 更新短链接（绕写策略：删除缓存，下次访问时重新加载）
func (lc *LinkCache) UpdateLink(ctx context.Context, link *models.ShortLink) error {
	// 删除缓存，下次访问时从数据库重新加载
	key := lc.buildLinkKey(link.Code, link.DomainID)
	_ = lc.cache.Delete(ctx, key)
	return nil
}

// DeleteLink 删除短链接（删除缓存）
func (lc *LinkCache) DeleteLink(ctx context.Context, code string, domainID uint) error {
	key := lc.buildLinkKey(code, domainID)
	_ = lc.cache.Delete(ctx, key)
	return nil
}

// InvalidateUserCache 使用户所有短链接缓存失效
func (lc *LinkCache) InvalidateUserCache(ctx context.Context, userID uint) error {
	// 删除用户相关的所有缓存
	pattern := fmt.Sprintf("cache:*:link:user:%d:*", userID)
	return lc.cache.DeleteByPattern(ctx, pattern)
}

// InvalidateDomainCache 使域名的所有短链接缓存失效
func (lc *LinkCache) InvalidateDomainCache(ctx context.Context, domainID uint) error {
	pattern := fmt.Sprintf("cache:*:link:domain:%d:*", domainID)
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

// buildLinkKey 构建短链接缓存键
// 格式: link:{code}:{domainID} 确保多域名隔离
func (lc *LinkCache) buildLinkKey(code string, domainID uint) string {
	return fmt.Sprintf("link:%s:%d", code, domainID)
}

// isLinkValid 检查链接是否有效
func (lc *LinkCache) isLinkValid(link *models.ShortLink) bool {
	// 检查状态
	if link.Status != models.LinkStatusActive {
		return false
	}
	// 检查过期时间
	if link.ExpiresAt != nil && link.ExpiresAt.Before(time.Now()) {
		return false
	}
	return true
}

// GetHotLinks 获取热点短链接（用于缓存预热）
func (lc *LinkCache) GetHotLinks(ctx context.Context, limit int) ([]string, error) {
	// 从 Redis Sorted Set 获取访问量最高的短码
	return lc.cache.GetHotLinks(ctx, limit)
}

// WarmCache 预热缓存（批量加载热点链接到 Redis）
func (lc *LinkCache) WarmCache(ctx context.Context) error {
	// 获取热点链接代码
	codes, err := lc.GetHotLinks(ctx, 100)
	if err != nil {
		return err
	}

	// 批量加载到缓存
	for _, codeKey := range codes {
		// codeKey 格式: "code:domainID"
		// 这里需要解析出 code 和 domainID
		// 简化处理：直接从数据库查询
		var links []models.ShortLink
		err := lc.db.WithContext(ctx).
			Where("code = ?", codeKey).
			Find(&links).Error
		if err == nil {
			for _, link := range links {
				key := lc.buildLinkKey(link.Code, link.DomainID)
				_ = lc.cache.Set(ctx, key, &link, TemperatureHot)
			}
		}
	}

	return nil
}

// GetUserLinks 获取用户链接列表（带缓存）
func (lc *LinkCache) GetUserLinks(ctx context.Context, userID uint, page, pageSize int) ([]models.ShortLink, int64, error) {
	// 列表数据通常缓存时间较短
	key := fmt.Sprintf("user:%d:links:%d:%d", userID, page, pageSize)

	// 尝试从缓存获取
	type ListResult struct {
		Links []models.ShortLink `json:"links"`
		Total int64              `json:"total"`
	}
	var cached ListResult
	err := lc.cache.Get(ctx, key, &cached, TemperatureWarm)
	if err == nil {
		return cached.Links, cached.Total, nil
	}

	// 从数据库查询
	var links []models.ShortLink
	var total int64

	offset := (page - 1) * pageSize
	err = lc.db.WithContext(ctx).Model(&models.ShortLink{}).Where("user_id = ?", userID).
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
