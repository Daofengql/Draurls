-- 创建数据库
CREATE DATABASE IF NOT EXISTS surls CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE surls;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    keycloak_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'Keycloak用户ID',
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    email VARCHAR(100) NOT NULL COMMENT '邮箱',
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user' COMMENT '角色',
    group_id BIGINT UNSIGNED DEFAULT NULL COMMENT '用户组ID',
    quota INT NOT NULL DEFAULT -1 COMMENT '配额(-1表示无限)',
    quota_used INT NOT NULL DEFAULT 0 COMMENT '已用配额',
    status ENUM('active', 'disabled', 'deleted') NOT NULL DEFAULT 'active' COMMENT '状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME DEFAULT NULL COMMENT '删除时间',
    INDEX idx_keycloak_id (keycloak_id),
    INDEX idx_email (email),
    INDEX idx_group_id (group_id),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 用户组表
CREATE TABLE IF NOT EXISTS user_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '组名',
    description VARCHAR(200) DEFAULT NULL COMMENT '描述',
    default_quota INT NOT NULL DEFAULT -1 COMMENT '默认配额',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME DEFAULT NULL COMMENT '删除时间',
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户组表';

-- 短链接表
CREATE TABLE IF NOT EXISTS short_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE COMMENT '短码',
    url TEXT NOT NULL COMMENT '目标URL',
    user_id BIGINT UNSIGNED NOT NULL COMMENT '创建用户ID',
    title VARCHAR(200) DEFAULT NULL COMMENT '标题',
    expires_at DATETIME DEFAULT NULL COMMENT '过期时间',
    click_count INT NOT NULL DEFAULT 0 COMMENT '点击次数',
    last_click_at DATETIME DEFAULT NULL COMMENT '最后点击时间',
    status ENUM('active', 'disabled', 'expired') NOT NULL DEFAULT 'active' COMMENT '状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME DEFAULT NULL COMMENT '删除时间',
    INDEX idx_code (code),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_deleted_at (deleted_at),
    UNIQUE KEY uk_code_user (code, user_id),
    CONSTRAINT fk_short_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短链接表';

-- URL去重索引（可选，用于快速查找相同URL）
CREATE INDEX idx_url_hash ON short_links((MD5(url)));

-- API密钥表
CREATE TABLE IF NOT EXISTS api_keys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(100) NOT NULL UNIQUE COMMENT 'API密钥',
    name VARCHAR(100) NOT NULL COMMENT '密钥名称',
    user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    expires_at DATETIME DEFAULT NULL COMMENT '过期时间',
    last_used_at DATETIME DEFAULT NULL COMMENT '最后使用时间',
    status ENUM('active', 'disabled', 'expired') NOT NULL DEFAULT 'active' COMMENT '状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME DEFAULT NULL COMMENT '删除时间',
    INDEX idx_key (`key`),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_deleted_at (deleted_at),
    CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API密钥表';

-- 访问日志表
CREATE TABLE IF NOT EXISTS access_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    link_id BIGINT UNSIGNED NOT NULL COMMENT '链接ID',
    ip_address VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
    user_agent TEXT DEFAULT NULL COMMENT 'User-Agent',
    referer TEXT DEFAULT NULL COMMENT '来源',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_link_id (link_id),
    INDEX idx_ip_address (ip_address),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_access_logs_link FOREIGN KEY (link_id) REFERENCES short_links(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='访问日志表';

-- 站点配置表
CREATE TABLE IF NOT EXISTS site_config (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(50) NOT NULL UNIQUE COMMENT '配置键',
    value TEXT DEFAULT NULL COMMENT '配置值',
    description VARCHAR(200) DEFAULT NULL COMMENT '描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站点配置表';

-- 跳转页模板表
CREATE TABLE IF NOT EXISTS redirect_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '模板名称',
    content TEXT NOT NULL COMMENT '模板内容',
    is_default BOOLEAN NOT NULL DEFAULT false COMMENT '是否默认',
    enabled BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='跳转页模板表';

-- 插入默认站点配置
INSERT INTO site_config (`key`, value, description) VALUES
('site_name', 'Surls', '站点名称'),
('logo_url', '', 'Logo URL'),
('redirect_page_enabled', 'false', '是否启用跳转页'),
('custom_domains', '[]', '自定义域名列表'),
('default_quota', '-1', '默认配额'),
('max_link_length', '10', '最大短码长度'),
('enable_signup', 'true', '是否开放注册')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 插入默认管理员用户（需要与Keycloak同步后才能正常使用）
-- 密码需要在Keycloak中设置
INSERT INTO users (keycloak_id, username, email, role, quota, status) VALUES
('admin', 'admin', 'admin@surls.local', 'admin', -1, 'active')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 插入默认用户组
INSERT INTO user_groups (name, description, default_quota) VALUES
('默认组', '默认用户组', -1),
('普通用户', '普通用户组', 1000),
('高级用户', '高级用户组', 10000)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
