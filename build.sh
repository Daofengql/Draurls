#!/bin/bash
# 构建脚本：完整构建前端+后端，支持多平台
# 构建产物输出到 dist/ 目录

set -e

echo "========================================"
echo "  Building Surls (Frontend + Backend)"
echo "========================================"
echo ""

# 清理旧的构建产物
echo "Cleaning old build artifacts..."
rm -rf dist
rm -rf frontend/dist
rm -rf backend/cmd/server/web

# 定义目标平台
PLATFORMS=(
    "windows/amd64"
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
)

echo "[1/4] Building frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "[2/4] Copying frontend dist to backend/cmd/server/web/dist..."
mkdir -p backend/cmd/server/web
rm -rf backend/cmd/server/web/dist
cp -r frontend/dist backend/cmd/server/web/dist

echo ""
echo "[3/4] Building backend for multiple platforms..."
cd backend
mkdir -p bin

export CGO_ENABLED=0

for PLATFORM in "${PLATFORMS[@]}"; do
    GOOS="${PLATFORM%/*}"
    GOARCH="${PLATFORM#*/}"

    OUTPUT_NAME="server"
    if [ "$GOOS" = "windows" ]; then
        OUTPUT_NAME="server.exe"
    fi

    echo "  Building $GOOS/$GOARCH..."
    GOOS=$GOOS GOARCH=$GOARCH go build -ldflags="-s -w" -tags=embed \
        -o "bin/${GOOS}-${GOARCH}/${OUTPUT_NAME}" ./cmd/server/...
done

cd ..

echo ""
echo "[4/4] Organizing dist folder..."

# 创建 dist 目录结构
mkdir -p dist/{windows-amd64,linux-amd64,linux-arm64,darwin-amd64,darwin-arm64}

# 复制编译产物到 dist
for PLATFORM in "${PLATFORMS[@]}"; do
    GOOS="${PLATFORM%/*}"
    GOARCH="${PLATFORM#*/}"

    OUTPUT_NAME="server"
    if [ "$GOOS" = "windows" ]; then
        OUTPUT_NAME="server.exe"
    fi

    cp "backend/bin/${GOOS}-${GOARCH}/${OUTPUT_NAME}" "dist/${GOOS}-${GOARCH}/"
    cp backend/.env.example "dist/${GOOS}-${GOARCH}/"
done

# 清理中间文件
echo ""
echo "Cleaning intermediate files..."
rm -rf backend/bin
rm -rf frontend/dist
rm -rf backend/cmd/server/web

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Output:"
for PLATFORM in "${PLATFORMS[@]}"; do
    GOOS="${PLATFORM%/*}"
    GOARCH="${PLATFORM#*/}"
    if [ "$GOOS" = "windows" ]; then
        echo "  dist/${GOOS}-${GOARCH}/server.exe"
    else
        echo "  dist/${GOOS}-${GOARCH}/server"
    fi
done
echo ""
echo "Each folder contains .env.example for configuration."
