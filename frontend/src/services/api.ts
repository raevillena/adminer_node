import axios, { AxiosInstance, AxiosResponse } from 'axios';
// Types are defined inline to avoid import issues
interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'mariadb' | 'postgresql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionTest {
  success: boolean;
  message: string;
  version?: string;
}

interface Database {
  name: string;
  size: number;
  encoding?: string;
  collation?: string;
  tables?: number;
  views?: number;
}

interface Table {
  name: string;
  type: 'table' | 'view';
  engine?: string;
  collation?: string;
  rows?: number;
  size?: number;
  comment?: string;
}

interface TableData {
  columns: string[];
  rows: any[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface QueryResult {
  columns: string[];
  rows: any[];
  executionTime: number;
  insertId?: number;
  message?: string;
}

interface DatabaseUser {
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

interface ServerInfo {
  version: string;
  uptime: number;
  connections: number;
  maxConnections: number;
  queriesPerSecond: number;
  bytesReceived: number;
  bytesSent: number;
}

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API service functions
export const apiService = {
  // Connection management
  connections: {
    test: async (config: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConnectionTest> => {
      const response = await api.post('/connections/test', config);
      return response.data.data;
    },

    create: async (config: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ connection: DatabaseConnection; token: string }> => {
      const response = await api.post('/connections', config);
      return response.data.data;
    },

    getAll: async (): Promise<DatabaseConnection[]> => {
      const response = await api.get('/connections');
      return response.data.data;
    },

    getById: async (id: string): Promise<DatabaseConnection> => {
      const response = await api.get(`/connections/${id}`);
      return response.data.data;
    },

    update: async (id: string, updates: Partial<DatabaseConnection>): Promise<DatabaseConnection> => {
      const response = await api.put(`/connections/${id}`, updates);
      return response.data.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`/connections/${id}`);
    },

    getStatus: async (id: string): Promise<{ connected: boolean; lastChecked: string }> => {
      const response = await api.get(`/connections/${id}/status`);
      return response.data.data;
    },

    getToken: async (id: string): Promise<{ token: string }> => {
      const response = await api.post(`/connections/${id}/token`);
      return response.data.data;
    },
  },

  // Database management
  databases: {
    getAll: async (): Promise<Database[]> => {
      const response = await api.get('/databases');
      return response.data.data;
    },

    getByName: async (name: string): Promise<Database> => {
      const response = await api.get(`/databases/${name}`);
      return response.data.data;
    },

    create: async (name: string, options?: { charset?: string; collation?: string }): Promise<void> => {
      await api.post(`/databases/${name}`, options);
    },

    delete: async (name: string): Promise<void> => {
      await api.delete(`/databases/${name}`);
    },

    rename: async (name: string, newName: string): Promise<void> => {
      await api.put(`/databases/${name}/rename`, { newName });
    },

    switch: async (databaseName: string): Promise<void> => {
      await api.post(`/databases/${databaseName}/switch`);
    },
  },

  // Table management
  tables: {
    getAll: async (databaseName: string): Promise<Table[]> => {
      const response = await api.get(`/tables/${databaseName}`);
      return response.data.data;
    },

    getStructure: async (databaseName: string, tableName: string): Promise<{
      columns: any[];
      indexes: any[];
      foreignKeys: any[];
      triggers: any[];
      constraints: any[];
    }> => {
      const response = await api.get(`/tables/${databaseName}/${tableName}/structure`);
      return response.data.data;
    },

    create: async (databaseName: string, tableData: {
      name: string;
      columns: any[];
      engine?: string;
      charset?: string;
      collation?: string;
    }): Promise<void> => {
      await api.post(`/tables/${databaseName}`, tableData);
    },

    drop: async (databaseName: string, tableName: string): Promise<void> => {
      await api.delete(`/tables/${databaseName}/${tableName}`);
    },

    rename: async (databaseName: string, tableName: string, newName: string): Promise<void> => {
      await api.put(`/tables/${databaseName}/${tableName}/rename`, { newName });
    },

    // Column management
    addColumn: async (databaseName: string, tableName: string, columnData: {
      name: string;
      type: string;
      nullable?: boolean;
      defaultValue?: string;
      autoIncrement?: boolean;
      comment?: string;
      after?: string;
    }): Promise<void> => {
      await api.post(`/tables/${databaseName}/${tableName}/columns`, columnData);
    },

    modifyColumn: async (databaseName: string, tableName: string, columnName: string, columnData: {
      type?: string;
      nullable?: boolean;
      defaultValue?: string;
      autoIncrement?: boolean;
      comment?: string;
      newName?: string;
    }): Promise<void> => {
      await api.put(`/tables/${databaseName}/${tableName}/columns/${columnName}`, columnData);
    },

    dropColumn: async (databaseName: string, tableName: string, columnName: string): Promise<void> => {
      await api.delete(`/tables/${databaseName}/${tableName}/columns/${columnName}`);
    },

    // Index management
    createIndex: async (databaseName: string, tableName: string, indexData: {
      name: string;
      columns: string[];
      type?: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL';
      comment?: string;
    }): Promise<void> => {
      await api.post(`/tables/${databaseName}/${tableName}/indexes`, indexData);
    },

    dropIndex: async (databaseName: string, tableName: string, indexName: string): Promise<void> => {
      await api.delete(`/tables/${databaseName}/${tableName}/indexes/${indexName}`);
    },
  },

  // Data management
  data: {
    getTableData: async (
      databaseName: string, 
      tableName: string, 
      options?: {
        page?: number;
        pageSize?: number;
        search?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }
    ): Promise<TableData> => {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
      if (options?.search) params.append('search', options.search);
      if (options?.sortBy) params.append('sortBy', options.sortBy);
      if (options?.sortOrder) params.append('sortOrder', options.sortOrder);

      const response = await api.get(`/data/${databaseName}/${tableName}?${params.toString()}`);
      return response.data.data;
    },

    getRow: async (databaseName: string, tableName: string, id: string): Promise<any> => {
      const response = await api.get(`/data/${databaseName}/${tableName}/${id}`);
      return response.data.data;
    },

    createRow: async (databaseName: string, tableName: string, data: Record<string, any>): Promise<{ insertId: any; affectedRows: number }> => {
      const response = await api.post(`/data/${databaseName}/${tableName}`, data);
      return response.data.data;
    },

    updateRow: async (databaseName: string, tableName: string, id: string, data: Record<string, any>): Promise<{ affectedRows: number }> => {
      const response = await api.put(`/data/${databaseName}/${tableName}/${id}`, data);
      return response.data.data;
    },

    deleteRow: async (databaseName: string, tableName: string, id: string): Promise<{ affectedRows: number }> => {
      const response = await api.delete(`/data/${databaseName}/${tableName}/${id}`);
      return response.data.data;
    },

    // Bulk operations
    bulkInsert: async (databaseName: string, tableName: string, data: any[], columns?: string[]): Promise<{ affectedRows: number; insertId: any }> => {
      const response = await api.post(`/data/${databaseName}/${tableName}/bulk`, { data, columns });
      return response.data.data;
    },

    bulkUpdate: async (databaseName: string, tableName: string, data: any[], whereColumn: string): Promise<{ affectedRows: number }> => {
      const response = await api.put(`/data/${databaseName}/${tableName}/bulk`, { data, whereColumn });
      return response.data.data;
    },

    bulkDelete: async (databaseName: string, tableName: string, whereColumn: string, values: any[]): Promise<{ affectedRows: number }> => {
      const response = await api.delete(`/data/${databaseName}/${tableName}/bulk`, { data: { whereColumn, values } });
      return response.data.data;
    },
  },

  // Query execution
  query: {
    execute: async (query: string, params: any[] = [], confirmDangerous = false): Promise<QueryResult> => {
      const response = await api.post('/query/execute', { query, params, confirmDangerous });
      return response.data.data;
    },

    explain: async (query: string, params: any[] = []): Promise<QueryResult> => {
      const response = await api.post('/query/explain', { query, params });
      return response.data.data;
    },

    getHistory: async (): Promise<any[]> => {
      const response = await api.get('/query/history');
      return response.data.data;
    },

    clearHistory: async (): Promise<void> => {
      await api.delete('/query/history');
    },

    getSuggestions: async (databaseName?: string): Promise<{
      keywords: string[];
      tables: string[];
      columns: string[];
      functions: string[];
    }> => {
      const params = databaseName ? `?databaseName=${databaseName}` : '';
      const response = await api.get(`/query/suggestions${params}`);
      return response.data.data;
    },
  },

  // User management
  users: {
    getAll: async (): Promise<DatabaseUser[]> => {
      const response = await api.get('/users');
      return response.data.data;
    },

    create: async (name: string, password: string, host: string = 'localhost'): Promise<void> => {
      await api.post('/users', { name, password, host });
    },

    grantPrivileges: async (username: string, privileges: string[], database?: string, table?: string): Promise<void> => {
      await api.post(`/users/${username}/privileges`, { privileges, database, table });
    },

    delete: async (username: string): Promise<void> => {
      await api.delete(`/users/${username}`);
    },
  },

  // Export/Import
  export: {
    exportData: async (options: {
      format: 'sql' | 'csv' | 'json' | 'xml' | 'tsv';
      tables?: string[];
      dataOnly?: boolean;
      schemaOnly?: boolean;
    }): Promise<Blob> => {
      const response = await api.post('/export/export', options, {
        responseType: 'blob',
      });
      return response.data;
    },

    importData: async (sql: string): Promise<{ success: boolean; message: string; importedRows: number; errors?: string[] }> => {
      const response = await api.post('/export/import', { sql });
      return response.data.data;
    },

    importCsv: async (tableName: string, data: any[], columns?: string[], delimiter?: string): Promise<{ success: boolean; message: string; importedRows: number; insertId?: any }> => {
      const response = await api.post('/export/import-csv', { tableName, data, columns, delimiter });
      return response.data.data;
    },
  },

  // Server information
  server: {
    getInfo: async (): Promise<ServerInfo> => {
      const response = await api.get('/server/info');
      return response.data.data;
    },

    getStats: async (): Promise<any> => {
      const response = await api.get('/server/stats');
      return response.data.data;
    },

    killProcess: async (processId: string): Promise<void> => {
      await api.delete(`/server/processes/${processId}`);
    },
  },
};

export default api;
