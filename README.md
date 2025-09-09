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
