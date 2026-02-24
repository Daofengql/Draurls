package service

import (
	"context"
	"errors"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// TemplateService 跳转模板服务
type TemplateService struct {
	repo *repository.RedirectTemplateRepository
}

// NewTemplateService 创建模板服务
func NewTemplateService(repo *repository.RedirectTemplateRepository) *TemplateService {
	return &TemplateService{
		repo: repo,
	}
}

// CreateTemplateRequest 创建模板请求
type CreateTemplateRequest struct {
	Name    string `json:"name" binding:"required"`
	Content string `json:"content" binding:"required"`
	IsDefault bool  `json:"is_default"`
}

// UpdateTemplateRequest 更新模板请求
type UpdateTemplateRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	IsDefault *bool `json:"is_default"`
	Enabled *bool  `json:"enabled"`
}

// Create 创建跳转模板
func (s *TemplateService) Create(ctx context.Context, req *CreateTemplateRequest) (*models.RedirectTemplate, error) {
	// 检查名称是否已存在
	existing, _ := s.repo.FindByName(ctx, req.Name)
	if existing != nil {
		return nil, apperrors.ErrDuplicateName
	}

	template := &models.RedirectTemplate{
		Name:     req.Name,
		Content:  req.Content,
		IsDefault: req.IsDefault,
		Enabled:  true,
	}

	// 如果设为默认，需要取消其他默认模板
	if req.IsDefault {
		if err := s.repo.ClearDefault(ctx); err != nil {
			return nil, err
		}
	}

	if err := s.repo.Create(ctx, template); err != nil {
		return nil, apperrors.ErrInternalServer
	}

	return template, nil
}

// Update 更新跳转模板
func (s *TemplateService) Update(ctx context.Context, id uint, req *UpdateTemplateRequest) (*models.RedirectTemplate, error) {
	template, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// 更新字段
	if req.Name != "" {
		// 检查名称是否已被其他模板使用
		existing, _ := s.repo.FindByName(ctx, req.Name)
		if existing != nil && existing.ID != id {
			return nil, apperrors.ErrDuplicateName
		}
		template.Name = req.Name
	}

	if req.Content != "" {
		template.Content = req.Content
	}

	if req.IsDefault != nil {
		if *req.IsDefault {
			// 取消其他默认模板
			if err := s.repo.ClearDefault(ctx); err != nil {
				return nil, err
			}
		}
		template.IsDefault = *req.IsDefault
	}

	if req.Enabled != nil {
		template.Enabled = *req.Enabled
	}

	if err := s.repo.Update(ctx, template); err != nil {
		return nil, apperrors.ErrInternalServer
	}

	return template, nil
}

// Delete 删除模板（默认模板不能删除）
func (s *TemplateService) Delete(ctx context.Context, id uint) error {
	template, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}

	// 默认模板不能删除
	if template.IsDefault {
		return errors.New("cannot delete default template")
	}

	return s.repo.Delete(ctx, id)
}

// GetByID 获取模板详情
func (s *TemplateService) GetByID(ctx context.Context, id uint) (*models.RedirectTemplate, error) {
	return s.repo.FindByID(ctx, id)
}

// List 列出所有模板
func (s *TemplateService) List(ctx context.Context) ([]models.RedirectTemplate, error) {
	return s.repo.List(ctx)
}

// GetDefault 获取默认启用的模板
func (s *TemplateService) GetDefault(ctx context.Context) (*models.RedirectTemplate, error) {
	// 优先获取标记为默认的模板
	template, err := s.repo.FindDefault(ctx)
	if err == nil && template != nil && template.Enabled {
		return template, nil
	}

	// 如果没有默认模板，返回第一个启用的模板
	templates, err := s.repo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}

	if len(templates) == 0 {
		// 返回硬编码的默认模板
		return &models.RedirectTemplate{
			Name:     "default",
			Content:  getDefaultTemplateContent(),
			IsDefault: true,
			Enabled:  true,
		}, nil
	}

	return &templates[0], nil
}

// SetDefault 设置默认模板
func (s *TemplateService) SetDefault(ctx context.Context, id uint) error {
	// 先取消所有默认标记
	if err := s.repo.ClearDefault(ctx); err != nil {
		return err
	}

	return s.repo.SetDefault(ctx, id)
}

// getDefaultTemplateContent 获取硬编码的默认模板内容
func getDefaultTemplateContent() string {
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>正在跳转...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
        }
        h1 { color: #333; margin-bottom: 20px; font-size: 24px; }
        p { color: #666; margin-bottom: 30px; }
        .url {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 6px;
            word-break: break-all;
            color: #667eea;
            margin-bottom: 20px;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>正在跳转</h1>
        <p>即将访问目标页面，请稍候...</p>
        <div class="url">{{.URL}}</div>
        <div class="spinner"></div>
    </div>
    <script>
        setTimeout(function() {
            window.location.href = {{.URL}};
        }, 1000);
    </script>
</body>
</html>`
}
