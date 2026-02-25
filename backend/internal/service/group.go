package service

import (
	"context"
	"errors"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// GroupService 用户组服务
type GroupService struct {
	groupRepo *repository.UserGroupRepository
	userRepo  *repository.UserRepository
}

// NewGroupService 创建用户组服务
func NewGroupService(
	groupRepo *repository.UserGroupRepository,
	userRepo *repository.UserRepository,
) *GroupService {
	return &GroupService{
		groupRepo: groupRepo,
		userRepo:  userRepo,
	}
}

// CreateGroupRequest 创建用户组请求
type CreateGroupRequest struct {
	Name        string `json:"name" binding:"required,min=2,max=50"`
	Description string `json:"description" binding:"max=200"`
	DefaultQuota int    `json:"default_quota" binding:"required"`
	IsDefault   bool   `json:"is_default"` // 是否为默认组
}

// UpdateGroupRequest 更新用户组请求
type UpdateGroupRequest struct {
	ID          uint   `json:"-"`
	Name        string `json:"name" binding:"omitempty,min=2,max=50"`
	Description string `json:"description" binding:"omitempty,max=200"`
	DefaultQuota *int   `json:"default_quota"`
	IsDefault   *bool  `json:"is_default"` // 是否为默认组
}

// GroupDetail 用户组详情（包含用户列表）
type GroupDetail struct {
	*models.UserGroup
	UserCount int              `json:"user_count"`
	Users     []*models.User   `json:"users,omitempty"`
	Domains   []models.Domain  `json:"domains,omitempty"` // 可用域名列表
}

// Create 创建用户组
func (s *GroupService) Create(ctx context.Context, req *CreateGroupRequest) (*models.UserGroup, error) {
	// 检查名称是否已存在
	_, err := s.groupRepo.FindByName(ctx, req.Name)
	if err == nil {
		return nil, apperrors.ErrDuplicateResource
	}

	group := &models.UserGroup{
		Name:        req.Name,
		Description: req.Description,
		DefaultQuota: req.DefaultQuota,
		IsDefault:   req.IsDefault,
	}

	if err := s.groupRepo.Create(ctx, group); err != nil {
		return nil, err
	}

	return group, nil
}

// List 获取所有用户组
func (s *GroupService) List(ctx context.Context) ([]models.UserGroup, error) {
	return s.groupRepo.List(ctx)
}

// GetDefault 获取默认用户组
func (s *GroupService) GetDefault(ctx context.Context) (*models.UserGroup, error) {
	return s.groupRepo.FindDefault(ctx)
}

// SetDefault 设置默认用户组
func (s *GroupService) SetDefault(ctx context.Context, groupID uint) error {
	return s.groupRepo.SetDefault(ctx, groupID)
}

// GetDetail 获取用户组详情
func (s *GroupService) GetDetail(ctx context.Context, groupID uint) (*GroupDetail, error) {
	group, err := s.groupRepo.FindByID(ctx, groupID)
	if err != nil {
		return nil, apperrors.ErrGroupNotFound
	}

	// 获取该组下的用户列表
	users, err := s.groupRepo.GetUsers(ctx, groupID)
	if err != nil {
		return nil, err
	}

	// 获取该组可用的域名列表
	domains, err := s.groupRepo.GetAllowedDomains(ctx, groupID)
	if err != nil {
		return nil, err
	}

	return &GroupDetail{
		UserGroup:  group,
		UserCount:  len(users),
		Users:      users,
		Domains:    domains,
	}, nil
}

// Update 更新用户组
func (s *GroupService) Update(ctx context.Context, req *UpdateGroupRequest) error {
	group, err := s.groupRepo.FindByID(ctx, req.ID)
	if err != nil {
		return apperrors.ErrGroupNotFound
	}

	if req.Name != "" {
		// 检查新名称是否与其他组冲突
		existing, err := s.groupRepo.FindByName(ctx, req.Name)
		if err == nil && existing.ID != req.ID {
			return apperrors.ErrDuplicateResource
		}
		group.Name = req.Name
	}

	if req.Description != "" {
		group.Description = req.Description
	}

	if req.DefaultQuota != nil {
		group.DefaultQuota = *req.DefaultQuota
	}

	if req.IsDefault != nil {
		if *req.IsDefault {
			// 设置为默认组，需要先清除其他默认组
			if err := s.groupRepo.SetDefault(ctx, req.ID); err != nil {
				return err
			}
		} else {
			group.IsDefault = false
		}
	}

	return s.groupRepo.Update(ctx, group)
}

// Delete 删除用户组
func (s *GroupService) Delete(ctx context.Context, groupID uint) error {
	group, err := s.groupRepo.FindByID(ctx, groupID)
	if err != nil {
		return apperrors.ErrGroupNotFound
	}

	// 不允许删除默认组
	if group.IsDefault {
		return errors.New("cannot delete default group")
	}

	// 检查是否有用户属于该组
	userCount, err := s.groupRepo.CountUsers(ctx, groupID)
	if err != nil {
		return err
	}

	if userCount > 0 {
		return errors.New("cannot delete group with users. Please move users to another group first")
	}

	return s.groupRepo.Delete(ctx, group.ID)
}

// AddDomain 添加域名到用户组
func (s *GroupService) AddDomain(ctx context.Context, groupID, domainID uint) error {
	// 检查用户组是否存在
	_, err := s.groupRepo.FindByID(ctx, groupID)
	if err != nil {
		return apperrors.ErrGroupNotFound
	}

	return s.groupRepo.AddDomainToGroup(ctx, domainID, groupID)
}

// RemoveDomain 从用户组移除域名
func (s *GroupService) RemoveDomain(ctx context.Context, groupID, domainID uint) error {
	return s.groupRepo.RemoveDomainFromGroup(ctx, domainID, groupID)
}
