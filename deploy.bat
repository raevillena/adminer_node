@echo off
REM Adminer Node Deployment Script for Windows
REM Usage: deploy.bat [vercel|server|docker]

setlocal enabledelayedexpansion

set DEPLOYMENT_TYPE=%1
if "%DEPLOYMENT_TYPE%"=="" set DEPLOYMENT_TYPE=server

echo 🚀 Starting Adminer Node deployment (%DEPLOYMENT_TYPE%)...

if "%DEPLOYMENT_TYPE%"=="vercel" (
    echo 📦 Deploying to Vercel...
    
    REM Check if Vercel CLI is installed
    vercel --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Vercel CLI not found. Installing...
        npm install -g vercel
    )
    
    REM Deploy to Vercel
    vercel --prod
    
    echo ✅ Vercel deployment completed!
    echo 🔧 Don't forget to set environment variables in Vercel dashboard:
    echo    - VITE_API_URL=https://your-backend-api-url.com/api
    echo    - NODE_ENV=production
    
) else if "%DEPLOYMENT_TYPE%"=="server" (
    echo 🖥️  Deploying to server...
    
    REM Create logs directory
    if not exist logs mkdir logs
    
    REM Install dependencies
    echo 📦 Installing dependencies...
    call npm run install:all
    
    REM Build applications
    echo 🔨 Building applications...
    call npm run build:frontend
    call npm run build:backend
    
    REM Check if PM2 is installed
    pm2 --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ PM2 not found. Installing...
        npm install -g pm2
    )
    
    REM Start with PM2
    echo 🚀 Starting application with PM2...
    pm2 start ecosystem.config.js
    
    REM Save PM2 configuration
    pm2 save
    
    echo ✅ Server deployment completed!
    echo 🔧 Don't forget to:
    echo    - Configure Nginx reverse proxy
    echo    - Set up SSL certificate
    echo    - Configure environment variables
    
) else if "%DEPLOYMENT_TYPE%"=="docker" (
    echo 🐳 Deploying with Docker...
    
    REM Check if Docker is installed
    docker --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker not found. Please install Docker first.
        exit /b 1
    )
    
    REM Check if Docker Compose is installed
    docker-compose --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose not found. Please install Docker Compose first.
        exit /b 1
    )
    
    REM Build and start services
    echo 🔨 Building Docker images...
    docker-compose build
    
    echo 🚀 Starting services...
    docker-compose up -d
    
    echo ✅ Docker deployment completed!
    echo 🔧 Don't forget to:
    echo    - Configure environment variables in docker-compose.yml
    echo    - Set up SSL certificates for production
    echo    - Configure your domain name
    
) else (
    echo ❌ Invalid deployment type. Use: vercel, server, or docker
    echo Usage: deploy.bat [vercel^|server^|docker]
    exit /b 1
)

echo 🎉 Deployment completed successfully!
pause
