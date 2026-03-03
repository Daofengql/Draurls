package service

import (
	"context"
	"fmt"
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
// 如果用户已存在，会更新其 Nickname、Picture 等可能变化的信息，以及更新最后登录时间和IP
// 第一个用户自动成为管理员
func (s *UserService) GetOrCreateUser(ctx context.Context, keycloakID, username, email, nickname, picture, clientIP string) (*models.User, error) {
	// 尝试查找现有用户
	user, err := s.userRepo.FindByKeycloakID(ctx, keycloakID)
	if err == nil {
		// 用户已存在，检查是否需要更新信息
		updated := false
		if user.Nickname != nickname && nickname != "" {
			user.Nickname = nickname
			updated = true
		}
		if user.Picture != picture && picture != "" {
			user.Picture = picture
			updated = true
		}
		if user.Username != username && username != "" {
			user.Username = username
			updated = true
		}
		if user.Email != email && email != "" {
			user.Email = email
			updated = true
		}

		// 更新最后登录时间和IP
		now := time.Now()
		user.LastLoginAt = &now
		if clientIP != "" {
			user.LastLoginIP = clientIP
		}
		updated = true

		// 如果有更新，保存到数据库
		if updated {
			user.UpdatedAt = now
			if err := s.userRepo.Update(ctx, user); err != nil {
				// 更新失败不影响返回用户，只是记录日志
				// 生产环境应该记录日志
			}
		}
		return user, nil
	}

	// 检查是否为系统第一个用户（第一个用户自动成为管理员）
	count, err := s.userRepo.Count(ctx)
	if err != nil {
		return nil, apperrors.ErrInternalServer
	}

	// 确定角色：第一个用户为 admin，后续用户为 user
	role := models.RoleUser
	if count == 0 {
		role = models.RoleAdmin
	}

	// 查找默认用户组（非管理员用户自动加入）
	// 管理员是特殊的"虚拟组"，不加入任何用户组
	var groupID *uint
	if role == models.RoleUser {
		defaultGroup, err := s.groupRepo.FindDefault(ctx)
		if err == nil {
			groupID = &defaultGroup.ID
		}
		// 如果没有默认组，groupID 保持为 nil
	}

	// 创建新用户
	now := time.Now()
	user = &models.User{
		KeycloakID:  keycloakID,
		Username:    username,
		Email:       email,
		Nickname:    nickname,
		Picture:     picture,
		Role:        role,
		GroupID:     groupID,
		Quota:       -2, // 默认继承用户组配额
		QuotaUsed:   0,
		Status:      models.UserStatusActive,
		LastLoginAt: &now,
		LastLoginIP: clientIP,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// 如果没有用户组，设置无限配额
	if groupID == nil {
		user.Quota = -1
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		// 如果是重复键错误，可能是因为之前的查询失败导致的，重试一次查找
		// MySQL 重复键错误码是 1062
		if user, retryErr := s.userRepo.FindByKeycloakID(ctx, keycloakID); retryErr == nil {
			return user, nil
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
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
	InheritQuota bool `json:"inherit_quota"` // 是否继承用户组配额
}

// SetGroup 设置用户组
func (s *UserService) SetGroup(ctx context.Context, req *SetGroupRequest) error {
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return err
	}

	// 管理员不能设置用户组（管理员是特殊的"虚拟组"）
	if user.Role == models.RoleAdmin {
		return fmt.Errorf("admin users cannot be assigned to a group")
	}

	user.GroupID = req.GroupID

	// 设置配额模式
	if req.InheritQuota {
		// 继承用户组配额模式
		user.Quota = QuotaInherit
	} else if req.GroupID != nil {
		// 使用用户组���额作为个人配额（硬拷贝，原有行为）
		group, err := s.groupRepo.FindByID(ctx, *req.GroupID)
		if err != nil {
			return err
		}
		user.Quota = group.DefaultQuota
	} else {
		// 没有用户组，使用无限配额
		user.Quota = QuotaUnlimited
	}

	return s.userRepo.Update(ctx, user)
}

// Disable 禁用用户
func (s *UserService) Disable(ctx context.Context, userID uint, actorID uint) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 管理员不能禁用自己
	if user.ID == actorID && user.Role == models.RoleAdmin {
		return fmt.Errorf("cannot disable yourself")
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

// GetQuotaStatus 获取用户配额状态（支持用户组继承）
type QuotaStatus struct {
	Quota       int    `json:"quota"`        // 实际生效的配额（如果继承则显示组配额）
	QuotaUsed   int    `json:"quota_used"`
	QuotaLeft   int    `json:"quota_left"`
	Percentage  int    `json:"percentage"` // 使用百分比
	QuotaSource string `json:"quota_source"` // 配额来源: "user"=个人配额, "group"=继承用户组, "unlimited"=无限
	GroupName   string `json:"group_name,omitempty"` // 所属用户组名称
}

// 配额常量
const (
	QuotaUnlimited  = -1 // 无限配额
	QuotaInherit    = -2 // 继承用户组配额
)

// GetQuotaStatus 获取配额状态（支持继承逻辑）
func (s *UserService) GetQuotaStatus(ctx context.Context, userID uint) (*QuotaStatus, error) {
	// 使用 FindByIDWithGroup 预加载用户组信息
	user, err := s.userRepo.FindByIDWithGroup(ctx, userID)
	if err != nil {
		return nil, err
	}

	status := &QuotaStatus{
		QuotaUsed:  user.QuotaUsed,
	}

	// 获取用户组名称
	if user.Group != nil {
		status.GroupName = user.Group.Name
	}

	// 根据配额值判断来源和实际配额
	switch {
	case user.Quota == QuotaInherit:
		// 继承模式 (-2)
		status.QuotaSource = "group"
		if user.Group != nil {
			status.Quota = user.Group.DefaultQuota
		} else {
			// 如果设置为继承但没有用户组，使用默认值
			status.Quota = QuotaUnlimited
		}

	case user.Quota == QuotaUnlimited:
		// 无限配额 (-1)
		status.QuotaSource = "unlimited"
		status.Quota = QuotaUnlimited

	default:
		// 个人配额（>= 0）
		status.QuotaSource = "user"
		status.Quota = user.Quota
	}

	// 计算剩余和百分比
	if status.Quota == QuotaUnlimited {
		status.QuotaLeft = -1
		status.Percentage = 0
	} else if status.Quota == 0 {
		status.QuotaLeft = 0
		status.Percentage = 100
	} else {
		status.QuotaLeft = status.Quota - user.QuotaUsed
		// 确保百分比不超过100
		percentage := int((float64(user.QuotaUsed) / float64(status.Quota)) * 100)
		if percentage > 100 {
			percentage = 100
		}
		status.Percentage = percentage
	}

	return status, nil
}
