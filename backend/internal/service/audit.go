package service

import (
	"context"
	"fmt"
	"time"

	"github.com/surls/backend/internal/models"
	"github.com/surls/backend/internal/repository"
)

// AuditService 审计日志服务
type AuditService struct {
	auditRepo *repository.AuditLogRepository
}

// NewAuditService 创建审计日���服务
func NewAuditService(auditRepo *repository.AuditLogRepository) *AuditService {
	return &AuditService{
		auditRepo: auditRepo,
	}
}

// LogRequest 审计日志请求
type LogRequest struct {
	Action     models.AuditAction
	Resource   string
	ResourceID *uint
	Details    string
	IPAddress  string
	UserAgent  string
}

// LogRecord 审计日志记录（包含 ActorID）
type LogRecord struct {
	ActorID    uint
	Action     models.AuditAction
	Resource   string
	ResourceID *uint
	Details    string
	IPAddress  string
	UserAgent  string
}

// Record 记录审计日志
func (s *AuditService) Record(ctx context.Context, record *LogRecord) error {
	if record.ActorID == 0 {
		return nil // 忽略无操作者的日志
	}

	log := &models.AuditLog{
		ActorID:    record.ActorID,
		Action:     string(record.Action),
		Resource:   record.Resource,
		ResourceID: record.ResourceID,
		Details:    record.Details,
		IPAddress:  record.IPAddress,
		UserAgent:  record.UserAgent,
		CreatedAt:  time.Now(),
	}

	return s.auditRepo.Create(ctx, log)
}

// RecordFromGin 从 Gin Context 记录审计日志
func (s *AuditService) RecordFromGin(ctx context.Context, actorID uint, action models.AuditAction, resource string, resourceID *uint, details string, getIPAndUA func() (ip, ua string)) error {
	ipAddr, userAgent := "", ""
	if getIPAndUA != nil {
		ipAddr, userAgent = getIPAndUA()
	}

	return s.Record(ctx, &LogRecord{
		ActorID:    actorID,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Details:    details,
		IPAddress:  ipAddr,
		UserAgent:  userAgent,
	})
}

// ListAuditLogsRequest 查��审计日志请求
type ListAuditLogsRequest struct {
	Page     int
	PageSize int
	ActorID  *uint
	Action   string
}

// ListAuditLogsResponse 查询审计日志响应
type ListAuditLogsResponse struct {
	Logs      []models.AuditLog `json:"logs"`
	Total     int64             `json:"total"`
	Page      int               `json:"page"`
	PageSize  int               `json:"page_size"`
	TotalPage int               `json:"total_page"`
}

// List 查询审计日志
func (s *AuditService) List(ctx context.Context, req *ListAuditLogsRequest) (*ListAuditLogsResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	logs, total, err := s.auditRepo.List(ctx, req.Page, req.PageSize, req.ActorID, req.Action)
	if err != nil {
		return nil, err
	}

	totalPage := int(total) / req.PageSize
	if int(total)%req.PageSize > 0 {
		totalPage++
	}

	return &ListAuditLogsResponse{
		Logs:      logs,
		Total:     total,
		Page:      req.Page,
		PageSize:  req.PageSize,
		TotalPage: totalPage,
	}, nil
}

// ========== 辅助函数：构建审计日志详情 ==========

// DetailUserQuota 用户配额变更详情
func DetailUserQuota(oldQuota, newQuota int) string {
	return fmt.Sprintf("%d->%d", oldQuota, newQuota)
}

// DetailUserGroup 用户组变更详情
func DetailUserGroup(oldGroupID, newGroupID *uint) string {
	oldStr := "none"
	newStr := "none"
	if oldGroupID != nil {
		oldStr = fmt.Sprintf("%d", *oldGroupID)
	}
	if newGroupID != nil {
		newStr = fmt.Sprintf("%d", *newGroupID)
	}
	return oldStr + "->" + newStr
}

// DetailLinkCreate 创建链接详情
func DetailLinkCreate(code, url string) string {
	return "code:" + code + ",url:" + url
}

// DetailConfigUpdate 配置更新详情
func DetailConfigUpdate(key, oldValue, newValue string) string {
	return key + ":" + oldValue + "->" + newValue
}
