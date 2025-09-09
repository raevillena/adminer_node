// Database connection types
export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'mariadb' | 'postgresql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionTest {
  success: boolean;
  message?: string;
  version?: string;
  databases?: string[];
}

// Database metadata types
export interface Database {
  name: string;
  size?: number;
  encoding?: string;
  collation?: string;
  tables?: number;
  views?: number;
}

export interface Table {
  name: string;
  type: 'table' | 'view';
  engine?: string;
  collation?: string;
  rows?: number;
  size?: number;
  comment?: string;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  autoIncrement: boolean;
  primaryKey: boolean;
  comment?: string;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface Index {
  name: string;
  type: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL';
  columns: string[];
  unique: boolean;
  comment?: string;
}

export interface ForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface Trigger {
  name: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  timing: 'BEFORE' | 'AFTER';
  statement: string;
  definer?: string;
}

export interface Constraint {
  name: string;
  type: 'PRIMARY KEY' | 'UNIQUE' | 'FOREIGN KEY' | 'CHECK';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

// Data management types
export interface TableData {
  columns: string[];
  rows: Record<string, any>[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  executionTime: number;
  affectedRows?: number;
  insertId?: number;
  message?: string;
}

// User management types
export interface DatabaseUser {
  name: string;
  host: string;
  privileges: string[];
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

// Export/Import types
export interface ExportOptions {
  format: 'sql' | 'csv' | 'json';
  tables?: string[];
  dataOnly?: boolean;
  schemaOnly?: boolean;
  dropTables?: boolean;
  createTables?: boolean;
  insertData?: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedRows?: number;
  errors?: string[];
}

// Server info types
export interface ServerInfo {
  version: string;
  uptime: number;
  status: 'online' | 'offline';
  variables: Record<string, string>;
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

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Query history types
export interface QueryHistory {
  id: string;
  connectionId: string;
  query: string;
  executionTime: number;
  executedAt: Date;
  success: boolean;
  error?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  connectionId: string;
  createdAt: Date;
  updatedAt: Date;
}

// UI State types
export interface AppState {
  currentConnection: DatabaseConnection | null;
  currentDatabase: string | null;
  currentTable: string | null;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  queryTabs: QueryTab[];
  activeQueryTab: string | null;
}

export interface QueryTab {
  id: string;
  name: string;
  query: string;
  result?: QueryResult;
  isDirty: boolean;
}

// Error types
export interface DatabaseError {
  code: string;
  message: string;
  sqlState?: string;
  errno?: number;
}
