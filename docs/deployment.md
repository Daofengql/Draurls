# 部署指南

## Docker Compose 部署（推荐）

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+

### 启动服务

```bash
# 克隆项目
git clone https://github.com/Daofengql/Surls.git
cd Surls

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 服务访问

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:8080 |
| 前端页面 | http://localhost:3000 |
| Keycloak | http://localhost:8081 |

## 二进制部署

### 构建项目

```bash
# Linux/macOS
./build.sh

# Windows
build.bat
```

构建产物输出到 `dist/` 目录，包含以下平台：

- `windows-amd64/server.exe`
- `linux-amd64/server`
- `linux-arm64/server`
- `darwin-amd64/server` (Intel Mac)
- `darwin-arm64/server` (Apple Silicon)

### 部署步骤

1. **上传文件**

```bash
# 上传对应平台的文件到服务器
scp dist/linux-amd64/server user@server:/opt/surls/
scp dist/linux-amd64/.env.example user@server:/opt/surls/.env
```

2. **配置环境变量**

```bash
cd /opt/surls
vim .env  # 修改数据库、Redis 等配置
```

3. **创建 systemd 服务**

```bash
sudo vim /etc/systemd/system/surls.service
```

```ini
[Unit]
Description=Surls Short Link Service
After=network.target mysql.service redis.service

[Service]
Type=simple
User=surls
WorkingDirectory=/opt/surls
ExecStart=/opt/surls/server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable surls
sudo systemctl start surls
```

## Nginx 反向代理

### 配置示例

```nginx
server {
    listen 80;
    server_name surls.example.com;

    # 前端静态文件（开发时可分开部署）
    # location / {
    #     root /opt/surls/frontend/dist;
    #     try_files $uri $uri/ /index.html;
    # }

    # API 接口
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 短链跳转
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 数据库初始化

### MySQL

```sql
CREATE DATABASE surls CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'surls'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON surls.* TO 'surls'@'localhost';
FLUSH PRIVILEGES;
```

首次启动会自动执行数据库迁移。

## Keycloak 配置

### 创建 Realm

1. 登录 Keycloak 管理后台
2. 创建新 Realm（如 `surls`）

### 创建 Client

| 配置项 | 值 |
|--------|-----|
| Client ID | surls |
| Client Authentication | ON |
| Authentication Flow | Standard Flow |
| Valid Redirect URIs | http://localhost:8080/api/auth/callback |

### 配置用户存储

可以启用 Keycloak 的用户注册功能，或使用现有 LDAP/Active Directory。

## 监控和日志

### 日志位置

- 应用日志：`/opt/surls/logs/`（如配置）
- systemd 日志：`journalctl -u surls -f`

### 健康检查

```bash
curl http://localhost:8080/health
```

## 备份策略

### 数据库备份

```bash
# 每日备份
mysqldump -u surls -p surls > backup_$(date +%Y%m%d).sql
```

### Redis 备份

Redis 默认开启 RDB 持久化，备份 `dump.rdb` 文件即可。

## 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查 `.env` 中的数据库配置
   - 确认 MySQL 服务运行正常

2. **Redis 连接失败**
   - 检查 Redis 服务状态
   - 验证密码配置

3. **短链跳转 404**
   - 确认域名配置正确
   - 检查链接是否过期或被禁用

4. **CORS 错误**
   - 在管理后台配置正确的 `cors_origins`
