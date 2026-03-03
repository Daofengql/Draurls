# 多阶段构建 - Draurls 短链接服务

# ================
# 阶段 1: 构建前端
# ================
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./
RUN npm ci

# 复制前端源码并构建
COPY frontend/ ./
RUN npm run build

# ================
# 阶段 2: 构建后端
# ================
FROM golang:1.24-alpine AS backend-builder

WORKDIR /build/backend

# 安装构建依赖
RUN apk add --no-cache git

# 复制后端依赖文件
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# 复制后端源码
COPY backend/ ./

# 复制前端构建产物到 web/dist
COPY --from=frontend-builder /build/frontend/dist ./cmd/server/web/dist

# 构建后端二进制文件（使用 embed tag 嵌入前端资源）
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -tags=embed -o draurls ./cmd/server

# ================
# 阶段 3: 运行镜像
# ================
FROM alpine:3.19

# 安装运行时依赖（如 CA 证书）
RUN apk --no-cache add ca-certificates tzdata

# 设置时区
ENV TZ=Asia/Shanghai

WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=backend-builder /build/backend/draurls /app/draurls

# 复制前端静态资源（如果需要）
COPY --from=backend-builder /build/backend/cmd/server/web /app/web

# 创建非 root 用户
RUN addgroup -g 1000 draurls && \
    adduser -D -u 1000 -G draurls draurls && \
    chown -R draurls:draurls /app

USER draurls

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --spider -q http://localhost:8080/health || exit 1

# 启动服务
CMD ["/app/draurls"]
