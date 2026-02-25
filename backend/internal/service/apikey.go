package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// APIKeyService API密钥服务
type APIKeyService struct {
	apiKeyRepo *repository.APIKeyRepository
	userRepo   *repository.UserRepository
}

// NewAPIKeyService 创建API密钥服务
func NewAPIKeyService(
	apiKeyRepo *repository.APIKeyRepository,
	userRepo *repository.UserRepository,
) *APIKeyService {
	return &APIKeyService{
		apiKeyRepo: apiKeyRepo,
		userRepo:   userRepo,
	}
}

// CreateAPIKeyRequest 创建API密钥请求
type CreateAPIKeyRequest struct {
	Name      string        `json:"name" binding:"required"`
	UserID    uint          `json:"-"`
	ExpiresIn time.Duration `json:"expires_in"` // 过期时长，0表示永久
}

// CreateAPIKeyResponse 创建API密钥响应
type CreateAPIKeyResponse struct {
	Key       string    `json:"key"`
	Name      string    `json:"name"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// Create 创建API密钥
func (s *APIKeyService) Create(ctx context.Context, req *CreateAPIKeyRequest) (*CreateAPIKeyResponse, error) {
	// 检查用户是否存在
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return nil, apperrors.ErrUserNotFound
	}

	if user.Status != models.UserStatusActive {
		return nil, apperrors.ErrUserDisabled
	}

	// 生成API密钥
	key, err := generateAPIKey()
	if err != nil {
		return nil, apperrors.ErrInternalServer
	}

	// 计算过期时间
	var expiresAt *time.Time
	if req.ExpiresIn > 0 {
		expires := time.Now().Add(req.ExpiresIn)
		expiresAt = &expires
	}

	apiKey := &models.APIKey{
		Key:      key,
		Name:     req.Name,
		UserID:   req.UserID,
		ExpiresAt: expiresAt,
		Status:   models.APIKeyStatusActive,
	}

	if err := s.apiKeyRepo.Create(ctx, apiKey); err != nil {
		return nil, apperrors.ErrInternalServer
	}

	// 创建时返回完整密钥，之后只会返回 mask 后的
	return &CreateAPIKeyResponse{
		Key:       key, // 返回完整密钥
		Name:      apiKey.Name,
		ExpiresAt: expiresAt,
		CreatedAt: apiKey.CreatedAt,
	}, nil
}

// List 获取用户的API密钥列表
func (s *APIKeyService) List(ctx context.Context, userID uint) ([]models.APIKey, error) {
	keys, err := s.apiKeyRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 隐藏完整密钥
	for i := range keys {
		keys[i].Key = maskAPIKey(keys[i].Key)
	}

	return keys, nil
}

// Delete 删除API密钥
func (s *APIKeyService) Delete(ctx context.Context, keyID, userID uint) error {
	apiKey, err := s.apiKeyRepo.FindByID(ctx, keyID)
	if err != nil {
		return err
	}

	// 检查所有权
	if apiKey.UserID != userID {
		return apperrors.ErrForbidden
	}

	return s.apiKeyRepo.Delete(ctx, keyID)
}

// Validate 验证API密钥（供中间件使用）
func (s *APIKeyService) Validate(ctx context.Context, key string) (*models.APIKey, error) {
	apiKey, err := s.apiKeyRepo.FindByKey(ctx, key)
	if err != nil {
		return nil, err
	}

	// 检查用户状态
	if apiKey.User.Status != models.UserStatusActive {
		return nil, apperrors.ErrUserDisabled
	}

	return apiKey, nil
}

// UpdateLastUsed 更新最后使用时间
func (s *APIKeyService) UpdateLastUsed(ctx context.Context, key string) error {
	return s.apiKeyRepo.UpdateLastUsed(ctx, key)
}

// generateAPIKey 生成API密钥
func generateAPIKey() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "sk_" + hex.EncodeToString(bytes), nil
}

// maskAPIKey 遮罩API密钥（只显示前缀和后缀）
func maskAPIKey(key string) string {
	if len(key) <= 10 {
		return key
	}
	return key[:7] + "..." + key[len(key)-4:]
}
