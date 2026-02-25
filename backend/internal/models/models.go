package models

import (
	"time"
)

// User 用户模型
type User struct {
	ID        uint       `gorm:"primarykey"`
	KeycloakID string    `gorm:"uniqueIndex;size:100;comment:Keycloak用户ID"`
	Username   string    `gorm:"size:50;comment:用户名"`
	Nickname  string    `gorm:"size:100;comment:昵称"`
	Picture   string    `gorm:"size:500;comment:头像URL"`
	Email      string    `gorm:"size:100;index;comment:邮箱"`
	Role       UserRole   `gorm:"size:20;not null;default:'user';comment:角色"`
	GroupID    *uint     `gorm:"index;comment:用户组ID"`
	Group      *UserGroup `gorm:"foreignKey:GroupID" json:"group,omitempty"`
	Quota      int       `gorm:"not null;default:-1;comment:配额(-1表示无限,-2表示继承用户组)"`
	QuotaUsed  int       `gorm:"not null;default:0;comment:已用配额"`
	Status     UserStatus `gorm:"size:20;not null;default:'active';index:idx_status_role;comment:状态"`
	CreatedAt  time.Time  `gorm:"index:idx_status_role"`
	UpdatedAt  time.Time
	DeletedAt  *time.Time `gorm:"index"`
}

// UserRole 用户角色
type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleUser  UserRole = "user"
)

// UserStatus 用户状态
type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusDisabled UserStatus = "disabled"
	UserStatusDeleted  UserStatus = "deleted"
)

// UserGroup 用户组
type UserGroup struct {
	ID           uint      `gorm:"primarykey"`
	Name         string    `gorm:"size:50;uniqueIndex;not null;comment:组名"`
	Description  string    `gorm:"size:200;comment:描述"`
	DefaultQuota int       `gorm:"not null;default:-1;comment:默认配额"`
	IsDefault    bool      `gorm:"not null;default:false;comment:是否默认组(新用户自动加入)"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time `gorm:"index"`
}

// ShortLink 短链接
type ShortLink struct {
	ID          uint            `gorm:"primarykey"`
	Code        string          `gorm:"size:20;not null;comment:短码"`
	DomainID    uint            `gorm:"index:idx_domain_code;not null;default:1;comment:域名ID"`
	Domain      *Domain         `gorm:"foreignKey:DomainID"`
	URL         string          `gorm:"type:text;not null;comment:目标URL"`
	UserID      uint            `gorm:"index:idx_user_status_created;not null;comment:创建用户ID"`
	User        *User           `gorm:"foreignKey:UserID"`
	Title       string          `gorm:"size:200;comment:标题"`
	ExpiresAt   *time.Time      `gorm:"index:idx_expires_status;comment:过期时间"`
	ClickCount  int             `gorm:"not null;default:0;comment:点击次数"`
	LastClickAt *time.Time      `gorm:"comment:最后点击时间"`
	Status      LinkStatus      `gorm:"size:20;not null;default:'active';index:idx_user_status_created,idx_expires_status;comment:状态"`
	CreatedAt   time.Time       `gorm:"index:idx_user_status_created"`
	UpdatedAt   time.Time
	DeletedAt   *time.Time      `gorm:"index"`
}

// LinkStatus 链接状态
type LinkStatus string

const (
	LinkStatusActive   LinkStatus = "active"
	LinkStatusDisabled LinkStatus = "disabled"
	LinkStatusExpired  LinkStatus = "expired"
)

// APIKey API密钥
type APIKey struct {
	ID         uint         `gorm:"primarykey"`
	Key        string       `gorm:"uniqueIndex;size:100;not null;comment:API密钥"`
	Name       string       `gorm:"size:100;not null;comment:密钥名称"`
	UserID     uint         `gorm:"index:idx_user_status;not null;comment:用户ID"`
	User       *User        `gorm:"foreignKey:UserID"`
	ExpiresAt  *time.Time   `gorm:"index:idx_expires_status;comment:过期时间"`
	LastUsedAt *time.Time   `gorm:"comment:最后使用时间"`
	Status     APIKeyStatus `gorm:"size:20;not null;default:'active';index:idx_user_status,idx_expires_status;comment:状态"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  *time.Time    `gorm:"index"`
}

// APIKeyStatus API密钥状态
type APIKeyStatus string

const (
	APIKeyStatusActive   APIKeyStatus = "active"
	APIKeyStatusDisabled APIKeyStatus = "disabled"
	APIKeyStatusExpired  APIKeyStatus = "expired"
)

// AccessLog 访问日志
type AccessLog struct {
	ID        uint       `gorm:"primarykey"`
	LinkID    uint       `gorm:"index:idx_link_created;not null;comment:链接ID"`
	Link      *ShortLink `gorm:"foreignKey:LinkID"`
	IPAddress string     `gorm:"size:50;index;comment:IP地址"`
	UserAgent string     `gorm:"type:text;comment:User-Agent"`
	Referer   string     `gorm:"type:text;comment:来源"`
	CreatedAt time.Time  `gorm:"index:idx_link_created"`
}

// TableName 指定访问日志表名
func (AccessLog) TableName() string {
	return "access_logs"
}

// SiteConfig 站点配置
type SiteConfig struct {
	ID          uint      `gorm:"primarykey"`
	Key         string    `gorm:"uniqueIndex;size:50;not null;comment:配置键"`
	Value       string    `gorm:"type:text;comment:配置值"`
	Description string    `gorm:"size:200;comment:描述"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// 预定义的站点配置键
const (
	ConfigSiteName      = "site_name"
	ConfigLogoURL       = "logo_url"
	ConfigRedirectPage  = "redirect_page_enabled"
	ConfigDefaultQuota  = "default_quota"
	ConfigMaxLinkLength = "max_link_length"
	ConfigEnableSignup  = "enable_signup"
	ConfigShortcodeMode = "shortcode_mode"
	ConfigAllowCustomShortcode = "allow_custom_shortcode"
)

// ShortcodeMode 短码生成模式
type ShortcodeMode string

const (
	ShortcodeModeRandom   ShortcodeMode = "random"   // 随机字符串
	ShortcodeModeSequence ShortcodeMode = "sequence" // 数据库自增序列
)

// RedirectTemplate 跳转页模板
type RedirectTemplate struct {
	ID        uint      `gorm:"primarykey"`
	Name      string    `gorm:"size:50;uniqueIndex;not null;comment:模板名称"`
	Content   string    `gorm:"type:text;not null;comment:模板内容"`
	IsDefault bool      `gorm:"not null;default:false;comment:是否默认"`
	Enabled   bool      `gorm:"not null;default:true;comment:是否启用"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Domain 域名配置
type Domain struct {
	ID          uint      `gorm:"primarykey"`
	Name        string    `gorm:"uniqueIndex;size:100;not null;comment:域名"`
	IsActive    bool      `gorm:"not null;default:true;comment:是否启用"`
	IsDefault   bool      `gorm:"not null;default:false;comment:是否默认域名"`
	SSL         bool      `gorm:"not null;default:true;comment:是否启用HTTPS"`
	Description string    `gorm:"size:200;comment:描述"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   *time.Time `gorm:"index"`
}

// DomainGroupDomain 域名-用户组关联（多对多）
type DomainGroupDomain struct {
	DomainID uint `gorm:"primarykey;comment:域名ID"`
	GroupID  uint `gorm:"primarykey;comment:用户组ID"`
	Domain   *Domain    `gorm:"foreignKey:DomainID"`
	Group    *UserGroup `gorm:"foreignKey:GroupID"`
}
