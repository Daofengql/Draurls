@echo off
REM 构建脚本：完整构建前端+后端，支持多平台

echo ========================================
echo   Building Draurls (Frontend + Backend)
echo ========================================
echo.

echo [1/3] Building frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo Frontend build failed!
    exit /b 1
)
cd ..

echo.
echo [2/3] Copying frontend dist to backend\cmd\server\web\dist...
if not exist "backend\cmd\server\web" mkdir backend\cmd\server\web
if exist "backend\cmd\server\web\dist" rmdir /s /q backend\cmd\server\web\dist
xcopy /e /i /q /y "frontend\dist" "backend\cmd\server\web\dist"
if errorlevel 1 (
    echo Failed to copy frontend files!
    exit /b 1
)

echo.
echo [3/3] Building backend for multiple platforms...
cd backend
if not exist "bin" mkdir bin

set CGO_ENABLED=0

REM Windows amd64
echo   Building windows/amd64...
set GOOS=windows
set GOARCH=amd64
go build -ldflags="-s -w" -tags=embed -o bin/windows-amd64/server.exe ./cmd/server/...
if errorlevel 1 (
    echo   Failed to build windows/amd64
    cd ..
    exit /b 1
)

REM Linux amd64
echo   Building linux/amd64...
set GOOS=linux
set GOARCH=amd64
go build -ldflags="-s -w" -tags=embed -o bin/linux-amd64/server ./cmd/server/...
if errorlevel 1 (
    echo   Failed to build linux/amd64
    cd ..
    exit /b 1
)

REM Linux arm64
echo   Building linux/arm64...
set GOOS=linux
set GOARCH=arm64
go build -ldflags="-s -w" -tags=embed -o bin/linux-arm64/server ./cmd/server/...
if errorlevel 1 (
    echo   Failed to build linux/arm64
    cd ..
    exit /b 1
)

REM Darwin amd64 (Intel Mac)
echo   Building darwin/amd64...
set GOOS=darwin
set GOARCH=amd64
go build -ldflags="-s -w" -tags=embed -o bin/darwin-amd64/server ./cmd/server/...
if errorlevel 1 (
    echo   Failed to build darwin/amd64
    cd ..
    exit /b 1
)

REM Darwin arm64 (Apple Silicon)
echo   Building darwin/arm64...
set GOOS=darwin
set GOARCH=arm64
go build -ldflags="-s -w" -tags=embed -o bin/darwin-arm64/server ./cmd/server/...
if errorlevel 1 (
    echo   Failed to build darwin/arm64
    cd ..
    exit /b 1
)

cd ..

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Output:
echo   backend\bin\windows-amd64\server.exe
echo   backend\bin\linux-amd64\server
echo   backend\bin\linux-arm64\server
echo   backend\bin\darwin-amd64\server
echo   backend\bin\darwin-arm64\server
