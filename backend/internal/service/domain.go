package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
	"github.com/surls/backend/pkg/utils"
)

const (
	// domainNotFoundMarker 用于标记缓存中不存在的域名
	domainNotFoundMarker = "\x00"
	// domainNotFoundTTL 不存在域名的缓存TTL（秒）
	domainNotFoundTTL = 5 * 60
)

// domainCacheEntry 域名缓存条目
type domainCacheEntry struct {
	domain    *models.Domain
	notFound  bool      // 是否为不存在标记
	expiresAt time.Time // 过期时间
}

// DomainService 域名服务
type DomainService struct {
	domainRepo *repository.DomainRepository
	cache      map[string]*domainCacheEntry // 内存缓存（支持缓存穿透保护）
	cacheMu    sync.RWMutex                 // 保护缓存的读写锁
}

// NewDomainService 创建域名服务
func NewDomainService(domainRepo *repository.DomainRepository) *DomainService {
	s := &DomainService{
		domainRepo: domainRepo,
		cache:      make(map[string]*domainCacheEntry),
	}
	// 启动时加载缓存
	s.loadCache(context.Background())
	return s
}

// loadCache 加载域名缓存
func (s *DomainService) loadCache(ctx context.Context) error {
	domains, err := s.domainRepo.ListActive(ctx)
	if err != nil {
		return err
	}

	newCache := make(map[string]*domainCacheEntry)
	now := time.Now()
	for _, domain := range domains {
		newCache[domain.Name] = &domainCacheEntry{
			domain:    &domain,
			notFound:  false,
			expiresAt: now.Add(time.Hour), // 有效域名缓存1小时
		}
	}

	s.cacheMu.Lock()
	s.cache = newCache
	s.cacheMu.Unlock()

	return nil
}

// RefreshCache 刷新缓存
func (s *DomainService) RefreshCache(ctx context.Context) error {
	return s.loadCache(ctx)
}

// CreateRequest 创建域名请求
type CreateDomainRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	SSL         bool   `json:"ssl"`
	IsActive    bool   `json:"is_active"`
}

// Create 创建域名
func (s *DomainService) Create(ctx context.Context, req *CreateDomainRequest) (*models.Domain, error) {
	// 验证域名格式
	if !utils.IsValidDomainOrHost(req.Name) {
		return nil, apperrors.ErrInvalidDomainFormat
	}

	// 检查域名是否已存在
	_, err := s.domainRepo.FindByName(ctx, req.Name)
	if err == nil {
		return nil, apperrors.ErrDuplicateResource
	}

	domain := &models.Domain{
		Name:        req.Name,
		IsActive:    req.IsActive,
		IsDefault:   false,
		SSL:         req.SSL,
		Description: req.Description,
	}

	if err := s.domainRepo.Create(ctx, domain); err != nil {
		return nil, err
	}

	// 刷新缓存
	s.RefreshCache(ctx)

	return domain, nil
}

// List 获取所有域名
func (s *DomainService) List(ctx context.Context) ([]models.Domain, error) {
	return s.domainRepo.List(ctx)
}

// ListActive 获取所有启用的域名
func (s *DomainService) ListActive(ctx context.Context) ([]models.Domain, error) {
	return s.domainRepo.ListActive(ctx)
}

// GetDefault 获取默认域名
func (s *DomainService) GetDefault(ctx context.Context) (*models.Domain, error) {
	domain, err := s.domainRepo.GetDefault(ctx)
	if err != nil {
		return nil, err
	}
	return domain, nil
}

// GetDefaultURL 获取默认域名的完整URL
func (s *DomainService) GetDefaultURL(ctx context.Context) (string, error) {
	domain, err := s.GetDefault(ctx)
	if err != nil {
		return "", err
	}
	return s.domainRepo.BuildDomainURL(domain), nil
}

// SetDefault 设置默认域名
func (s *DomainService) SetDefault(ctx context.Context, id uint) error {
	if err := s.domainRepo.SetDefault(ctx, id); err != nil {
		return err
	}
	return s.RefreshCache(ctx)
}

// Update 更新域名
type UpdateDomainRequest struct {
	ID          uint
	Name        *string `json:"name"`
	Description *string `json:"description"`
	SSL         *bool   `json:"ssl"`
	IsActive    *bool   `json:"is_active"`
}

