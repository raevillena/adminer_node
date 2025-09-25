# Adminer Node

A full-featured Adminer-like web application built with React and Express.js, providing comprehensive database management capabilities for MySQL and PostgreSQL databases.

## Features

### 🗄️ Database Support
- **MySQL** - Full support with all features
- **MariaDB** - Complete implementation (MySQL-compatible)
- **PostgreSQL** - Complete implementation
- **Future-ready** - SQLite and MS SQL support planned

### 🔧 Core Features
- **Connection Management** - Save and manage multiple database connections securely
- **Database Overview** - List databases with size, encoding, and collation information
- **Table Management** - Complete table structure viewing including:
  - Columns (types, defaults, nullable, auto_increment)
  - Indexes (primary, unique, fulltext, spatial)
  - Foreign keys with referential actions
  - Constraints and triggers
- **Data Management** - Full CRUD operations with:
  - Paginated data browsing
  - Insert, edit, and delete rows
  - Search and sorting capabilities
  - Export selected data
- **Query Execution** - Advanced SQL editor with:
  - Syntax highlighting (CodeMirror 6)
  - Query history and saved queries
  - Execution time tracking
  - Auto-completion and suggestions
- **User Management** - Database user administration:
  - Create, edit, and delete users
  - Grant/revoke privileges
  - User permission management
- **Export/Import** - Data and schema management:
  - Export to SQL, CSV, and JSON formats
  - Import SQL dumps
  - Schema-only or data-only exports
- **Server Monitoring** - Real-time server information:
  - Server version and uptime
  - Active processes and queries
  - Performance statistics
  - Process management

### 🎨 User Interface
- **Modern Design** - Clean, responsive interface inspired by Adminer/pgAdmin
- **Dark/Light Themes** - Toggle between themes with persistent preferences
- **Mobile Responsive** - Optimized for all screen sizes
- **Material-UI Components** - Professional, accessible components
- **Tabbed Interface** - Multiple queries and views open simultaneously

## Technology Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Full type safety and better developer experience
- **Vite** - Fast build tool and development server
- **Material-UI (MUI)** - Professional component library
- **React Query** - Powerful data fetching and caching
- **React Router** - Client-side routing
- **CodeMirror 6** - Advanced code editor with SQL syntax highlighting
- **Axios** - HTTP client for API communication

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server-side development
- **MySQL2** - MySQL/MariaDB database driver
- **PostgreSQL (pg)** - PostgreSQL database driver
- **JWT** - Authentication and session management
- **Express Validator** - Input validation and sanitization
- **Helmet** - Security middleware
- **Rate Limiting** - API protection

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MySQL or PostgreSQL database

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd adminer-node
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cp backend/env.example backend/.env
   ```
   
   Edit `backend/.env` with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend API server on http://localhost:5000
   - Frontend development server on http://localhost:3000

5. **Open your browser**
   Navigate to http://localhost:3000 and start managing your databases!

## 🚀 Deployment Options

### Option 1: Vercel Deployment (Frontend Only)

**Best for**: Quick deployment, static hosting, serverless functions

#### Prerequisites
- Vercel account
- GitHub repository
- Backend deployed separately (Railway, Render, Heroku, etc.)

#### Steps

1. **Deploy Frontend to Vercel**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

2. **Set Environment Variables in Vercel Dashboard**
   ```
   VITE_API_URL=https://your-backend-api-url.com/api
   NODE_ENV=production
   ```

3. **Deploy Backend Separately**
   - Deploy to Railway, Render, Heroku, or DigitalOcean
   - Update `VITE_API_URL` to point to your backend

#### Vercel Configuration
The project includes `vercel.json` and `frontend/vercel.json` for optimal Vercel deployment.

---

### Option 2: Traditional Server Deployment

**Best for**: Full control, custom domains, dedicated servers

#### Prerequisites
- Linux server (Ubuntu 20.04+ recommended)
- Node.js 18+
- Nginx (for reverse proxy)
- PM2 (for process management)
- SSL certificate (Let's Encrypt)

#### Server Setup

1. **Prepare the Server**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Nginx
   sudo apt install nginx -y
   
   # Install PM2 globally
   sudo npm install -g pm2
   
   # Install Git
   sudo apt install git -y
   ```

2. **Clone and Setup Project**
   ```bash
   # Clone repository
   git clone <your-repo-url> /var/www/adminer-node
   cd /var/www/adminer-node
   
   # Install dependencies
   npm run install:all
   
   # Build frontend
   npm run build:frontend
   
   # Build backend
   npm run build:backend
   ```

