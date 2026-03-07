package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
	"github.com/surls/backend/pkg/cache"
	"github.com/surls/backend/pkg/shortcode"
	"github.com/surls/backend/pkg/urlutil"
	"github.com/surls/backend/pkg/worker"
)

// LinkService 短链接服务
type LinkService struct {
	linkRepo        *repository.ShortLinkRepository
	userRepo        *repository.UserRepository
	domainRepo      *repository.DomainRepository
	accessLogService *AccessLogService // 使用访问日志服务
	configService   *ConfigService     // 用于获取动态配置
	generator       *shortcode.Generator
	baseURL         string // 短链基础域名
	clickCounter    *cache.ClickCounter // 点击计数器
	workerPool      *worker.Pool // Worker Pool 用于异步任务
	circularCheck    func(url string) bool // 循环链接检测函数
	lastConfigCheck time.Time // 上次检查配置的时间
	currentMode     shortcode.GeneratorMode // 当前缓存的模式
	configCheckMu   sync.RWMutex // 配置检查锁
	linkCache       *cache.LinkCache // 短链接缓存（可选，用于性能优化）
	redisCache      *cache.RedisCache // Redis 缓存（用于域名、模板等缓存）
}

// NewLinkService 创建短链接服务
func NewLinkService(
	linkRepo *repository.ShortLinkRepository,
	userRepo *repository.UserRepository,
	domainRepo *repository.DomainRepository,
	accessLogService *AccessLogService,
	configService *ConfigService,
	generator *shortcode.Generator,
	baseURL string,
	clickCounter *cache.ClickCounter,
	workerPool *worker.Pool,
	linkCache *cache.LinkCache,
	redisCache *cache.RedisCache,
) *LinkService {
	return &LinkService{
		linkRepo:         linkRepo,
		userRepo:         userRepo,
		domainRepo:       domainRepo,
		accessLogService: accessLogService,
		configService:    configService,
		generator:        generator,
		baseURL:          baseURL,
		clickCounter:     clickCounter,
		workerPool:       workerPool,
		circularCheck:    func(url string) bool { return false }, // 默认不检测
		currentMode:      generator.GetMode(), // 初始化当前模式
		linkCache:        linkCache,
		redisCache:       redisCache,
	}
}

// CreateLinkRequest 创建短链接请求
type CreateLinkRequest struct {
	URL        string    `json:"url" binding:"required"`
	Code       string    `json:"code"`
	Title      string    `json:"title"`
	ExpiresAt  time.Time `json:"expires_at"`
	UserID     uint      `json:"-"`
	DomainID   uint      `json:"domain_id"`   // 域名ID，用于多域名隔离
	TemplateID *uint     `json:"template_id"` // 跳转模板ID
}

