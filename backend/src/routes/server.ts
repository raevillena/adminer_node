import { Router, Request, Response } from 'express';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { ServerInfo, Process, ApiResponse } from '../../shared/types';

const router = Router();

/**
 * Get server information and status
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    
    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let serverInfo: ServerInfo;

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // Get server version
      const versionQuery = 'SELECT VERSION() as version';
      const versionResult = await databaseManager.executeQuery(connectionId, versionQuery);
      const version = versionResult[0].version;

      // Get server status variables
      const statusQuery = 'SHOW STATUS';
      const statusResult = await databaseManager.executeQuery(connectionId, statusQuery);
      const variables: Record<string, string> = {};
      statusResult.forEach((row: any) => {
        variables[row.Variable_name] = row.Value;
      });

      // Get uptime
      const uptime = parseInt(variables.Uptime) || 0;

      // Get active processes
      const processesQuery = 'SHOW PROCESSLIST';
      const processesResult = await databaseManager.executeQuery(connectionId, processesQuery);
      const processes: Process[] = processesResult.map((proc: any) => ({
        id: proc.Id,
        user: proc.User,
        host: proc.Host,
        database: proc.db || '',
        command: proc.Command,
        time: proc.Time,
        state: proc.State,
        info: proc.Info,
      }));

      serverInfo = {
        version,
        uptime,
        status: 'online',
        variables,
        processes,
      };
    } else if (config.type === 'postgresql') {
      // Get server version
      const versionQuery = 'SELECT version() as version';
      const versionResult = await databaseManager.executeQuery(connectionId, versionQuery);
      const version = versionResult[0].version;

      // Get server configuration
      const configQuery = `
        SELECT name, setting, unit 
        FROM pg_settings 
        WHERE name IN ('max_connections', 'shared_buffers', 'effective_cache_size', 'work_mem')
        ORDER BY name
      `;
      const configResult = await databaseManager.executeQuery(connectionId, configQuery);
      const variables: Record<string, string> = {};
      configResult.forEach((row: any) => {
        variables[row.name] = `${row.setting}${row.unit || ''}`;
      });

      // Get uptime
      const uptimeQuery = `
        SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime_seconds
      `;
      const uptimeResult = await databaseManager.executeQuery(connectionId, uptimeQuery);
      const uptime = Math.floor(uptimeResult[0].uptime_seconds);

      // Get active processes
      const processesQuery = `
        SELECT 
          pid as id,
          usename as user,
          client_addr::text as host,
          datname as database,
          state as command,
          EXTRACT(EPOCH FROM (now() - query_start)) as time,
          state,
          query as info
        FROM pg_stat_activity 
        WHERE state != 'idle'
        ORDER BY query_start
      `;
      const processesResult = await databaseManager.executeQuery(connectionId, processesQuery);
      const processes: Process[] = processesResult.map((proc: any) => ({
        id: proc.id,
        user: proc.user || 'unknown',
        host: proc.host || 'localhost',
        database: proc.database || '',
        command: proc.command,
        time: Math.floor(proc.time),
        state: proc.state,
        info: proc.info,
      }));

      serverInfo = {
        version,
        uptime,
        status: 'online',
        variables,
        processes,
      };
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      data: serverInfo,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get database statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    
    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let stats: any = {};

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // Get database size
      const sizeQuery = `
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as total_size_mb,
          COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = ?
      `;
      const sizeResult = await databaseManager.executeQuery(connectionId, sizeQuery, [config.database]);
      
      // Get table sizes
      const tableSizesQuery = `
        SELECT 
          table_name,
          ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb,
          table_rows as row_count
        FROM information_schema.tables 
        WHERE table_schema = ?
        ORDER BY (data_length + index_length) DESC
        LIMIT 10
      `;
      const tableSizesResult = await databaseManager.executeQuery(connectionId, tableSizesQuery, [config.database]);

      stats = {
        totalSize: sizeResult[0].total_size_mb,
        tableCount: sizeResult[0].table_count,
        largestTables: tableSizesResult,
      };
    } else if (config.type === 'postgresql') {
      // Get database size
      const sizeQuery = `
        SELECT 
          pg_size_pretty(pg_database_size($1)) as total_size,
          pg_database_size($1) as total_size_bytes
      `;
      const sizeResult = await databaseManager.executeQuery(connectionId, sizeQuery, [config.database]);
      
      // Get table sizes
      const tableSizesQuery = `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `;
      const tableSizesResult = await databaseManager.executeQuery(connectionId, tableSizesQuery);

      stats = {
        totalSize: Math.round(sizeResult[0].total_size_bytes / 1024 / 1024),
        tableCount: tableSizesResult.length,
        largestTables: tableSizesResult.map((table: any) => ({
          table_name: table.tablename,
          size_mb: Math.round(table.size_bytes / 1024 / 1024),
          row_count: null, // Would need additional query
        })),
      };
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Kill a process
 */
router.delete('/processes/:processId', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { processId } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    if (config.type === 'mysql' || config.type === 'mariadb') {
      const killQuery = `KILL ?`;
      await databaseManager.executeQuery(connectionId, killQuery, [processId]);
    } else if (config.type === 'postgresql') {
      const killQuery = `SELECT pg_terminate_backend($1)`;
      await databaseManager.executeQuery(connectionId, killQuery, [processId]);
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      message: `Process ${processId} terminated successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
