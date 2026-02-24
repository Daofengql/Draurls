package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
	"github.com/surls/backend/pkg/shortcode"
	"github.com/surls/backend/pkg/urlutil"
)

// LinkService 短链接服务
type LinkService struct {
	linkRepo    *repository.ShortLinkRepository
	userRepo    *repository.UserRepository
	accessLogRepo *repository.AccessLogRepository
	generator   *shortcode.Generator
	baseURL     string // 短链基础域名
}

// NewLinkService 创建短链接服务
func NewLinkService(
	linkRepo *repository.ShortLinkRepository,
	userRepo *repository.UserRepository,
	accessLogRepo *repository.AccessLogRepository,
	generator *shortcode.Generator,
	baseURL string,
) *LinkService {
	return &LinkService{
		linkRepo:      linkRepo,
		userRepo:      userRepo,
		accessLogRepo: accessLogRepo,
		generator:     generator,
		baseURL:       baseURL,
	}
}

// CreateLinkRequest 创建短链接请求
type CreateLinkRequest struct {
	URL       string    `json:"url" binding:"required"`
	Code      string    `json:"code"`
	Title     string    `json:"title"`
	ExpiresAt time.Time `json:"expires_at"`
	UserID    uint      `json:"-"`
}

// CreateLinkResponse 创建短链接响应
type CreateLinkResponse struct {
	Code        string    `json:"code"`
	ShortURL    string    `json:"short_url"`
	OriginalURL string    `json:"original_url"`
	Title       string    `json:"title"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

// Create 创建短链接
func (s *LinkService) Create(ctx context.Context, req *CreateLinkRequest) (*CreateLinkResponse, error) {
	// 规范化 URL
	normalizedURL, err := urlutil.NormalizeURL(req.URL)
	if err != nil {
		return nil, apperrors.ErrInvalidInput
	}

	// 验证 URL 有效性
	if !urlutil.IsValidURL(normalizedURL) {
		return nil, apperrors.ErrInvalidInput
	}

	// 检查用户配额
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return nil, apperrors.ErrUserNotFound
	}

	if user.Status != models.UserStatusActive {
		return nil, apperrors.ErrUserDisabled
	}

	// 检查配额
	if user.Quota >= 0 && user.QuotaUsed >= user.Quota {
		return nil, apperrors.ErrQuotaExceeded
	}

	// 检查是否去重（相同 URL 复用）
	existingLink, err := s.linkRepo.FindByURL(ctx, req.UserID, normalizedURL)
	if err == nil && existingLink != nil {
		// 检查是否过期
		if existingLink.ExpiresAt == nil || existingLink.ExpiresAt.After(time.Now()) {
			return &CreateLinkResponse{
				Code:        existingLink.Code,
				ShortURL:    s.buildShortURL(existingLink.Code),
				OriginalURL: existingLink.URL,
				Title:       existingLink.Title,
				ExpiresAt:   existingLink.ExpiresAt,
			}, nil
		}
	}

	// 生成短码
	var code string
	if req.Code != "" {
		// 自定义短码
		code, err = s.generator.GenerateCustom(ctx, req.Code)
		if err != nil {
			return nil, err
		}
	} else {
		// 随机短码
		code, err = s.generator.Generate(ctx)
		if err != nil {
			return nil, err
		}
	}

	// 处理过期时间
	var expiresAt *time.Time
	if !req.ExpiresAt.IsZero() {
		if req.ExpiresAt.Before(time.Now()) {
			return nil, apperrors.ErrExpired
		}
		expiresAt = &req.ExpiresAt
	}

	// 创建短链接记录
	link := &models.ShortLink{
		Code:      code,
		URL:       normalizedURL,
		UserID:    req.UserID,
		Title:     req.Title,
		ExpiresAt: expiresAt,
		Status:    models.LinkStatusActive,
	}

	if err := s.linkRepo.Create(ctx, link); err != nil {
		return nil, apperrors.ErrInternalServer
	}

	// 增加用户已用配额（记录错误但不影响返回）
	if err := s.userRepo.IncrementQuotaUsed(ctx, req.UserID); err != nil {
		log.Printf("WARNING: Failed to increment quota for user %d: %v", req.UserID, err)
	}

	return &CreateLinkResponse{
		Code:        code,
		ShortURL:    s.buildShortURL(code),
		OriginalURL: normalizedURL,
		Title:       req.Title,
		ExpiresAt:   expiresAt,
	}, nil
}

// GetLink 获取短链接信息
func (s *LinkService) GetLink(ctx context.Context, code string) (*models.ShortLink, error) {
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

	return link, nil
}

// Resolve 解析短链接（用于跳转）并记录访问日志
type ResolveOptions struct {
	IP           string
	UserAgent    string
	Referer      string
	Country      string
	City         string
}

// Resolve 解析短链接（用于跳转）
func (s *LinkService) Resolve(ctx context.Context, code string, opts *ResolveOptions) (*models.ShortLink, error) {
	link, err := s.GetLink(ctx, code)
	if err != nil {
		return nil, err
	}

	// 异步更新点击计数和访问日志
	go s.recordAccess(context.Background(), link.ID, code, opts)

	return link, nil
}

// recordAccess 记录访问日志和点击计数
func (s *LinkService) recordAccess(ctx context.Context, linkID uint, code string, opts *ResolveOptions) {
	// 更新点击计数
	if err := s.linkRepo.IncrementClickCount(ctx, code); err != nil {
		log.Printf("WARNING: Failed to increment click count for link %s: %v", code, err)
	}

	// 记录访问日志
	if opts != nil && s.accessLogRepo != nil {
		accessLog := &models.AccessLog{
			LinkID:    linkID,
			IPAddress: opts.IP,
			UserAgent: opts.UserAgent,
			Referer:   opts.Referer,
		}
		if err := s.accessLogRepo.Create(ctx, accessLog); err != nil {
			log.Printf("WARNING: Failed to create access log for link %d: %v", linkID, err)
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
	Code      string             `json:"-" binding:"required"`
	URL       string             `json:"url"`
	Title     string             `json:"title"`
	ExpiresAt *time.Time         `json:"expires_at"`
	Status    models.LinkStatus  `json:"status"`
}

// Update 更新短链接
func (s *LinkService) Update(ctx context.Context, req *UpdateLinkRequest, userID uint) error {
	link, err := s.linkRepo.FindByCode(ctx, req.Code)
	if err != nil {
		return err
	}

	// 检查所有权
	if link.UserID != userID {
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

	return s.linkRepo.Update(ctx, link)
}

// Delete 删除短链接
func (s *LinkService) Delete(ctx context.Context, code string, userID uint) error {
	link, err := s.linkRepo.FindByCode(ctx, code)
	if err != nil {
		return err
	}

	// 检查所有权
	if link.UserID != userID {
		return apperrors.ErrForbidden
	}

	// 软删除
	if err := s.linkRepo.Delete(ctx, link.ID); err != nil {
		return err
	}

	// 减少用户已用配额（记录错误但不影响返回）
	if err := s.userRepo.DecrementQuotaUsed(ctx, userID); err != nil {
		log.Printf("WARNING: Failed to decrement quota for user %d: %v", userID, err)
	}

	return nil
}

// GetStats 获取链接统计
type LinkStats struct {
	ClickCount int64  `json:"click_count"`
	UniqueIPs  int64  `json:"unique_ips"`
	CreatedAt  string `json:"created_at"`
}

// GetStats 获取链接统计信息（使用访问日志）
func (s *LinkService) GetStats(ctx context.Context, code string, userID uint) (*LinkStats, error) {
	link, err := s.linkRepo.FindByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// 检查所有权（管理员可以查看所有）
	if link.UserID != userID {
		return nil, apperrors.ErrForbidden
	}

	// 尝试从访问日志获取统计信息
	if s.accessLogRepo != nil {
		stats, err := s.accessLogRepo.GetStatsByLinkID(ctx, link.ID)
		if err == nil {
			return &LinkStats{
				ClickCount: stats.ClickCount,
				UniqueIPs:  stats.UniqueIPs,
				CreatedAt:  link.CreatedAt.Format(time.RFC3339),
			}, nil
		}
	}

	// 降级到基本统计
	return &LinkStats{
		ClickCount: int64(link.ClickCount),
		UniqueIPs:  0, // 未启用访问日志时无法计算
		CreatedAt:  link.CreatedAt.Format(time.RFC3339),
	}, nil
}

// URLHash 计算 URL 哈希（用于去重）
func URLHash(url string) string {
	hash := sha256.Sum256([]byte(url))
	return hex.EncodeToString(hash[:])[:16]
}

// buildShortURL 构建短链接 URL
func (s *LinkService) buildShortURL(code string) string {
	if s.baseURL == "" {
		return fmt.Sprintf("/%s", code)
	}
	return fmt.Sprintf("%s/%s", s.baseURL, code)
}

func convertLinkPtrs(links []models.ShortLink) []*models.ShortLink {
	result := make([]*models.ShortLink, len(links))
	for i := range links {
		result[i] = &links[i]
	}
	return result
}
