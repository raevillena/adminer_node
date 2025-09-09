import mysql from 'mysql2/promise';
import { Pool, PoolClient } from 'pg';
import { DatabaseConnection, ConnectionTest, DatabaseError } from '../../shared/types';

// Connection pool management
class DatabaseManager {
  private connections: Map<string, mysql.Pool | Pool> = new Map();
  private connectionConfigs: Map<string, DatabaseConnection> = new Map();

  /**
   * Test a database connection without storing it
   */
  async testConnection(config: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConnectionTest> {
    try {
      if (config.type === 'mysql' || config.type === 'mariadb') {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
        });

        // Get server version
        const [versionRows] = await connection.execute('SELECT VERSION() as version');
        const version = (versionRows as any[])[0]?.version || 'Unknown';

        // Get available databases
        const [dbRows] = await connection.execute('SHOW DATABASES');
        const databases = (dbRows as any[]).map((row: any) => Object.values(row)[0] as string);

        await connection.end();

        return {
          success: true,
          version,
          databases,
        };
      } else if (config.type === 'postgresql') {
        const client = new Pool({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
        });

        const result = await client.query('SELECT version() as version');
        const version = result.rows[0]?.version || 'Unknown';

        // Get available databases
        const dbResult = await client.query(`
          SELECT datname FROM pg_database 
          WHERE datistemplate = false 
          AND datname != 'postgres'
        `);
        const databases = dbResult.rows.map(row => row.datname);

        await client.end();

        return {
          success: true,
          version,
          databases,
        };
      }

      throw new Error('Unsupported database type');
    } catch (error: any) {
      return {
        success: false,
        message: this.formatDatabaseError(error),
      };
    }
  }

  /**
   * Create and store a database connection
   */
  async createConnection(config: DatabaseConnection): Promise<void> {
    try {
      if (config.type === 'mysql' || config.type === 'mariadb') {
        const pool = mysql.createPool({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        });

        this.connections.set(config.id, pool);
        this.connectionConfigs.set(config.id, config);
      } else if (config.type === 'postgresql') {
        const pool = new Pool({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        this.connections.set(config.id, pool);
        this.connectionConfigs.set(config.id, config);
      } else {
        throw new Error('Unsupported database type');
      }
    } catch (error: any) {
      throw new Error(`Failed to create connection: ${this.formatDatabaseError(error)}`);
    }
  }

  /**
   * Get a connection by ID
   */
  getConnection(connectionId: string): mysql.Pool | Pool | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * Get connection configuration by ID
   */
  getConnectionConfig(connectionId: string): DatabaseConnection | null {
    return this.connectionConfigs.get(connectionId) || null;
  }

  /**
   * Execute a query on a specific connection
   */
  async executeQuery(connectionId: string, query: string, params: any[] = []): Promise<any> {
    const connection = this.getConnection(connectionId);
    const config = this.getConnectionConfig(connectionId);

    if (!connection || !config) {
      throw new Error('Connection not found');
    }

    try {
      if (config.type === 'mysql' || config.type === 'mariadb') {
        const mysqlPool = connection as mysql.Pool;
        const [rows] = await mysqlPool.execute(query, params);
        return rows;
      } else if (config.type === 'postgresql') {
        const pgPool = connection as Pool;
        const result = await pgPool.query(query, params);
        return result.rows;
      }

      throw new Error('Unsupported database type');
    } catch (error: any) {
      throw new Error(this.formatDatabaseError(error));
    }
  }

  /**
   * Get a client for transaction support
   */
  async getClient(connectionId: string): Promise<mysql.PoolConnection | PoolClient> {
    const connection = this.getConnection(connectionId);
    const config = this.getConnectionConfig(connectionId);

    if (!connection || !config) {
      throw new Error('Connection not found');
    }

    if (config.type === 'mysql' || config.type === 'mariadb') {
      const mysqlPool = connection as mysql.Pool;
      return await mysqlPool.getConnection();
    } else if (config.type === 'postgresql') {
      const pgPool = connection as Pool;
      return await pgPool.connect();
    }

    throw new Error('Unsupported database type');
  }

  /**
   * Close a specific connection
   */
  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (connection instanceof Pool) {
        // PostgreSQL
        await connection.end();
      } else {
        // MySQL
        await (connection as mysql.Pool).end();
      }
      this.connections.delete(connectionId);
      this.connectionConfigs.delete(connectionId);
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.entries()).map(async ([id, connection]) => {
      try {
        if (connection instanceof Pool) {
          // PostgreSQL
          await connection.end();
        } else {
          // MySQL
          await (connection as mysql.Pool).end();
        }
      } catch (error) {
        console.error(`Error closing connection ${id}:`, error);
      }
    });

    await Promise.all(closePromises);
    this.connections.clear();
    this.connectionConfigs.clear();
  }

  /**
   * Format database errors into user-friendly messages
   */
  private formatDatabaseError(error: any): string {
    if (error.code) {
      switch (error.code) {
        case 'ECONNREFUSED':
          return 'Connection refused. Please check if the database server is running.';
        case 'ER_ACCESS_DENIED_ERROR':
          return 'Access denied. Please check your username and password.';
        case 'ER_BAD_DB_ERROR':
          return 'Database does not exist.';
        case 'ER_PARSE_ERROR':
          return 'SQL syntax error.';
        case 'ER_DUP_ENTRY':
          return 'Duplicate entry.';
        case 'ER_ROW_IS_REFERENCED':
          return 'Cannot delete or update: foreign key constraint fails.';
        case 'ENOTFOUND':
          return 'Host not found. Please check the hostname.';
        case 'ETIMEDOUT':
          return 'Connection timeout. Please check your network connection.';
        default:
          return error.message || 'Database error occurred.';
      }
    }

    return error.message || 'Unknown database error occurred.';
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(connectionId: string): Promise<boolean> {
    try {
      const connection = this.getConnection(connectionId);
      if (!connection) return false;

      const config = this.getConnectionConfig(connectionId);
      if (!config) return false;

    if (config.type === 'mysql' || config.type === 'mariadb') {
      const mysqlPool = connection as mysql.Pool;
      await mysqlPool.execute('SELECT 1');
      return true;
    } else if (config.type === 'postgresql') {
        const pgPool = connection as Pool;
        await pgPool.query('SELECT 1');
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();
