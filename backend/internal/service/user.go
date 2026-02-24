package service

import (
	"context"
	"time"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// UserService 用户服务
type UserService struct {
	userRepo   *repository.UserRepository
	groupRepo  *repository.UserGroupRepository
}

// NewUserService 创建用户服务
func NewUserService(
	userRepo *repository.UserRepository,
	groupRepo *repository.UserGroupRepository,
) *UserService {
	return &UserService{
		userRepo:  userRepo,
		groupRepo: groupRepo,
	}
}

// GetOrCreateUser 根据Keycloak ID获取或创建用户
func (s *UserService) GetOrCreateUser(ctx context.Context, keycloakID, username, email string) (*models.User, error) {
	// 尝试查找现有用户
	user, err := s.userRepo.FindByKeycloakID(ctx, keycloakID)
	if err == nil {
		return user, nil
	}

	// 创建新用户
	now := time.Now()
	user = &models.User{
		KeycloakID: keycloakID,
		Username:   username,
		Email:      email,
		Role:       models.RoleUser,
		Quota:      -1, // 默认无限配额
		QuotaUsed:  0,
		Status:     models.UserStatusActive,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, apperrors.ErrInternalServer
	}

	return user, nil
}

// GetByID 根据ID获取用户
func (s *UserService) GetByID(ctx context.Context, id uint) (*models.User, error) {
	return s.userRepo.FindByID(ctx, id)
}

// GetByKeycloakID 根据Keycloak ID获取用户
func (s *UserService) GetByKeycloakID(ctx context.Context, keycloakID string) (*models.User, error) {
	return s.userRepo.FindByKeycloakID(ctx, keycloakID)
}

// List 获取用户列表（管理员）
type ListUsersRequest struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

type ListUsersResponse struct {
	Users     []*models.User `json:"users"`
	Total     int64          `json:"total"`
	Page      int            `json:"page"`
	PageSize  int            `json:"page_size"`
	TotalPage int            `json:"total_page"`
}

// List 获取用户列表
func (s *UserService) List(ctx context.Context, req *ListUsersRequest) (*ListUsersResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	users, total, err := s.userRepo.List(ctx, req.Page, req.PageSize)
	if err != nil {
		return nil, err
	}

	totalPage := int(total) / req.PageSize
	if int(total)%req.PageSize > 0 {
		totalPage++
	}

	// 转换为指针数组
	userPtrs := make([]*models.User, len(users))
	for i := range users {
		userPtrs[i] = &users[i]
	}

	return &ListUsersResponse{
		Users:     userPtrs,
		Total:     total,
		Page:      req.Page,
		PageSize:  req.PageSize,
		TotalPage: totalPage,
	}, nil
}

// UpdateQuota 更新用户配额
type UpdateQuotaRequest struct {
	UserID uint `json:"user_id" binding:"required"`
	Quota  int  `json:"quota" binding:"required"`
}

// UpdateQuota 更新用户配额
func (s *UserService) UpdateQuota(ctx context.Context, req *UpdateQuotaRequest) error {
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return err
	}

	return s.userRepo.UpdateQuota(ctx, req.UserID, req.Quota, user.QuotaUsed)
}

// SetGroup 设置用户组
type SetGroupRequest struct {
	UserID  uint  `json:"user_id" binding:"required"`
	GroupID *uint `json:"group_id"`
}

// SetGroup 设置用户组
func (s *UserService) SetGroup(ctx context.Context, req *SetGroupRequest) error {
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return err
	}

	// 如果指定了用户组，获取默认配额
	var quota int
	if req.GroupID != nil {
		group, err := s.groupRepo.FindByID(ctx, *req.GroupID)
		if err != nil {
			return err
		}
		quota = group.DefaultQuota
		user.GroupID = req.GroupID
		user.Quota = quota
	} else {
		user.GroupID = nil
		user.Quota = -1
	}

	return s.userRepo.Update(ctx, user)
}

// Disable 禁用用户
func (s *UserService) Disable(ctx context.Context, userID uint) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	user.Status = models.UserStatusDisabled
	return s.userRepo.Update(ctx, user)
}

// Enable 启用用户
func (s *UserService) Enable(ctx context.Context, userID uint) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	user.Status = models.UserStatusActive
	return s.userRepo.Update(ctx, user)
}

// GetQuotaStatus 获取用户配额状态
type QuotaStatus struct {
	Quota      int `json:"quota"`
	QuotaUsed  int `json:"quota_used"`
	QuotaLeft  int `json:"quota_left"`
	Percentage int `json:"percentage"` // 使用百分比
}

// GetQuotaStatus 获取配额状态
func (s *UserService) GetQuotaStatus(ctx context.Context, userID uint) (*QuotaStatus, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	status := &QuotaStatus{
		Quota:     user.Quota,
		QuotaUsed: user.QuotaUsed,
	}

	if user.Quota < 0 {
		// 无限配额
		status.QuotaLeft = -1
		status.Percentage = 0
	} else {
		status.QuotaLeft = user.Quota - user.QuotaUsed
		if user.Quota > 0 {
			status.Percentage = int((float64(user.QuotaUsed) / float64(user.Quota)) * 100)
		}
	}

	return status, nil
}
