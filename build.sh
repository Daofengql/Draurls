#!/bin/bash
# 构建脚本：完整构建前端+后端，支持多平台

set -e

echo "========================================"
echo "  Building Draurls (Frontend + Backend)"
echo "========================================"
echo ""

# 定义目标平台
PLATFORMS=(
    "windows/amd64"
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
)

echo "[1/3] Building frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "[2/3] Copying frontend dist to backend/cmd/server/web/dist..."
mkdir -p backend/cmd/server/web
rm -rf backend/cmd/server/web/dist
cp -r frontend/dist backend/cmd/server/web/dist

echo ""
echo "[3/3] Building backend for multiple platforms..."
cd backend
mkdir -p bin

CGO_ENABLED=0

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
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Output:"
for PLATFORM in "${PLATFORMS[@]}"; do
    GOOS="${PLATFORM%/*}"
    GOARCH="${PLATFORM#*/}"
    if [ "$GOOS" = "windows" ]; then
        echo "  backend/bin/${GOOS}-${GOARCH}/server.exe"
    else
        echo "  backend/bin/${GOOS}-${GOARCH}/server"
    fi
done
