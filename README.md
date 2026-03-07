# Surls - 麟云短链

一个功能完整的短链接服务系统，使用 Golang + React 构建。

## 特性

- **短链接生成** - 支持随机和自定义短码，URL 去重，时效控制
- **跳转模板** - 用户可自定义跳转页面模板
- **用户系统** - OIDC 认证、用户分组、配额管理
- **API 接口** - RESTful API + HMAC 签名认证
- **性能优化** - Redis 多级缓存（短链接、域名、模板）、接口限流
- **管理面板** - Material-UI 响应式设计，支持移动端
- **站点配置** - 支持 ICP 备案号配置等功能

## 技术栈

| 后端 | 前端 | 数据库 | 缓存 | 认证 |
|------|------|--------|------|------|
| Go + Gin | React + TypeScript + MUI | MySQL 8.0 | Redis 7 | Keycloak |

## 快速开始

### Docker Compose（推荐）

```bash
git clone https://github.com/Daofengql/Draurls.git
cd Draurls
docker-compose up -d
```

访问：http://localhost:8080

### 本地开发

```bash
# 后端
cd backend && cp .env.example .env
go run cmd/server/main.go

# 前端
cd frontend && npm install && npm run dev
```

### 生产构建

```bash
./build.sh    # Linux/macOS
build.bat     # Windows
```

构建产物输出到 `dist/` 目录。

## 文档

- [API 文档](docs/api.md) - RESTful API 接口说明
- [配置指南](docs/configuration.md) - 环境变量和站点配置
- [部署指南](docs/deployment.md) - 生产环境部署
- [架构说明](docs/architecture.md) - 项目结构和设计

## 许可证

MIT License
