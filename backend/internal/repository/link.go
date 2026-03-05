package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/surls/backend/internal/models"
)

// ShortLinkRepository 短链接数据访问层
type ShortLinkRepository struct {
	db *gorm.DB
}

// NewShortLinkRepository 创建短链接仓库
func NewShortLinkRepository(db *gorm.DB) *ShortLinkRepository {
	return &ShortLinkRepository{db: db}
}

// Create 创建短链接
func (r *ShortLinkRepository) Create(ctx context.Context, link *models.ShortLink) error {
	return r.db.WithContext(ctx).Create(link).Error
}

// FindByCode 根据短码查找链接
func (r *ShortLinkRepository) FindByCode(ctx context.Context, code string) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&link).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// FindByCodeAndDomain 根据短码和域名ID查找链接（用于域名隔离）
func (r *ShortLinkRepository) FindByCodeAndDomain(ctx context.Context, code string, domainID uint) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).Where("code = ? AND domain_id = ?", code, domainID).First(&link).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// FindByID 根据 ID 查找链接
func (r *ShortLinkRepository) FindByID(ctx context.Context, id uint) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).First(&link, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// FindByURL 根据 URL 查找链接（用于去重）
func (r *ShortLinkRepository) FindByURL(ctx context.Context, userID uint, url string) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND url = ? AND status != ?", userID, url, models.LinkStatusExpired).
		First(&link).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// FindByURLAndDomain 根据 URL 和域名ID查找链接（用于域名隔离去重）
func (r *ShortLinkRepository) FindByURLAndDomain(ctx context.Context, userID uint, url string, domainID uint) (*models.ShortLink, error) {
	var link models.ShortLink
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND url = ? AND domain_id = ? AND status != ?", userID, url, domainID, models.LinkStatusExpired).
		First(&link).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// Update 更新短链接
func (r *ShortLinkRepository) Update(ctx context.Context, link *models.ShortLink) error {
	return r.db.WithContext(ctx).Save(link).Error
}

// Delete 删除短链接（软删除）
func (r *ShortLinkRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.ShortLink{}, id).Error
}

// DeleteByCode 根据短码删除链接
func (r *ShortLinkRepository) DeleteByCode(ctx context.Context, code string) error {
	return r.db.WithContext(ctx).Where("code = ?", code).Delete(&models.ShortLink{}).Error
}

// ListByUser 获取用户的短链接列表
func (r *ShortLinkRepository) ListByUser(ctx context.Context, userID uint, page, pageSize int) ([]models.ShortLink, int64, error) {
	var links []models.ShortLink
	var total int64

	query := r.db.WithContext(ctx).Where("user_id = ?", userID)

	err := query.Model(&models.ShortLink{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&links).Error
	if err != nil {
		return nil, 0, err
	}

	return links, total, nil
}

// List 列出所有短链接（管理员）
func (r *ShortLinkRepository) List(ctx context.Context, page, pageSize int) ([]models.ShortLink, int64, error) {
	var links []models.ShortLink
	var total int64

	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&links).Error
	if err != nil {
		return nil, 0, err
	}

	return links, total, nil
}

// IncrementClickCount 增加点击次数
func (r *ShortLinkRepository) IncrementClickCount(ctx context.Context, code string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("code = ?", code).
		Updates(map[string]interface{}{
			"click_count":   gorm.Expr("click_count + 1"),
			"last_click_at": &now,
		}).Error
}

// BatchUpdateClickCounts 批量更新点击次数（用于定时刷新缓冲区）
func (r *ShortLinkRepository) BatchUpdateClickCounts(ctx context.Context, counts map[uint]int64) error {
	if len(counts) == 0 {
		return nil
	}

	now := time.Now()
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for linkID, count := range counts {
			if err := tx.Model(&models.ShortLink{}).
				Where("id = ?", linkID).
				Updates(map[string]interface{}{
					"click_count":   gorm.Expr("click_count + ?", count),
					"last_click_at": &now,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// CountByUserID 统计用户的链接数量
func (r *ShortLinkRepository) CountByUserID(ctx context.Context, userID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("user_id = ?", userID).
		Count(&count).Error
	return count, err
}

// ExistsByCode 检查短码是否存在
func (r *ShortLinkRepository) ExistsByCode(ctx context.Context, code string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("code = ?", code).
		Count(&count).Error
	return count > 0, err
}

// FindExpiredLinks 查找过期的链接
func (r *ShortLinkRepository) FindExpiredLinks(ctx context.Context) ([]models.ShortLink, error) {
	var links []models.ShortLink
	now := time.Now()
	err := r.db.WithContext(ctx).
		Where("expires_at <= ? AND status = ?", now, models.LinkStatusActive).
		Find(&links).Error
	return links, err
}

// UpdateStatus 批量更新链接状态
func (r *ShortLinkRepository) UpdateStatus(ctx context.Context, ids []uint, status models.LinkStatus) error {
	return r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("id IN ?", ids).
		Update("status", status).Error
}

// CreateWithQuotaCheck 创建短链接并扣减配额（使用乐观更新）
// 使用乐观锁代替悲观锁，避免高并发下的行锁竞争
// 支持：
// - quota = -1: 无限配额
// - quota = -2: 继承用户组配额（需要检查用户组配额）
// - quota >= 0: 固定配额
func (r *ShortLinkRepository) CreateWithQuotaCheck(ctx context.Context, link *models.ShortLink, user *models.User) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 先创建短链接
		if err := tx.Create(link).Error; err != nil {
			return err
		}

		// 2. 根据配额类型使用不同的更新策略
		var result *gorm.DB
		if user.Quota == -1 {
			// 无限配额，直接更新
			result = tx.Model(&models.User{}).
				Where("id = ?", user.ID).
				UpdateColumn("quota_used", gorm.Expr("quota_used + 1"))
		} else if user.Quota == -2 && user.GroupID != nil {
			// 继承用户组配额，需要检查用户组配额
			// 获取用户组信息
			var group models.UserGroup
			if err := tx.First(&group, *user.GroupID).Error; err != nil {
				return err
			}

			// 检查用户组配额
			if group.DefaultQuota == -1 {
				// 用户组无限配额
				result = tx.Model(&models.User{}).
					Where("id = ?", user.ID).
					UpdateColumn("quota_used", gorm.Expr("quota_used + 1"))
			} else {
				// 用户组有限配额，检查用户在用户组内的配额使用情况
				// 注意：用户表中的 quota_used 是用户个人使用的配额，不是用户组内的
				// 所以需要检查 group.DefaultQuota > user.quota_used
				result = tx.Model(&models.User{}).
					Where("id = ? AND ? < ?", user.ID, gorm.Expr("quota_used"), group.DefaultQuota).
					UpdateColumn("quota_used", gorm.Expr("quota_used + 1"))
			}
		} else if user.Quota >= 0 {
			// 固定配额
			result = tx.Model(&models.User{}).
				Where("id = ? AND (quota = -1 OR quota_used < quota)", user.ID).
				UpdateColumn("quota_used", gorm.Expr("quota_used + 1"))
		} else {
			// quota = -2 但没有用户组，视为无配额
			result = &gorm.DB{RowsAffected: 0}
		}

		if result.Error != nil {
			return result.Error
		}

		// 如果没有行被更新，说明配额不足
		if result.RowsAffected == 0 {
			// 回滚：删除已创建的短链接
			tx.Delete(link)
			return apperrors.ErrQuotaExceeded
		}

		return nil
	})
}

// DeleteWithQuotaRefund 删除短链接并返还配额（事务操作）
func (r *ShortLinkRepository) DeleteWithQuotaRefund(ctx context.Context, linkID uint, userID uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 检查链接是否存在且属于该用户
		var link models.ShortLink
		if err := tx.Where("id = ? AND user_id = ?", linkID, userID).
			First(&link).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return apperrors.ErrLinkNotFound
			}
			return err
		}

		// 2. 软删除链接
		if err := tx.Delete(&link).Error; err != nil {
			return err
		}

		// 3. 返还配额
		if err := tx.Model(&models.User{}).
			Where("id = ? AND quota_used > 0", userID).
			UpdateColumn("quota_used", gorm.Expr("quota_used - 1")).Error; err != nil {
			return err
		}

		return nil
	})
}

