// Database Connection Types
export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'mariadb' | 'postgresql';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  ssl?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionTest {
  success: boolean;
  message: string;
  version?: string;
  uptime?: number;
}

// Database Types
export interface Database {
  name: string;
  size?: number;
  collation?: string;
  encoding?: string;
  tables: number;
  views: number;
}

// Table Types
export interface Table {
  name: string;
  type: 'table' | 'view';
  engine?: string;
  collation?: string;
  rows?: number;
  size?: number;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Column {
  name: string;
  type: string;
  null: boolean;
  key: string;
  default: any;
  extra: string;
  comment?: string;
}

export interface Index {
  name: string;
  type: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
}

export interface ForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: string;
  onDelete: string;
}

export interface Trigger {
  name: string;
  event: string;
  timing: string;
  statement: string;
}

export interface Constraint {
  name: string;
  type: string;
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

// Data Types
export interface TableData {
  columns: Column[];
  rows: any[];
  totalRows: number;
  page: number;
  limit: number;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  affectedRows?: number;
  insertId?: any;
  executionTime?: number;
}

// User Types
export interface DatabaseUser {
  name: string;
  host: string;
  privileges: UserPrivilege[];
  maxConnections?: number;
  maxUserConnections?: number;
  maxQuestions?: number;
  maxUpdates?: number;
  passwordExpired?: boolean;
  accountLocked?: boolean;
}

export interface UserPrivilege {
  database: string;
  table: string;
  privileges: string[];
}

// Server Types
export interface ServerInfo {
  version: string;
  uptime: number;
  status: string;
  processes: Process[];
}

export interface Process {
  id: number;
  user: string;
  host: string;
  database: string;
  command: string;
  time: number;
  state: string;
  info?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface DatabaseError {
  code: string;
  message: string;
  sqlState?: string;
}

// Export Types
export interface ExportOptions {
  format: 'sql' | 'csv' | 'json' | 'xml' | 'tsv';
  tables: string[];
  data: boolean;
  structure: boolean;
  drop: boolean;
  charset?: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedRows?: number;
  errors?: string[];
}