// CreateLinkResponse 创建短链接响应
type CreateLinkResponse struct {
	Code        string    `json:"code"`
	ShortURL    string    `json:"short_url"`
	OriginalURL string    `json:"original_url"`
	Title       string    `json:"title"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

// SetCircularCheck 设置循环链接检测函数
func (s *LinkService) SetCircularCheck(fn func(url string) bool) {
	s.circularCheck = fn
}

// updateGeneratorModeIfNeeded 检查并更新短码生成器配置（每分钟最多检查一次）
func (s *LinkService) updateGeneratorModeIfNeeded(ctx context.Context) {
	now := time.Now()
	s.configCheckMu.RLock()
	needsUpdate := now.Sub(s.lastConfigCheck) > time.Minute
	s.configCheckMu.RUnlock()

	if !needsUpdate {
		return
	}

	s.configCheckMu.Lock()
	defer s.configCheckMu.Unlock()

	// 双重检查
	if now.Sub(s.lastConfigCheck) <= time.Minute {
		return
	}

	s.lastConfigCheck = now

	// 从配置服务获取短码配置
	if s.configService == nil {
		return
	}

	configs, err := s.configService.GetAllConfig(ctx)
	if err != nil {
		log.Printf("Failed to get shortcode config: %v", err)
		return
	}

	// 获取配置的模式
	modeStr := configs[models.ConfigShortcodeMode]
	if modeStr == "" {
		modeStr = "sequence" // 默认值
	}

	// 确定新模式
	var newMode shortcode.GeneratorMode
	if modeStr == "random" {
		newMode = shortcode.ModeRandom
	} else {
		newMode = shortcode.ModeSequence
	}

	// 如果模式改变，更新生成器
	if newMode != s.currentMode {
		log.Printf("Shortcode mode changed: %v -> %v", s.currentMode, newMode)
		s.generator.SetMode(newMode)
		s.currentMode = newMode
	}

	// 获取并更新短码长度
	if lengthStr := configs[models.ConfigMaxLinkLength]; lengthStr != "" {
		if length, err := strconv.Atoi(lengthStr); err == nil && length >= 3 && length <= 20 {
			s.generator.SetLength(length)
		}
	}
}

// Create 创建短链接
func (s *LinkService) Create(ctx context.Context, req *CreateLinkRequest) (*CreateLinkResponse, error) {
	// 检查并更新短码生成器模式（配置可能已动态更改）
	s.updateGeneratorModeIfNeeded(ctx)

	// 规范化 URL
	normalizedURL, err := urlutil.NormalizeURL(req.URL)
	if err != nil {
		return nil, apperrors.ErrInvalidInput
	}

	// 验证 URL 有效性
	if !urlutil.IsValidURL(normalizedURL) {
		return nil, apperrors.ErrInvalidInput
	}

	// 检查循环链接（防止指向本系统自己的 URL）
	if s.circularCheck != nil && s.circularCheck(normalizedURL) {
		return nil, fmt.Errorf("cannot create short link to internal URL")
	}

	// 获取用户信息（用于事务中配额检查）
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return nil, apperrors.ErrUserNotFound
	}

	if user.Status != models.UserStatusActive {
		return nil, apperrors.ErrUserDisabled
	}

	// 设置默认域名ID（如果没有指定，使用默认域名1）
	domainID := req.DomainID
	if domainID == 0 {
		domainID = 1
	}

	// 检查用户是否有权限使用该域名
	if !s.checkDomainAccess(ctx, user, domainID) {
		return nil, fmt.Errorf("user does not have permission to use this domain")
	}

	// 检查是否去重（相同 URL 复用）- 需要考虑 domain_id
	existingLink, err := s.linkRepo.FindByURLAndDomain(ctx, req.UserID, normalizedURL, domainID)
	if err == nil && existingLink != nil {
		// 检查是否过期
		if existingLink.ExpiresAt == nil || existingLink.ExpiresAt.After(time.Now()) {
			// 比较时效，如果新请求的时效更长，则更新
			needUpdate := false
			newExpiresAt := req.ExpiresAt

			if existingLink.ExpiresAt == nil {
				// 已存在链接是永久的，只有当新请求也是永久时才不更新
				needUpdate = !newExpiresAt.IsZero()
			} else if newExpiresAt.IsZero() {
				// 新请求是永久的，已存在链接有时效，更新为永久
				needUpdate = true
			} else if newExpiresAt.After(*existingLink.ExpiresAt) {
				// 新请求的时效更长
				needUpdate = true
			}

			if needUpdate {
				// 更新为最长时效
				var updatedExpiresAt *time.Time
				if !newExpiresAt.IsZero() {
					if newExpiresAt.Before(time.Now()) {
						return nil, apperrors.ErrExpired
					}
					updatedExpiresAt = &newExpiresAt
				}

				existingLink.ExpiresAt = updatedExpiresAt
				if err := s.linkRepo.Update(ctx, existingLink); err != nil {
					return nil, err
				}

				// 失效缓存
				if s.linkCache != nil {
					_ = s.linkCache.UpdateLink(ctx, existingLink)
				}

				return &CreateLinkResponse{
					Code:        existingLink.Code,
					ShortURL:    s.buildShortURLWithDomain(existingLink.Code, domainID),
					OriginalURL: existingLink.URL,
					Title:       existingLink.Title,
					ExpiresAt:   updatedExpiresAt,
				}, nil
			}

			// 时效相同或已存在链接的时效更长，直接返回
			return &CreateLinkResponse{
				Code:        existingLink.Code,
				ShortURL:    s.buildShortURLWithDomain(existingLink.Code, domainID),
				OriginalURL: existingLink.URL,
				Title:       existingLink.Title,
				ExpiresAt:   existingLink.ExpiresAt,
			}, nil
		}
	}

	// 生成短码和创建链接（带重试机制处理 code 冲突）
	const maxCreateRetries = 3
	var lastErr error

	for retry := 0; retry < maxCreateRetries; retry++ {
		var code string
		if req.Code != "" {
			if retry > 0 {
				return nil, apperrors.ErrCodeTaken
			}
			code, err = s.generator.GenerateCustom(ctx, req.Code)
			if err != nil {
				return nil, err
			}
		} else {
			code, err = s.generator.Generate(ctx)
			if err != nil {
				return nil, err
			}
		}

		var expiresAt *time.Time
		if !req.ExpiresAt.IsZero() {
			if req.ExpiresAt.Before(time.Now()) {
				return nil, apperrors.ErrExpired
			}
			expiresAt = &req.ExpiresAt
		}

		link := &models.ShortLink{
			Code:       code,
			DomainID:   domainID,
			TemplateID: req.TemplateID,
			URL:        normalizedURL,
			UserID:     req.UserID,
			Title:      req.Title,
			ExpiresAt:  expiresAt,
			Status:     models.LinkStatusActive,
		}

		lastErr = s.linkRepo.CreateWithQuotaCheck(ctx, link, user)
		if lastErr == nil {
			if s.linkCache != nil {
				_ = s.linkCache.CreateLink(ctx, link)
			}
			return &CreateLinkResponse{
				Code:        code,
				ShortURL:    s.buildShortURLWithDomain(code, domainID),
				OriginalURL: normalizedURL,
				Title:       req.Title,
				ExpiresAt:   expiresAt,
			}, nil
		}

		// 随机短码冲突时重试
		if req.Code == "" && retry < maxCreateRetries-1 {
			continue
		}
	}

	return nil, lastErr
}

// GetLink 获取短链接信息
func (s *LinkService) GetLink(ctx context.Context, code string, userID uint, isAdmin bool) (*models.ShortLink, error) {
	link, err := s.linkRepo.FindByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// 检查状态
	if link.Status == models.LinkStatusDisabled {
		return nil, apperrors.ErrLinkDisabled
	}

	// 检查过期
	if link.ExpiresAt != nil && link.ExpiresAt.Before(time.Now()) {
		return nil, apperrors.ErrLinkExpired
	}

	// 权限检查：只有管理员或链接创建者可以查看详情
	if !isAdmin && link.UserID != userID {
		return nil, apperrors.ErrForbidden
	}

	return link, nil
}

// ResolveOptions 解析选项
type ResolveOptions struct {
	IP        string
	UserAgent string
	Referer   string
	Host      string // 请求的 Host，用于分域名跳转
	DomainID  uint   // 域名ID，用于域名隔离（已废弃，保留兼容性）
}

// Resolve 解析短链接（用于跳转）并记录访问日志
// 支持分域名跳转：根据请求的 Host 查找对应的域名，然后用 code 和 domain_id 查询链接
// 优先从缓存读取，缓存未命中时查询数据库
func (s *LinkService) Resolve(ctx context.Context, code string, opts *ResolveOptions) (*models.ShortLink, error) {
	var link *models.ShortLink
	var err error

	// 根据请求的 Host 查找域名
	var domainID uint
	var domainFound bool

	if opts != nil && opts.Host != "" {
		// 从 Host 中提取域名（去除端口）
		host := opts.Host
		if parts := strings.Split(host, ":"); len(parts) > 1 {
			host = parts[0]
		}

		// 优先从 Redis 缓存获取域名
		if s.redisCache != nil {
			var modelsDomain models.Domain
			cacheErr := s.redisCache.GetDomain(ctx, host, &modelsDomain)
			if cacheErr == nil && modelsDomain.ID != 0 && modelsDomain.IsActive {
				domainID = modelsDomain.ID
				domainFound = true
			}
		}

		// 缓存未命中，从数据库查询
		if !domainFound {
			domain, findErr := s.domainRepo.FindByName(ctx, host)
			if findErr == nil && domain != nil && domain.IsActive {
				domainID = domain.ID
				domainFound = true
				// 写入缓存
				if s.redisCache != nil {
					_ = s.redisCache.SetDomain(ctx, host, domain)
				}
			}
		}
		// 如果找不到域名或域名未启用，不回退，直接返回 404
	}

	// 如果没有找到匹配的域名，返回 404（不回退到默认域名）
	if !domainFound {
		return nil, apperrors.ErrNotFound
	}

	// 优先从缓存获取链接（如果缓存可用）
	if s.linkCache != nil {
		link, err = s.linkCache.GetLink(ctx, code, domainID)
		if err == nil {
			// 缓存命中，记录访问日志
			s.recordAccessAsync(ctx, link.ID, code, opts)
			return link, nil
		}
		// 缓存未命中或出错，继续查询数据库
	}

	// 从数据库查询链接
	link, err = s.linkRepo.FindByCodeAndDomain(ctx, code, domainID)
	if err != nil {
		return nil, err
	}

	// 检查状态
	if link.Status == models.LinkStatusDisabled {
		return nil, apperrors.ErrLinkDisabled
	}

	// 检查过期
	if link.ExpiresAt != nil && link.ExpiresAt.Before(time.Now()) {
		// 删除过期记录
		_ = s.linkRepo.Delete(ctx, link.ID)
		// 失效缓存
		if s.linkCache != nil {
			_ = s.linkCache.DeleteLink(ctx, code, domainID)
		}
		// 返回 404 而不是 410
		return nil, apperrors.ErrLinkNotFound
	}

	// 异步记录访问日志
	s.recordAccessAsync(ctx, link.ID, code, opts)

	return link, nil
}

// recordAccessAsync 异步记录访问日志（避免阻塞请求）
func (s *LinkService) recordAccessAsync(ctx context.Context, linkID uint, code string, opts *ResolveOptions) {
	// 异步更新点击计数和访问日志（使用 Worker Pool 防止无界 Goroutine）
	if s.workerPool != nil {
		// 使用 Worker Pool
		optsCopy := *opts
		task := func() {
			s.recordAccess(context.Background(), linkID, code, &optsCopy)
		}

		// 非阻塞提交，如果队列满了则丢弃（避免阻塞请求）
		if !s.workerPool.Submit(task) {
			// Pool 已满，记录警告但继续服务
			log.Printf("WARNING: Worker pool full, dropping access record for link %d", linkID)
		}
	} else {
		// 降级到直接使用 goroutine（不推荐，但保持向后兼容）
		go s.recordAccess(context.Background(), linkID, code, opts)
	}
}

// recordAccess 记录访问日志和点击计数
func (s *LinkService) recordAccess(ctx context.Context, linkID uint, code string, opts *ResolveOptions) {
	// 使用 Redis 点击计数器（高性能）
	if s.clickCounter != nil {
		if err := s.clickCounter.Increment(ctx, linkID); err != nil {
			log.Printf("WARNING: Failed to increment click count via Redis for link %d: %v", linkID, err)
			// 降级：直接更新数据库
			if err := s.linkRepo.IncrementClickCount(ctx, code); err != nil {
				log.Printf("WARNING: Failed to increment click count (fallback) for link %s: %v", code, err)
			}
		}
	} else {
		// 没有点击计数器，直接更新数据库
		if err := s.linkRepo.IncrementClickCount(ctx, code); err != nil {
			log.Printf("WARNING: Failed to increment click count for link %s: %v", code, err)
		}
	}

	// 记录访问日志（使用缓冲区批量写入）
	if opts != nil && s.accessLogService != nil {
		if err := s.accessLogService.Record(ctx, linkID, opts.IP, opts.UserAgent, opts.Referer); err != nil {
			log.Printf("WARNING: Failed to record access log for link %d: %v", linkID, err)
		}
	}
}

// ListLinks 获取用户的短链接列表
type ListLinksRequest struct {
	UserID   uint `json:"-"`
	Page     int  `json:"page"`
	PageSize int  `json:"page_size"`
}

// ListLinksResponse 列表响应
type ListLinksResponse struct {
	Links     []*models.ShortLink `json:"links"`
	Total     int64              `json:"total"`
	Page      int                `json:"page"`
	PageSize  int                `json:"page_size"`
	TotalPage int                `json:"total_page"`
}

// List 获取短链接列表
func (s *LinkService) List(ctx context.Context, req *ListLinksRequest) (*ListLinksResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	links, total, err := s.linkRepo.ListByUser(ctx, req.UserID, req.Page, req.PageSize)
	if err != nil {
		return nil, err
	}

	totalPage := int(total) / req.PageSize
	if int(total)%req.PageSize > 0 {
		totalPage++
	}

	return &ListLinksResponse{
		Links:     convertLinkPtrs(links),
		Total:     total,
		Page:      req.Page,
		PageSize:  req.PageSize,
		TotalPage: totalPage,
	}, nil
}

// UpdateLink 更新短链接
type UpdateLinkRequest struct {
	Code       string     `json:"-" binding:"-"`
	URL        string     `json:"url"`
	Title      string     `json:"title"`
	ExpiresAt  *time.Time `json:"expires_at"`
	Status     models.LinkStatus `json:"status"`
	TemplateID *uint      `json:"template_id"` // 跳转模板ID
}

// Update 更新短链接
func (s *LinkService) Update(ctx context.Context, req *UpdateLinkRequest, userID uint, isAdmin bool) error {
	link, err := s.linkRepo.FindByCode(ctx, req.Code)
	if err != nil {
		return err
	}

	// 检查所有权（管理员可以编辑所有链接）
	if !isAdmin && link.UserID != userID {
		return apperrors.ErrForbidden
	}

	// 更新字段
	if req.URL != "" {
		normalizedURL, err := urlutil.NormalizeURL(req.URL)
		if err != nil || !urlutil.IsValidURL(normalizedURL) {
			return apperrors.ErrInvalidInput
		}
		link.URL = normalizedURL
	}

	if req.Title != "" {
		link.Title = req.Title
	}

	if req.ExpiresAt != nil {
		if req.ExpiresAt.Before(time.Now()) {
			return apperrors.ErrExpired
		}
		link.ExpiresAt = req.ExpiresAt
	}

	if req.Status != "" {
		link.Status = req.Status
	}

	// 更新模板ID（允许修改）
	link.TemplateID = req.TemplateID

	if err := s.linkRepo.Update(ctx, link); err != nil {
		return err
	}

	// 失效缓存（绕写策略）
	if s.linkCache != nil {
		_ = s.linkCache.UpdateLink(ctx, link)
	}

	return nil
}

// Delete 删除短链接
func (s *LinkService) Delete(ctx context.Context, code string, userID uint, isAdmin bool) error {
	// 先获取链接ID和用户ID验证
	link, err := s.linkRepo.FindByCode(ctx, code)
	if err != nil {
		return err
	}

	// 检查所有权（管理员可以删除所有链接）
	if !isAdmin && link.UserID != userID {
		return apperrors.ErrForbidden
	}

	// 使用带配额返还的事务方法删除链接
	if err := s.linkRepo.DeleteWithQuotaRefund(ctx, link.ID, userID); err != nil {
		return err
	}

	// 删除缓存
	if s.linkCache != nil {
		_ = s.linkCache.DeleteLink(ctx, link.Code, link.DomainID)
	}

	return nil
}

// LinkStats 链接统计
type LinkStats struct {
	ClickCount int64  `json:"click_count"`
	UniqueIPs  int64  `json:"unique_ips"`
	CreatedAt  string `json:"created_at"`
}

// GetStats 获取链接统计信息（优先使用 Redis 计数器）
func (s *LinkService) GetStats(ctx context.Context, code string, userID uint) (*LinkStats, error) {
	link, err := s.linkRepo.FindByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// 检查所有权（管理员可以查看所有）
	if link.UserID != userID {
		return nil, apperrors.ErrForbidden
	}

	var clickCount int64
	var uniqueIPs int64

	// 优先从 Redis 计数器获取实时点击数
	if s.clickCounter != nil {
		if count, err := s.clickCounter.GetCount(ctx, link.ID); err == nil {
			clickCount = count
		} else {
			// 降级：使用数据库中的计数
			clickCount = int64(link.ClickCount)
		}
	} else {
		clickCount = int64(link.ClickCount)
	}

	// 从访问日志获取唯一IP统计
	if s.accessLogService != nil {
		_, uniqueIPs, err = s.accessLogService.GetStats(ctx, link.ID)
		if err != nil {
			uniqueIPs = 0
		}
	}

	return &LinkStats{
		ClickCount: clickCount,
		UniqueIPs:  uniqueIPs,
		CreatedAt:  link.CreatedAt.Format(time.RFC3339),
	}, nil
}

// GetAccessLogs 获取链接的访问日志
func (s *LinkService) GetAccessLogs(ctx context.Context, code string, userID uint, page, pageSize int) ([]models.AccessLog, int64, error) {
	// 获取链接并验证所有权
	link, err := s.linkRepo.FindByCode(ctx, code)
	if err != nil {
		return nil, 0, err
	}

	// 检查所有权
	if link.UserID != userID {
		return nil, 0, apperrors.ErrForbidden
	}

	// 获取访问日志
	return s.accessLogService.GetRecentLogs(ctx, link.ID, page, pageSize)
}

// URLHash 计算 URL 哈希（用于去重）
func URLHash(url string) string {
	hash := sha256.Sum256([]byte(url))
	return hex.EncodeToString(hash[:])[:16]
}

// buildShortURL 构建短链接 URL
func (s *LinkService) buildShortURL(code string) string {
	if s.baseURL == "" {
		return fmt.Sprintf("/r/%s", code)
	}
	return fmt.Sprintf("%s/r/%s", s.baseURL, code)
}

// buildShortURLWithDomain 根据域名ID构建短链接 URL
func (s *LinkService) buildShortURLWithDomain(code string, domainID uint) string {
	if s.domainRepo != nil {
		domain, err := s.domainRepo.FindByID(context.Background(), domainID)
		if err == nil && domain != nil {
			protocol := "https"
			if !domain.SSL {
				protocol = "http"
			}
			domainURL := protocol + "://" + domain.Name
			return fmt.Sprintf("%s/r/%s", domainURL, code)
		}
	}
	// 降级到基础URL
	return s.buildShortURL(code)
}

// checkDomainAccess 检查用户是否有权限使用指定域名
// 规则：
// 1. 管理员可以使用所有域名
// 2. 如果用户没有用户组，只能使用默认域名（ID=1）
// 3. 如果用户有用户组，检查用户组是否被授权使用该域名
func (s *LinkService) checkDomainAccess(ctx context.Context, user *models.User, domainID uint) bool {
	// 管理员可以使用所有域名
	if user.Role == models.RoleAdmin {
		return true
	}

	// 默认域名（ID=1）对所有用户开放
	if domainID == 1 {
		return true
	}

	// 如果用户没有用户组，不能使用非默认域名
	if user.GroupID == nil {
		return false
	}

	// 检查用户组是否有权限使用该域名
	hasAccess, err := s.domainRepo.CheckUserGroupAccessDomain(ctx, *user.GroupID, domainID)
	if err != nil {
		log.Printf("WARNING: Failed to check domain access: %v", err)
		return false
	}

	return hasAccess
}

func convertLinkPtrs(links []models.ShortLink) []*models.ShortLink {
	result := make([]*models.ShortLink, len(links))
	for i := range links {
		result[i] = &links[i]
	}
	return result
}

// ListAllLinksRequest 管理员查询短链接请求
type ListAllLinksRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	DomainID *uint  `json:"domain_id"` // 按域名过滤
	Status   *string `json:"status"`   // 按状态过滤
	UserID   *uint  `json:"user_id"`   // 按用户过滤
}

// ListAll 管理员获取所有短链接列表（支持按域名、状态、用户过滤）
func (s *LinkService) ListAll(ctx context.Context, req *ListAllLinksRequest) (*ListLinksResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	links, total, err := s.linkRepo.ListAll(ctx, req.Page, req.PageSize, req.DomainID, req.Status, req.UserID)
	if err != nil {
		return nil, err
	}

	totalPage := int(total) / req.PageSize
	if int(total)%req.PageSize > 0 {
		totalPage++
	}

	return &ListLinksResponse{
		Links:     convertLinkPtrs(links),
		Total:     total,
		Page:      req.Page,
		PageSize:  req.PageSize,
		TotalPage: totalPage,
	}, nil
}

// DeleteAsAdmin 管理员删除短链接（不检查所有权，配额返还给创建者）
func (s *LinkService) DeleteAsAdmin(ctx context.Context, linkID uint) error {
	// 获取链接信息用于缓存失效
	link, err := s.linkRepo.FindByID(ctx, linkID)
	if err != nil {
		return s.linkRepo.DeleteAsAdmin(ctx, linkID)
	}

	// 删除链接
	if err := s.linkRepo.DeleteAsAdmin(ctx, linkID); err != nil {
		return err
	}

	// 删除缓存
	if s.linkCache != nil {
		_ = s.linkCache.DeleteLink(ctx, link.Code, link.DomainID)
	}

	return nil
}

// UpdateAsAdminRequest 管理员更新短链接请求
type UpdateAsAdminRequest struct {
	LinkID     uint
	URL        string
	Title      string
	Status     models.LinkStatus
	TemplateID *uint
}

// UpdateAsAdmin 管理员更新短链接（不检查所有权）
func (s *LinkService) UpdateAsAdmin(ctx context.Context, req *UpdateAsAdminRequest) error {
	// 获取链接信息用于缓存失效
	link, err := s.linkRepo.FindByID(ctx, req.LinkID)
	if err != nil {
		// 链接不存在，直接返回
		return s.linkRepo.UpdateAsAdmin(ctx, req.LinkID, updatesFromRequest(req))
	}

	updates := make(map[string]interface{})

	if req.URL != "" {
		updates["url"] = req.URL
	}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	// TemplateID 可以为 nil，所以需要特殊处理
	updates["template_id"] = req.TemplateID

	if err := s.linkRepo.UpdateAsAdmin(ctx, req.LinkID, updates); err != nil {
		return err
	}

	// 失效缓存
	if s.linkCache != nil {
		_ = s.linkCache.UpdateLink(ctx, link)
	}

	return nil
}

// updatesFromRequest 从请求构建更新映射
func updatesFromRequest(req *UpdateAsAdminRequest) map[string]interface{} {
	updates := make(map[string]interface{})
	if req.URL != "" {
		updates["url"] = req.URL
	}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	updates["template_id"] = req.TemplateID
	return updates
}