// Update 更新域名
func (s *DomainService) Update(ctx context.Context, req *UpdateDomainRequest) error {
	// 构建要更新的字段映射
	updates := make(map[string]interface{})

	if req.Name != nil {
		// 验证域名格式
		if !utils.IsValidDomainOrHost(*req.Name) {
			return apperrors.ErrInvalidDomainFormat
		}
		// 检查新名称是否已被其他域名使用
		existing, err := s.domainRepo.FindByName(ctx, *req.Name)
		if err == nil && existing.ID != req.ID {
			return apperrors.ErrDuplicateResource
		}
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.SSL != nil {
		updates["ssl"] = *req.SSL
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	// 如果没有需要更新的字段，直接返回
	if len(updates) == 0 {
		return nil
	}

	// 使用 Updates 显式更新指定字段
	if err := s.domainRepo.UpdateFields(ctx, req.ID, updates); err != nil {
		return err
	}

	return s.RefreshCache(ctx)
}

// Delete 删除域名
func (s *DomainService) Delete(ctx context.Context, id uint) error {
	domain, err := s.domainRepo.FindByID(ctx, id)
	if err != nil {
		return err
	}

	// 不允许删除默认域名
	if domain.IsDefault {
		return apperrors.ErrInvalidInput
	}

	if err := s.domainRepo.Delete(ctx, id); err != nil {
		return err
	}

	return s.RefreshCache(ctx)
}

// BuildShortURL 为指定域名构建短链接URL
func (s *DomainService) BuildShortURL(ctx context.Context, code string, domainName string) (string, error) {
	var domain *models.Domain
	var err error

	if domainName == "" {
		// 使用默认域名
		domain, err = s.GetDefault(ctx)
		if err != nil {
			return "", err
		}
	} else {
		// 从缓存或数据库查找指定域名
		s.cacheMu.RLock()
		cachedEntry, ok := s.cache[domainName]
		s.cacheMu.RUnlock()

		now := time.Now()

		if ok && !cachedEntry.isExpired(now) {
			// 缓存命中且未过期
			if cachedEntry.notFound {
				return "", apperrors.ErrInvalidInput
			}
			domain = cachedEntry.domain
		} else {
			// 缓存未命中或已过期，查询数据库
			domain, err = s.domainRepo.FindByName(ctx, domainName)
			if err != nil {
				// 缓存不存在的结果（防止缓存穿透）
				s.cacheMu.Lock()
				s.cache[domainName] = &domainCacheEntry{
					domain:    nil,
					notFound:  true,
					expiresAt: now.Add(time.Duration(domainNotFoundTTL) * time.Second),
				}
				s.cacheMu.Unlock()
				return "", err
			}
			// 缓存查询结果
			s.cacheMu.Lock()
			s.cache[domainName] = &domainCacheEntry{
				domain:    domain,
				notFound:  false,
				expiresAt: now.Add(time.Hour),
			}
			s.cacheMu.Unlock()
		}
	}

	// 检查是否启用
	if !domain.IsActive {
		return "", apperrors.ErrInvalidInput
	}

	baseURL := s.domainRepo.BuildDomainURL(domain)
	return fmt.Sprintf("%s/r/%s", baseURL, code), nil
}

// IsValidDomain 检查域名是否有效（已配置且启用）
func (s *DomainService) IsValidDomain(ctx context.Context, domainName string) bool {
	s.cacheMu.RLock()
	cachedEntry, ok := s.cache[domainName]
	s.cacheMu.RUnlock()

	now := time.Now()

	if ok && !cachedEntry.isExpired(now) {
		// 缓存命中且未过期
		if cachedEntry.notFound {
			return false
		}
		return cachedEntry.domain.IsActive
	}

	// 缓存未命中或已过期，查询数据库
	domain, err := s.domainRepo.FindByName(ctx, domainName)
	if err != nil {
		// 缓存不存在的结果（防止缓存穿透）
		s.cacheMu.Lock()
		s.cache[domainName] = &domainCacheEntry{
			domain:    nil,
			notFound:  true,
			expiresAt: now.Add(time.Duration(domainNotFoundTTL) * time.Second),
		}
		s.cacheMu.Unlock()
		return false
	}

	// 更新缓存
	s.cacheMu.Lock()
	s.cache[domainName] = &domainCacheEntry{
		domain:    domain,
		notFound:  false,
		expiresAt: now.Add(time.Hour),
	}
	s.cacheMu.Unlock()

	return domain.IsActive
}

// isExpired 检查缓存条目是否已过期
func (e *domainCacheEntry) isExpired(now time.Time) bool {
	return now.After(e.expiresAt)
}
