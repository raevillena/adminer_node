import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  DatabaseConnection, 
  ConnectionTest, 
  Database, 
  Table, 
  TableData, 
  QueryResult, 
  DatabaseUser, 
  ServerInfo,
  ApiResponse,
  PaginatedResponse 
} from '../../shared/types';

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
  },

  // Query execution
  query: {
    execute: async (query: string, params: any[] = [], confirmDangerous = false): Promise<QueryResult> => {
      const response = await api.post('/query/execute', { query, params, confirmDangerous });
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

    create: async (user: { name: string; password: string; host?: string }): Promise<void> => {
      await api.post('/users', user);
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
      format: 'sql' | 'csv' | 'json';
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
