import { Router, Request, Response } from 'express';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { Database, ApiResponse } from '../../shared/types';

const router = Router();

/**
 * Get all databases for the current connection
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let databases: Database[] = [];

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // Get databases with size information
      const dbQuery = `
        SELECT 
          SCHEMA_NAME as name,
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
        GROUP BY SCHEMA_NAME
        ORDER BY SCHEMA_NAME
      `;

      const dbRows = await databaseManager.executeQuery(connectionId, dbQuery);
      
      // Get additional database information
      for (const db of dbRows) {
        const collationQuery = `
          SELECT DEFAULT_COLLATION_NAME as collation
          FROM information_schema.SCHEMATA 
          WHERE SCHEMA_NAME = ?
        `;
        
        const collationResult = await databaseManager.executeQuery(connectionId, collationQuery, [db.name]);
        
        // Get table and view counts
        const countsQuery = `
          SELECT 
            COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as tables,
            COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as views
          FROM information_schema.tables 
          WHERE table_schema = ?
        `;
        
        const countsResult = await databaseManager.executeQuery(connectionId, countsQuery, [db.name]);

        databases.push({
          name: db.name,
          size: db.size || 0,
          collation: collationResult[0]?.collation,
          tables: countsResult[0]?.tables || 0,
          views: countsResult[0]?.views || 0,
        });
      }
    } else if (config.type === 'postgresql') {
      // Get databases with size information
      const dbQuery = `
        SELECT 
          datname as name,
          pg_size_pretty(pg_database_size(datname)) as size_pretty,
          pg_database_size(datname) as size_bytes,
          pg_encoding_to_char(encoding) as encoding
        FROM pg_database 
        WHERE datistemplate = false 
        AND datname NOT IN ('postgres', 'template0', 'template1')
        ORDER BY datname
      `;

      const dbRows = await databaseManager.executeQuery(connectionId, dbQuery);
      
      // Get additional information for each database
      for (const db of dbRows) {
        // Get table and view counts
        const countsQuery = `
          SELECT 
            COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as tables,
            COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as views
          FROM information_schema.tables 
          WHERE table_catalog = $1
        `;
        
        const countsResult = await databaseManager.executeQuery(connectionId, countsQuery, [db.name]);

        databases.push({
          name: db.name,
          size: Math.round(db.size_bytes / 1024 / 1024), // Convert to MB
          encoding: db.encoding,
          tables: countsResult[0]?.tables || 0,
          views: countsResult[0]?.views || 0,
        });
      }
    }

    res.json({
      success: true,
      data: databases,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get information about a specific database
 */
router.get('/:databaseName', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let database: Database;

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // Get database information
      const dbQuery = `
        SELECT 
          SCHEMA_NAME as name,
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size,
          DEFAULT_COLLATION_NAME as collation
        FROM information_schema.tables t
        LEFT JOIN information_schema.SCHEMATA s ON t.table_schema = s.SCHEMA_NAME
        WHERE t.table_schema = ?
        GROUP BY SCHEMA_NAME, DEFAULT_COLLATION_NAME
      `;

      const dbResult = await databaseManager.executeQuery(connectionId, dbQuery, [databaseName]);
      
      if (dbResult.length === 0) {
        throw createError('Database not found', 404);
      }

      const db = dbResult[0];

      // Get table and view counts
      const countsQuery = `
        SELECT 
          COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as tables,
          COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as views
        FROM information_schema.tables 
        WHERE table_schema = ?
      `;
      
      const countsResult = await databaseManager.executeQuery(connectionId, countsQuery, [databaseName]);

      database = {
        name: db.name,
        size: db.size || 0,
        collation: db.collation,
        tables: countsResult[0]?.tables || 0,
        views: countsResult[0]?.views || 0,
      };
    } else if (config.type === 'postgresql') {
      // Get database information
      const dbQuery = `
        SELECT 
          datname as name,
          pg_size_pretty(pg_database_size(datname)) as size_pretty,
          pg_database_size(datname) as size_bytes,
          pg_encoding_to_char(encoding) as encoding
        FROM pg_database 
        WHERE datname = $1
      `;

      const dbResult = await databaseManager.executeQuery(connectionId, dbQuery, [databaseName]);
      
      if (dbResult.length === 0) {
        throw createError('Database not found', 404);
      }

      const db = dbResult[0];

      // Get table and view counts
      const countsQuery = `
        SELECT 
          COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as tables,
          COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as views
        FROM information_schema.tables 
        WHERE table_catalog = $1
      `;
      
      const countsResult = await databaseManager.executeQuery(connectionId, countsQuery, [databaseName]);

      database = {
        name: db.name,
        size: Math.round(db.size_bytes / 1024 / 1024), // Convert to MB
        encoding: db.encoding,
        tables: countsResult[0]?.tables || 0,
        views: countsResult[0]?.views || 0,
      };
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      data: database,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Create a new database
 */
router.post('/:databaseName', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName } = req.params;
    const { charset, collation } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    if (config.type === 'mysql' || config.type === 'mariadb') {
      let createQuery = `CREATE DATABASE \`${databaseName}\``;
      
      if (charset) {
        createQuery += ` CHARACTER SET ${charset}`;
      }
      
      if (collation) {
        createQuery += ` COLLATE ${collation}`;
      }

      await databaseManager.executeQuery(connectionId, createQuery);
    } else if (config.type === 'postgresql') {
      const createQuery = `CREATE DATABASE "${databaseName}"`;
      await databaseManager.executeQuery(connectionId, createQuery);
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      message: `Database '${databaseName}' created successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Drop a database
 */
router.delete('/:databaseName', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    if (config.type === 'mysql' || config.type === 'mariadb') {
      await databaseManager.executeQuery(connectionId, `DROP DATABASE \`${databaseName}\``);
    } else if (config.type === 'postgresql') {
      await databaseManager.executeQuery(connectionId, `DROP DATABASE "${databaseName}"`);
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      message: `Database '${databaseName}' dropped successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