// CountActiveByUserID 统计用户的活跃短链数量
func (r *ShortLinkRepository) CountActiveByUserID(ctx context.Context, userID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("user_id = ? AND status = ?", userID, models.LinkStatusActive).
		Count(&count).Error
	return count, err
}

// CountByUserIDAndDate 统计用户在指定日期创建的短链数量
func (r *ShortLinkRepository) CountByUserIDAndDate(ctx context.Context, userID uint, date string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("user_id = ? AND DATE(created_at) = ?", userID, date).
		Count(&count).Error
	return count, err
}

// CountByDate 统计指定日期创建的短链数量
func (r *ShortLinkRepository) CountByDate(ctx context.Context, date string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("DATE(created_at) = ?", date).
		Count(&count).Error
	return count, err
}

// CountAll 统计所有短链数量
func (r *ShortLinkRepository) CountAll(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Count(&count).Error
	return count, err
}

// CountActive 统计活跃短链数量
func (r *ShortLinkRepository) CountActive(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("status = ?", models.LinkStatusActive).
		Count(&count).Error
	return count, err
}

// SumClicksByUserID 统计用户的总点击量
func (r *ShortLinkRepository) SumClicksByUserID(ctx context.Context, userID uint) (int64, error) {
	var sum int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(click_count), 0)").
		Scan(&sum).Error
	return sum, err
}

