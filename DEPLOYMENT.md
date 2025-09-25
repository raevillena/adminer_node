# 🚀 Adminer Node Deployment Guide

This guide provides comprehensive instructions for deploying Adminer Node to various platforms and environments.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Deployment Options](#deployment-options)
  - [Vercel (Frontend Only)](#vercel-frontend-only)
  - [Traditional Server](#traditional-server)
  - [Docker Deployment](#docker-deployment)
  - [Cloud Platforms](#cloud-platforms)
- [Environment Configuration](#environment-configuration)
- [SSL/HTTPS Setup](#sslhttps-setup)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- Database (MySQL/PostgreSQL)

### One-Command Deployment

```bash
# Clone repository
git clone <your-repo-url>
cd adminer-node

# Deploy to server
./deploy.sh server

# Deploy with Docker
./deploy.sh docker

# Deploy to Vercel
./deploy.sh vercel
```

## Deployment Options

### Vercel (Frontend Only)

**Best for**: Quick deployment, static hosting, serverless functions

#### Prerequisites
- Vercel account
- GitHub repository
- Backend deployed separately

#### Steps

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy Frontend**
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables**
   In Vercel dashboard → Settings → Environment Variables:
   ```
   VITE_API_URL=https://your-backend-api-url.com/api
   NODE_ENV=production
   ```

4. **Deploy Backend Separately**
   - Railway: `railway deploy`
   - Render: Connect GitHub repository
   - Heroku: `git push heroku main`

#### Vercel Configuration
The project includes optimized Vercel configuration files:
- `vercel.json` - Root configuration
- `frontend/vercel.json` - Frontend-specific settings

---

### Traditional Server

**Best for**: Full control, custom domains, dedicated servers

#### Prerequisites
- Linux server (Ubuntu 20.04+ recommended)
- Node.js 18+
- Nginx
- PM2
- SSL certificate

#### Automated Setup

1. **Run Deployment Script**
   ```bash
   ./deploy.sh server
   ```

2. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/adminer-node
   ```
   
   Use the configuration from the README.md

3. **Setup SSL**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

#### Manual Setup

1. **Server Preparation**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Nginx
   sudo apt install nginx -y
   
   # Install PM2
   sudo npm install -g pm2
   ```

2. **Application Setup**
   ```bash
   # Clone repository
   git clone <your-repo-url> /var/www/adminer-node
   cd /var/www/adminer-node
   
   # Install dependencies
   npm run install:all
   
   # Build applications
   npm run build:frontend
   npm run build:backend
   ```

3. **PM2 Configuration**
   ```bash
   # Start application
   pm2 start ecosystem.config.js
   
   # Save configuration
   pm2 save
   
   # Setup auto-start
   pm2 startup
   ```

---

### Docker Deployment

**Best for**: Containerized environments, Kubernetes, consistent deployments

#### Prerequisites
- Docker and Docker Compose
- Docker Hub account (optional)

#### Quick Start

1. **Development Environment**
   ```bash
   docker-compose up -d
   ```

2. **Production Environment**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

#### Custom Configuration

1. **Environment Variables**
   ```bash
   # Copy environment template
   cp backend/env.example backend/.env
   
   # Edit configuration
   nano backend/.env
   ```

2. **SSL Certificates**
   ```bash
   # Create SSL directory
   mkdir ssl
   
   # Copy your certificates
   cp your-cert.pem ssl/cert.pem
   cp your-key.pem ssl/key.pem
   ```

3. **Database Setup**
   ```bash
   # MySQL
   docker-compose up -d mysql
   
   # PostgreSQL
   docker-compose up -d postgres
   ```

#### Docker Files Included
- `backend/Dockerfile` - Backend container
- `frontend/Dockerfile` - Frontend container
- `docker-compose.yml` - Development setup
- `docker-compose.prod.yml` - Production setup
- `nginx-prod.conf` - Production Nginx configuration

---

### Cloud Platforms

#### Railway

1. **Connect Repository**
   - Go to Railway dashboard
   - Connect your GitHub repository
   - Select the project

2. **Configure Environment**
   ```
   NODE_ENV=production
   PORT=5000
   JWT_SECRET=your-secret-key
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

3. **Deploy**
   - Railway automatically builds and deploys
   - Get the deployment URL
   - Update frontend `VITE_API_URL`

#### Render

1. **Create Web Service**
   - Connect GitHub repository
   - Select "Web Service"
   - Choose Node.js

2. **Build Configuration**
   ```
   Build Command: npm run build:backend
   Start Command: npm start
   ```

3. **Environment Variables**
   ```
   NODE_ENV=production
   JWT_SECRET=your-secret-key
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

#### DigitalOcean App Platform

1. **Create App**
   - Connect GitHub repository
   - Select "Web Service"
   - Choose Node.js

2. **Configure Build**
   ```
   Build Command: npm run build:backend
   Run Command: npm start
   ```

3. **Environment Variables**
   ```
   NODE_ENV=production
   JWT_SECRET=your-secret-key
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

---

## Environment Configuration

### Frontend Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `/api` | No |
| `NODE_ENV` | Environment | `development` | No |

### Backend Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `5000` | No |
| `NODE_ENV` | Environment | `development` | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRES_IN` | Token expiration | `24h` | No |
| `CORS_ORIGIN` | Allowed origins | `*` | No |

### Database Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Full database URL | `mysql://user:pass@host:port/db` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_USER` | Database user | `adminer_user` |
| `DB_PASSWORD` | Database password | `secure_password` |
| `DB_NAME` | Database name | `adminer_db` |

---

## SSL/HTTPS Setup

### Let's Encrypt (Recommended)

1. **Install Certbot**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. **Get Certificate**
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

3. **Test Auto-renewal**
   ```bash
   sudo certbot renew --dry-run
   ```

### Custom SSL Certificates

1. **Nginx Configuration**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       # SSL configuration
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
       ssl_prefer_server_ciphers off;
   }
   ```

2. **Docker SSL Setup**
   ```bash
   # Create SSL directory
   mkdir ssl
   
   # Copy certificates
   cp your-cert.pem ssl/cert.pem
   cp your-key.pem ssl/key.pem
   
   # Update docker-compose.prod.yml
   volumes:
     - ./ssl:/etc/nginx/ssl:ro
   ```

---

## Monitoring & Maintenance

### PM2 Monitoring

```bash
# Check status
pm2 status

# View logs
pm2 logs adminer-backend

# Monitor resources
pm2 monit

# Restart application
pm2 restart adminer-backend

# Stop application
pm2 stop adminer-backend
```

### Docker Monitoring

```bash
# Check containers
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Update and restart
docker-compose pull
docker-compose up -d
```

### Application Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
npm run build:frontend
npm run build:backend
pm2 restart adminer-backend

# Or with Docker
docker-compose build
docker-compose up -d
```

### Backup Strategy

1. **Application Backup**
   ```bash
   # Create backup script
   nano backup.sh
   ```

   ```bash
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/var/backups/adminer-node"
   
   mkdir -p $BACKUP_DIR
   
   # Backup application
   tar -czf $BACKUP_DIR/adminer-node_$DATE.tar.gz /var/www/adminer-node
   
   # Keep only last 7 days
   find $BACKUP_DIR -name "adminer-node_*.tar.gz" -mtime +7 -delete
   ```

2. **Database Backup**
   ```bash
   # MySQL backup
   mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql
   
   # PostgreSQL backup
   pg_dump -U username database_name > backup_$(date +%Y%m%d).sql
   ```

---

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   
   # Check TypeScript errors
   npm run type-check
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connection
   mysql -h host -u user -p
   
   # Check firewall
   sudo ufw status
   ```

3. **CORS Errors**
   ```bash
   # Update CORS_ORIGIN
   export CORS_ORIGIN=https://yourdomain.com
   ```

4. **Permission Errors**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER /var/www/adminer-node
   sudo chmod -R 755 /var/www/adminer-node
   ```

### Performance Optimization

1. **Nginx Optimization**
   ```nginx
   # Enable gzip
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types text/plain text/css application/json application/javascript;
   
   # Enable caching
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

2. **Node.js Optimization**
   ```bash
   # Increase memory limit
   export NODE_OPTIONS="--max-old-space-size=4096"
   
   # Use PM2 cluster mode
   pm2 start ecosystem.config.js -i max
   ```

3. **Database Optimization**
   - Enable query caching
   - Optimize indexes
   - Use connection pooling

### Security Checklist

- [ ] Change default JWT secret
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Database access restrictions
- [ ] Backup strategy in place

---

## Support

For additional help:

1. Check the [README.md](README.md) for basic setup
2. Review the [troubleshooting section](#troubleshooting)
3. Check GitHub issues
4. Create a new issue with detailed information

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
