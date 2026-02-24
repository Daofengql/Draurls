# 后端
FROM golang:1.23-alpine AS backend-builder

WORKDIR /app

# 安装依赖
COPY backend/go.mod backend/go.sum* ./
RUN go mod download

# 复制源码
COPY backend/ ./

# 构建
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# 前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 安装依赖
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# 复制源码并构建
COPY frontend/ ./
RUN npm run build

# 最终镜像
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# 复制后端
COPY --from=backend-builder /app/server /app/server

# 复制前端静态文件
COPY --from=frontend-builder /app/dist /app/web

# 设置时区
ENV TZ=Asia/Shanghai

EXPOSE 8080

CMD ["/app/server"]
