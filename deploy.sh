#!/bin/bash

# Adminer Node Deployment Script
# Usage: ./deploy.sh [vercel|server|docker]

set -e

DEPLOYMENT_TYPE=${1:-"server"}

echo "🚀 Starting Adminer Node deployment ($DEPLOYMENT_TYPE)..."

case $DEPLOYMENT_TYPE in
  "vercel")
    echo "📦 Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
      echo "❌ Vercel CLI not found. Installing..."
      npm install -g vercel
    fi
    
    # Deploy to Vercel
    vercel --prod
    
    echo "✅ Vercel deployment completed!"
    echo "🔧 Don't forget to set environment variables in Vercel dashboard:"
    echo "   - VITE_API_URL=https://your-backend-api-url.com/api"
    echo "   - NODE_ENV=production"
    ;;
    
  "server")
    echo "🖥️  Deploying to server..."
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
      echo "❌ Please don't run this script as root"
      exit 1
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm run install:all
    
    # Build applications
    echo "🔨 Building applications..."
    npm run build:frontend
    npm run build:backend
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
      echo "❌ PM2 not found. Installing..."
      sudo npm install -g pm2
    fi
    
    # Start with PM2
    echo "🚀 Starting application with PM2..."
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    echo "✅ Server deployment completed!"
    echo "🔧 Don't forget to:"
    echo "   - Configure Nginx reverse proxy"
    echo "   - Set up SSL certificate"
    echo "   - Configure environment variables"
    ;;
    
  "docker")
    echo "🐳 Deploying with Docker..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
      echo "❌ Docker not found. Please install Docker first."
      exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
      echo "❌ Docker Compose not found. Please install Docker Compose first."
      exit 1
    fi
    
    # Build and start services
    echo "🔨 Building Docker images..."
    docker-compose build
    
    echo "🚀 Starting services..."
    docker-compose up -d
    
    echo "✅ Docker deployment completed!"
    echo "🔧 Don't forget to:"
    echo "   - Configure environment variables in docker-compose.yml"
    echo "   - Set up SSL certificates for production"
    echo "   - Configure your domain name"
    ;;
    
  *)
    echo "❌ Invalid deployment type. Use: vercel, server, or docker"
    echo "Usage: ./deploy.sh [vercel|server|docker]"
    exit 1
    ;;
esac

echo "🎉 Deployment completed successfully!"