3. **Configure Environment Variables**
   ```bash
   # Create production environment file
   sudo nano /var/www/adminer-node/backend/.env
   ```
   
   Add your production configuration:
   ```env
   PORT=5000
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   CORS_ORIGIN=https://yourdomain.com
   ```

4. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/adminer-node
   ```
   
   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       
       # Frontend (React app)
       location / {
           root /var/www/adminer-node/frontend/dist;
           index index.html;
           try_files $uri $uri/ /index.html;
       }
       
       # Backend API
       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Enable Site and Restart Nginx**
   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/adminer-node /etc/nginx/sites-enabled/
   
   # Test configuration
   sudo nginx -t
   
   # Restart Nginx
   sudo systemctl restart nginx
   ```

6. **Setup PM2 Process Management**
   ```bash
   # Create PM2 ecosystem file
   nano /var/www/adminer-node/ecosystem.config.js
   ```
   
   Add this configuration:
   ```javascript
   module.exports = {
     apps: [{
       name: 'adminer-backend',
       script: './backend/dist/index.js',
       cwd: '/var/www/adminer-node',
       instances: 1,
       autorestart: true,
       watch: false,
       max_memory_restart: '1G',
       env: {
         NODE_ENV: 'production',
         PORT: 5000
       }
     }]
   };
   ```

7. **Start Application with PM2**
   ```bash
   # Start application
   pm2 start ecosystem.config.js
   
   # Save PM2 configuration
   pm2 save
   
   # Setup PM2 to start on boot
   pm2 startup
   ```

8. **Setup SSL with Let's Encrypt**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx -y
   
   # Get SSL certificate
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   
   # Test auto-renewal
   sudo certbot renew --dry-run
   ```

#### Production Environment Variables

Create `/var/www/adminer-node/backend/.env`:
```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Security
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=https://yourdomain.com

# Database (if using environment variables)
# DATABASE_URL=mysql://username:password@host:port/database
# Or for PostgreSQL:
# DATABASE_URL=postgresql://username:password@host:port/database
```

#### Monitoring and Maintenance

1. **Monitor Application**
   ```bash
   # Check PM2 status
   pm2 status
   
   # View logs
   pm2 logs adminer-backend
   
   # Monitor resources
   pm2 monit
   ```

2. **Update Application**
   ```bash
   # Pull latest changes
   git pull origin master
   
   # Rebuild and restart
   npm run build:frontend
   npm run build:backend
   pm2 restart adminer-backend
   ```

3. **Backup Strategy**
   ```bash
   # Create backup script
   nano /var/www/adminer-node/backup.sh
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

---

### Option 3: Docker Deployment

**Best for**: Containerized environments, Kubernetes, consistent deployments

#### Prerequisites
- Docker and Docker Compose
- Docker Hub account (optional)

#### Docker Setup

1. **Create Dockerfile for Backend**
   ```dockerfile
   # backend/Dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   # Copy package files
   COPY package*.json ./
   
   # Install dependencies
   RUN npm ci --only=production
   
   # Copy source code
   COPY . .
   
   # Build application
   RUN npm run build
   
   # Expose port
   EXPOSE 5000
   
   # Start application
   CMD ["npm", "start"]
   ```

2. **Create Dockerfile for Frontend**
   ```dockerfile
   # frontend/Dockerfile
   FROM node:18-alpine as build
   
   WORKDIR /app
   
   # Copy package files
   COPY package*.json ./
   
   # Install dependencies
   RUN npm ci
   
   # Copy source code
   COPY . .
   
   # Build application
   RUN npm run build
   
   # Production stage
   FROM nginx:alpine
   
   # Copy built files
   COPY --from=build /app/dist /usr/share/nginx/html
   
   # Copy nginx configuration
   COPY nginx.conf /etc/nginx/nginx.conf
   
   # Expose port
   EXPOSE 80
   
   CMD ["nginx", "-g", "daemon off;"]
   ```

3. **Create Docker Compose**
   ```yaml
   # docker-compose.yml
   version: '3.8'
   
   services:
     frontend:
       build: ./frontend
       ports:
         - "80:80"
       depends_on:
         - backend
       environment:
         - VITE_API_URL=http://localhost:5000/api
   
     backend:
       build: ./backend
       ports:
         - "5000:5000"
       environment:
         - NODE_ENV=production
         - PORT=5000
         - JWT_SECRET=your-super-secret-jwt-key
         - CORS_ORIGIN=http://localhost
       volumes:
         - ./backend/.env:/app/.env
   
     database:
       image: mysql:8.0
       environment:
         - MYSQL_ROOT_PASSWORD=rootpassword
         - MYSQL_DATABASE=adminer_db
       ports:
         - "3306:3306"
       volumes:
         - mysql_data:/var/lib/mysql
   
   volumes:
     mysql_data:
   ```

