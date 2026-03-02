@echo off
REM Build script: Frontend + Backend, multi-platform
REM Output to dist/ directory

echo ========================================
echo   Building Surls (Frontend + Backend)
echo ========================================
echo.

REM Clean old build artifacts
if exist "dist" rmdir /s /q dist
if exist "frontend\dist" rmdir /s /q frontend\dist
if exist "backend\cmd\server\web" rmdir /s /q backend\cmd\server\web

echo [1/4] Building frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo Frontend build failed!
    cd ..
    exit /b 1
)
cd ..

echo.
echo [2/4] Copying frontend dist to backend\cmd\server\web\dist...
if not exist "backend\cmd\server\web" mkdir backend\cmd\server\web
xcopy /e /i /q /y "frontend\dist" "backend\cmd\server\web\dist"
if errorlevel 1 (
    echo Failed to copy frontend files!
    exit /b 1
)

echo.
echo [3/4] Building backend for multiple platforms...
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
echo [4/4] Organizing dist folder...
mkdir dist\windows-amd64
mkdir dist\linux-amd64
mkdir dist\linux-arm64
mkdir dist\darwin-amd64
mkdir dist\darwin-arm64

copy /y backend\bin\windows-amd64\server.exe dist\windows-amd64\
copy /y backend\bin\linux-amd64\server dist\linux-amd64\
copy /y backend\bin\linux-arm64\server dist\linux-arm64\
copy /y backend\bin\darwin-amd64\server dist\darwin-amd64\
copy /y backend\bin\darwin-arm64\server dist\darwin-arm64\

REM Copy .env.example to each platform folder
copy /y backend\.env.example dist\windows-amd64\
copy /y backend\.env.example dist\linux-amd64\
copy /y backend\.env.example dist\linux-arm64\
copy /y backend\.env.example dist\darwin-amd64\
copy /y backend\.env.example dist\darwin-arm64\

REM Clean intermediate files
echo.
echo Cleaning intermediate files...
rmdir /s /q backend\bin
rmdir /s /q frontend\dist
rmdir /s /q backend\cmd\server\web

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Output:
echo   dist\windows-amd64\server.exe
echo   dist\linux-amd64\server
echo   dist\linux-arm64\server
echo   dist\darwin-amd64\server
echo   dist\darwin-arm64\server
echo.
echo Each folder contains .env.example for configuration.
