# Draurls 后端服务启动指南

## 前置要求

1. **Go** 1.21 或更高版本
2. **MySQL** 5.7+ 或 8.0+
3. **Redis** 5.0+

---

## 快速启动

### 1. 配置环境变量

在 `backend` 目录下创建 `.env` 文件：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，修改数据库和 Redis 配置：

```env
# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=draurls

# Redis 配置
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 2. 创建数据库

```sql
CREATE DATABASE IF NOT EXISTS draurls CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **注意**：表结构会在服务启动时自动创建 (AutoMigrate)

### 3. 安装依赖

```bash
cd backend
go mod download
```

### 4. 启动服务

```bash
go run cmd/server/main.go
```

服务启动后会在 `http://localhost:8080` 监听。

---

## 验证服务

### 健康检查
```bash
curl http://localhost:8080/health
```

### 使用 Mock 认证测试

当前使用 Mock 认证模式，可以直接使用以下 Token 进行测试：

**管理员 Token** (第一个登录用户会自动成为 admin)：
```bash
curl -H "Authorization: Bearer admin-token" http://localhost:8080/api/user/profile
```

**普通用户 Token**：
```bash
curl -H "Authorization: Bearer user-token" http://localhost:8080/api/user/profile
```

---

## Docker 启动 (可选)

### 使用 Docker Compose

```bash
# 启动 MySQL 和 Redis
docker-compose up -d mysql redis

# 启动后端服务
docker-compose up backend
```

### 构建镜像

```bash
docker build -t draurls-backend .
docker run -p 8080:8080 --env-file .env draurls-backend
```

---

## 默认配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| SERVER_PORT | 8080 | 服务监听端口 |
| DB_HOST | 127.0.0.1 | MySQL 主机 |
| DB_PORT | 3306 | MySQL 端口 |
| DB_NAME | draurls | 数据库名称 |
| REDIS_HOST | 127.0.0.1 | Redis 主机 |
| REDIS_PORT | 6379 | Redis 端口 |

---

## API 文档

导入 Postman 集合进行测试：`Draurls-API.postman.json`

主要 API 端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/links` | POST | 创建短链接 |
| `/api/links/:code` | GET | 获取短链接详情 |
| `/api/user/dashboard` | GET | 用户仪表盘 |
| `/api/admin/dashboard/summary` | GET | 管理员统计 |
