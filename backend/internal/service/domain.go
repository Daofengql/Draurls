package service

import (
	"context"
	"fmt"
	"sync"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// DomainService 域名服务
type DomainService struct {
	domainRepo *repository.DomainRepository
	cache      map[string]*models.Domain // 简单的内存缓存
	cacheMu    sync.RWMutex               // 保护缓存的读写锁
}

// NewDomainService 创建域名服务
func NewDomainService(domainRepo *repository.DomainRepository) *DomainService {
	s := &DomainService{
		domainRepo: domainRepo,
		cache:      make(map[string]*models.Domain),
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

	newCache := make(map[string]*models.Domain)
	for _, domain := range domains {
		newCache[domain.Name] = &domain
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
}

// Create 创建域名
func (s *DomainService) Create(ctx context.Context, req *CreateDomainRequest) (*models.Domain, error) {
	// 检查域名是否已存在
	_, err := s.domainRepo.FindByName(ctx, req.Name)
	if err == nil {
		return nil, apperrors.ErrDuplicateResource
	}

	domain := &models.Domain{
		Name:        req.Name,
		IsActive:    true,
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
	Description *string `json:"description"`
	SSL         *bool   `json:"ssl"`
	IsActive    *bool   `json:"is_active"`
}

// Update 更新域名
func (s *DomainService) Update(ctx context.Context, req *UpdateDomainRequest) error {
	domain, err := s.domainRepo.FindByID(ctx, req.ID)
	if err != nil {
		return err
	}

	if req.Description != nil {
		domain.Description = *req.Description
	}
	if req.SSL != nil {
		domain.SSL = *req.SSL
	}
	if req.IsActive != nil {
		domain.IsActive = *req.IsActive
	}

	if err := s.domainRepo.Update(ctx, domain); err != nil {
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
		cachedDomain, ok := s.cache[domainName]
		s.cacheMu.RUnlock()

		if ok {
			domain = cachedDomain
		} else {
			domain, err = s.domainRepo.FindByName(ctx, domainName)
			if err != nil {
				return "", err
			}
			// 缓存未命中，更新缓存
			s.cacheMu.Lock()
			s.cache[domainName] = domain
			s.cacheMu.Unlock()
		}
	}

	// 检查是否启用
	if !domain.IsActive {
		return "", apperrors.ErrInvalidInput
	}

	baseURL := s.domainRepo.BuildDomainURL(domain)
	return fmt.Sprintf("%s/%s", baseURL, code), nil
}

// IsValidDomain 检查域名是否有效（已配置且启用）
func (s *DomainService) IsValidDomain(ctx context.Context, domainName string) bool {
	s.cacheMu.RLock()
	cachedDomain, ok := s.cache[domainName]
	s.cacheMu.RUnlock()

	if ok {
		return cachedDomain.IsActive
	}

	// 缓存未命中，查询数据库
	domain, err := s.domainRepo.FindByName(ctx, domainName)
	if err != nil {
		return false
	}

	// 更新缓存
	s.cacheMu.Lock()
	s.cache[domainName] = domain
	s.cacheMu.Unlock()

	return domain.IsActive
}