// SumAllClicks 统计所有短链的总点击量
func (r *ShortLinkRepository) SumAllClicks(ctx context.Context) (int64, error) {
	var sum int64
	err := r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Select("COALESCE(SUM(click_count), 0)").
		Scan(&sum).Error
	return sum, err
}

// GetRecentByUserID 获取用户最近创建的短链
func (r *ShortLinkRepository) GetRecentByUserID(ctx context.Context, userID uint, limit int) ([]*models.ShortLink, error) {
	var links []*models.ShortLink
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&links).Error
	return links, err
}

// ListAll 管理员查询所有短链接（支持按域名、状态、用户过滤）
func (r *ShortLinkRepository) ListAll(ctx context.Context, page, pageSize int, domainID *uint, status *string, userID *uint) ([]models.ShortLink, int64, error) {
	var links []models.ShortLink
	var total int64

	query := r.db.WithContext(ctx).Model(&models.ShortLink{})

	// 按域名过滤
	if domainID != nil {
		query = query.Where("domain_id = ?", *domainID)
	}

	// 按状态过滤
	if status != nil {
		query = query.Where("status = ?", *status)
	}

	// 按用户过滤
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&links).Error
	if err != nil {
		return nil, 0, err
	}

	return links, total, nil
}

// DeleteAsAdmin 管理员删除短链接（不检查所有权，配额返还给创建者）
func (r *ShortLinkRepository) DeleteAsAdmin(ctx context.Context, linkID uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 获取链接（不检查用户）
		var link models.ShortLink
		if err := tx.Where("id = ?", linkID).First(&link).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return apperrors.ErrLinkNotFound
			}
			return err
		}

		// 2. 软删除链接
		if err := tx.Delete(&link).Error; err != nil {
			return err
		}

		// 3. 返还配额给链接创建者（而非操作者）
		if err := tx.Model(&models.User{}).
			Where("id = ? AND quota_used > 0", link.UserID).
			UpdateColumn("quota_used", gorm.Expr("quota_used - 1")).Error; err != nil {
			return err
		}

		return nil
	})
}

// UpdateAsAdmin 管理员更新短链接（不检查所有权）
func (r *ShortLinkRepository) UpdateAsAdmin(ctx context.Context, linkID uint, updates map[string]interface{}) error {
	return r.db.WithContext(ctx).Model(&models.ShortLink{}).
		Where("id = ?", linkID).
		Updates(updates).Error
}
