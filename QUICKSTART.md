# Surls 后端服务启动指南

## 前置要求

1. **Go** 1.21+
2. **MySQL** 5.7+ 或 8.0+
3. **Redis** 5.0+

---

## 启动步骤

### 1. 创建数据库

```sql
CREATE DATABASE IF NOT EXISTS surls CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> 表结构会在服务启动时自动创建

### 2. 配置环境变量

在 `backend` 目录下创建 `.env` 文件：

```bash
# Windows (PowerShell)
Copy-Item backend\.env.example backend\.env

# Linux/Mac
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，修改数据库密码：

```env
DB_PASSWORD=你的MySQL密码
```

### 3. 安装依赖并启动

```bash
cd backend
go mod download
go run cmd/server/main.go
```

启动成功会看到：

```
Database connected successfully
Running database migrations...
Redis connected successfully
Server starting on :8080
Test tokens:
  Admin: Bearer admin-token
  User:  Bearer user-token
```

---

## 测试接口

### 健康检查
```bash
curl http://localhost:8080/health
```

### 创建短链接（需要 Mock Token）
```bash
curl -X POST http://localhost:8080/api/links \
  -H "Authorization: Bearer user-token" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com", "title": "测试链接"}'
```

---

## Mock 认证说明

当前使用 Mock 认证模式，直接使用以下 Token：

| Token | 角色 |
|-------|------|
| `admin-token` | 管理员 |
| `user-token` | 普通用户 |

**第一个通过认证登录的用户会自动成为 admin**

---

## 常见问题

**Q: 提示连接 MySQL 失败？**
- 检查 MySQL 是否启动
- 检查 `.env` 中的 `DB_PASSWORD` 是否正确

**Q: 提示连接 Redis 失败？**
- 检查 Redis 是否启动：`redis-cli ping`
- Windows 下可以安装 Redis 或使用 WSL

**Q: 端口被占用？**
- 修改 `.env` 中的 `SERVER_PORT`