4. **Deploy with Docker Compose**
   ```bash
   # Build and start services
   docker-compose up -d
   
   # View logs
   docker-compose logs -f
   
   # Stop services
   docker-compose down
   ```

---

## 🔧 Environment Variables Reference

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

---

## 🛠️ Troubleshooting

### Common Issues

1. **Build Failures**
   - Ensure Node.js 18+ is installed
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check TypeScript errors: `npm run type-check`

2. **Database Connection Issues**
   - Verify database credentials
   - Check firewall settings
   - Ensure database server is running

3. **CORS Errors**
   - Update `CORS_ORIGIN` environment variable
   - Check frontend URL matches backend configuration

4. **Permission Errors (Linux)**
   - Ensure proper file permissions: `sudo chown -R $USER:$USER /var/www/adminer-node`
   - Check Nginx configuration syntax: `sudo nginx -t`

### Performance Optimization

1. **Enable Gzip Compression**
   ```nginx
   # Add to Nginx configuration
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
   ```

2. **Setup Caching**
   ```nginx
   # Add to Nginx configuration
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

3. **Database Optimization**
   - Use connection pooling
   - Enable query caching
   - Optimize database indexes

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [PM2 Process Manager](https://pm2.keymetrics.io/)
- [Docker Documentation](https://docs.docker.com/)
- [Let's Encrypt SSL](https://letsencrypt.org/)

## Project Structure

```
adminer-node/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic services
│   │   ├── middleware/     # Express middleware
│   │   └── index.ts        # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React context providers
│   │   ├── services/      # API service layer
│   │   └── theme.ts       # MUI theme configuration
│   ├── package.json
│   └── vite.config.ts
├── shared/                 # Shared TypeScript types
│   └── types.ts
├── package.json           # Root package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/connections/test` - Test database connection
- `POST /api/connections` - Create new connection
- `GET /api/connections` - List all connections
- `PUT /api/connections/:id` - Update connection
- `DELETE /api/connections/:id` - Delete connection

### Database Management
- `GET /api/databases` - List databases
- `GET /api/databases/:name` - Get database info
- `POST /api/databases/:name` - Create database
- `DELETE /api/databases/:name` - Drop database

### Table Management
- `GET /api/tables/:database` - List tables
- `GET /api/tables/:database/:table/structure` - Get table structure

### Data Operations
- `GET /api/data/:database/:table` - Get table data (paginated)
- `GET /api/data/:database/:table/:id` - Get specific row
- `POST /api/data/:database/:table` - Create new row
- `PUT /api/data/:database/:table/:id` - Update row
- `DELETE /api/data/:database/:table/:id` - Delete row

### Query Execution
- `POST /api/query/execute` - Execute SQL query
- `GET /api/query/history` - Get query history
- `GET /api/query/suggestions` - Get autocomplete suggestions

### User Management
- `GET /api/users` - List database users
- `POST /api/users` - Create user
- `POST /api/users/:username/privileges` - Grant privileges
- `DELETE /api/users/:username` - Delete user

### Export/Import
- `POST /api/export/export` - Export data/schema
- `POST /api/export/import` - Import SQL dump

### Server Information
- `GET /api/server/info` - Get server information
- `GET /api/server/stats` - Get database statistics
- `DELETE /api/server/processes/:id` - Kill process

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Input Validation** - All inputs validated and sanitized
- **SQL Injection Protection** - Parameterized queries throughout
- **Rate Limiting** - API protection against abuse
- **CORS Configuration** - Controlled cross-origin requests
- **Helmet Security** - Security headers and protection
- **Password Hashing** - Secure password storage (bcrypt)

## Development

### Available Scripts

```bash
# Install all dependencies
npm run install:all

# Start both frontend and backend in development mode
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Build for production
npm run build

# Start production server
npm start
```

### Code Quality

- **TypeScript** - Full type safety
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting (recommended)
- **Strict Mode** - React strict mode enabled

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Adminer](https://www.adminer.org/) - Database management tool
- Built with modern web technologies and best practices
- Designed for developers and database administrators

## Roadmap

- [ ] SQLite support
- [ ] MS SQL Server support
- [ ] ERD visualization
- [ ] Query performance analysis
- [ ] Database backup/restore
- [ ] Multi-language support
- [ ] Plugin system
- [ ] Cloud database support (AWS RDS, Google Cloud SQL, etc.)

---

**Note**: This is a development version. For production use, ensure proper security configuration and environment setup.
