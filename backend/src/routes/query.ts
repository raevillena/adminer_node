import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { QueryResult, ApiResponse } from '../../shared/types';

const router = Router();

// In-memory storage for query history (in production, use a database)
const queryHistory: Map<string, any[]> = new Map();

/**
 * Execute a SQL query
 */
router.post('/execute', [
  body('query').notEmpty().withMessage('Query is required'),
  body('params').optional().isArray().withMessage('Params must be an array'),
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
    const { query, params = [] } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    // Security check - prevent dangerous operations
    const dangerousKeywords = [
      'DROP DATABASE',
      'DROP SCHEMA',
      'TRUNCATE',
      'DELETE FROM',
      'UPDATE',
      'INSERT INTO',
      'CREATE TABLE',
      'ALTER TABLE',
      'DROP TABLE',
    ];

    const upperQuery = query.toUpperCase().trim();
    const isDangerous = dangerousKeywords.some(keyword => upperQuery.includes(keyword));

    if (isDangerous) {
      // For dangerous operations, require explicit confirmation
      if (!req.body.confirmDangerous) {
        return res.status(400).json({
          success: false,
          message: 'This operation requires confirmation. Please add confirmDangerous: true to your request.',
          requiresConfirmation: true,
        });
      }
    }

    const startTime = Date.now();
    let result: QueryResult;

    try {
      const rows = await databaseManager.executeQuery(connectionId, query, params);
      const executionTime = Date.now() - startTime;

      // Determine if this is a SELECT query
      const isSelectQuery = upperQuery.startsWith('SELECT') || upperQuery.startsWith('SHOW') || upperQuery.startsWith('DESCRIBE') || upperQuery.startsWith('EXPLAIN');

      if (isSelectQuery) {
        // For SELECT queries, return the data
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        result = {
          columns,
          rows,
          executionTime,
        };
      } else {
        // For other queries, return affected rows info
        result = {
          columns: [],
          rows: [],
          executionTime,
          affectedRows: (rows as any).affectedRows || (rows as any).rowCount || 0,
          insertId: (rows as any).insertId,
          message: 'Query executed successfully',
        };
      }

      // Store in query history
      if (!queryHistory.has(connectionId)) {
        queryHistory.set(connectionId, []);
      }

      const historyEntry = {
        id: Date.now().toString(),
        query,
        params,
        executionTime,
        executedAt: new Date(),
        success: true,
        result: {
          rowCount: result.rows.length,
          affectedRows: result.affectedRows,
        },
      };

      queryHistory.get(connectionId)!.unshift(historyEntry);
      
      // Keep only last 100 queries per connection
      const history = queryHistory.get(connectionId)!;
      if (history.length > 100) {
        history.splice(100);
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Store failed query in history
      if (!queryHistory.has(connectionId)) {
        queryHistory.set(connectionId, []);
      }

      const historyEntry = {
        id: Date.now().toString(),
        query,
        params,
        executionTime,
        executedAt: new Date(),
        success: false,
        error: error.message,
      };

      queryHistory.get(connectionId)!.unshift(historyEntry);

      throw error;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get query history for the current connection
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    
    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const history = queryHistory.get(connectionId) || [];

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Clear query history for the current connection
 */
router.delete('/history', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    
    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    queryHistory.set(connectionId, []);

    res.json({
      success: true,
      message: 'Query history cleared',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get query suggestions/autocomplete
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName } = req.query;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    const suggestions = {
      keywords: [
        'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT',
        'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE',
        'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
        'UNION', 'UNION ALL', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
        'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'ASC', 'DESC'
      ],
      tables: [] as string[],
      columns: [] as string[],
      functions: [] as string[],
    };

    if (databaseName) {
      try {
        // Get tables
        const tablesQuery = config.type === 'mysql'
          ? `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`
          : `SELECT table_name FROM information_schema.tables WHERE table_catalog = $1 ORDER BY table_name`;
        
        const tables = await databaseManager.executeQuery(connectionId, tablesQuery, [databaseName]);
        suggestions.tables = tables.map((table: any) => table.table_name);

        // Get columns for the first few tables
        if (suggestions.tables.length > 0) {
          const tableNames = suggestions.tables.slice(0, 5); // Limit to first 5 tables
          const columnsQuery = config.type === 'mysql'
            ? `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = ? AND table_name IN (${tableNames.map(() => '?').join(',')}) ORDER BY table_name, ordinal_position`
            : `SELECT table_name, column_name FROM information_schema.columns WHERE table_catalog = $1 AND table_name = ANY($2) ORDER BY table_name, ordinal_position`;
          
          const columns = await databaseManager.executeQuery(connectionId, columnsQuery, 
            config.type === 'mysql' ? [databaseName, ...tableNames] : [databaseName, tableNames]);
          
          suggestions.columns = columns.map((col: any) => `${col.table_name}.${col.column_name}`);
        }

        // Get functions
        if (config.type === 'mysql' || config.type === 'mariadb') {
          suggestions.functions = [
            'NOW()', 'CURDATE()', 'CURTIME()', 'DATE()', 'TIME()', 'YEAR()', 'MONTH()', 'DAY()',
            'CONCAT()', 'SUBSTRING()', 'LENGTH()', 'UPPER()', 'LOWER()', 'TRIM()',
            'ROUND()', 'FLOOR()', 'CEIL()', 'ABS()', 'RAND()',
            'IFNULL()', 'COALESCE()', 'CASE', 'IF()'
          ];
        } else if (config.type === 'postgresql') {
          suggestions.functions = [
            'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
            'CONCAT()', 'SUBSTRING()', 'LENGTH()', 'UPPER()', 'LOWER()', 'TRIM()',
            'ROUND()', 'FLOOR()', 'CEIL()', 'ABS()', 'RANDOM()',
            'COALESCE()', 'CASE', 'NULLIF()'
          ];
        }
      } catch (error) {
        // If we can't get suggestions, just return keywords
        console.warn('Could not fetch query suggestions:', error);
      }
    }

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
