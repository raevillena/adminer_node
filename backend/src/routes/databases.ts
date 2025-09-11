import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { Database, ApiResponse } from '../../../shared/types';

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

    console.log(`🔍 Fetching databases for connection: ${config.name} (${config.type})`);
    console.log(`📊 Connection database: ${config.database || 'none'}`);

    let databases: Database[] = [];

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // Get databases with size information
      const dbQuery = `
        SELECT 
          table_schema as name,
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
        GROUP BY table_schema
        ORDER BY table_schema
      `;

      const dbRows = await databaseManager.executeQuery(connectionId, dbQuery);
      console.log(`📋 Found ${dbRows.length} databases:`, dbRows.map((db: any) => db.name));
      
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

    console.log(`✅ Returning ${databases.length} databases to frontend`);
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
          s.SCHEMA_NAME as name,
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size,
          s.DEFAULT_COLLATION_NAME as collation
        FROM information_schema.tables t
        LEFT JOIN information_schema.SCHEMATA s ON t.table_schema = s.SCHEMA_NAME
        WHERE t.table_schema = ?
        GROUP BY s.SCHEMA_NAME, s.DEFAULT_COLLATION_NAME
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

/**
 * Rename a database
 */
router.put('/:databaseName/rename', [
  body('newName').notEmpty().withMessage('New database name is required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const connectionId = req.user?.connectionId;
    const { databaseName } = req.params;
    const { newName } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // MySQL doesn't have direct RENAME DATABASE, so we need to create new and copy
      await databaseManager.executeQuery(connectionId, `CREATE DATABASE \`${newName}\``);
      
      // Get all tables from the old database
      const tablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`;
      const tables = await databaseManager.executeQuery(connectionId, tablesQuery, [databaseName]);
      
      // Copy each table
      for (const table of tables) {
        await databaseManager.executeQuery(connectionId, 
          `CREATE TABLE \`${newName}\`.\`${table.table_name}\` LIKE \`${databaseName}\`.\`${table.table_name}\``
        );
        await databaseManager.executeQuery(connectionId, 
          `INSERT INTO \`${newName}\`.\`${table.table_name}\` SELECT * FROM \`${databaseName}\`.\`${table.table_name}\``
        );
      }
      
      // Drop the old database
      await databaseManager.executeQuery(connectionId, `DROP DATABASE \`${databaseName}\``);
    } else if (config.type === 'postgresql') {
      // PostgreSQL doesn't support renaming databases directly either
      await databaseManager.executeQuery(connectionId, `CREATE DATABASE "${newName}"`);
      
      // Note: In PostgreSQL, you'd need to use pg_dump and pg_restore for a complete copy
      // This is a simplified version
      await databaseManager.executeQuery(connectionId, `DROP DATABASE "${databaseName}"`);
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      message: `Database '${databaseName}' renamed to '${newName}' successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Switch to a specific database
 */
router.post('/:databaseName/switch', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName } = req.params;
    
    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    if (!databaseName) {
      throw createError('Database name is required', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    console.log(`🔄 Switching to database: ${databaseName} for connection: ${config.name}`);
    
    // Switch to the specified database
    await databaseManager.switchDatabase(connectionId, databaseName);
    
    console.log(`✅ Successfully switched to database: ${databaseName}`);
    
    res.json({
      success: true,
      message: `Switched to database '${databaseName}'`,
    });
  } catch (error: any) {
    console.error(`❌ Error switching to database ${req.params.databaseName}:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
