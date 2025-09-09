import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { TableData, QueryResult, ApiResponse, PaginatedResponse } from '../../shared/types';

const router = Router();

/**
 * Get table data with pagination
 */
router.get('/:databaseName/:tableName', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('pageSize').optional().isInt({ min: 1, max: 1000 }).withMessage('Page size must be between 1 and 1000'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('sortBy').optional().isString().withMessage('Sort by must be a string'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
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
    const { databaseName, tableName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = req.query.search as string;
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as string) || 'asc';

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    const offset = (page - 1) * pageSize;
    let whereClause = '';
    let orderClause = '';
    let params: any[] = [];

    // Build WHERE clause for search
    if (search) {
      // Get all columns to search in
    const columnsQuery = ((config.type === 'mysql' || config.type === 'mariadb') || config.type === 'mariadb')
      ? `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`
      : `SELECT column_name FROM information_schema.columns WHERE table_catalog = $1 AND table_name = $2`;
      
      const columns = await databaseManager.executeQuery(connectionId, columnsQuery, [databaseName, tableName]);
      const searchableColumns = columns.map((col: any) => col.column_name);
      
      if (searchableColumns.length > 0) {
        const searchConditions = searchableColumns.map((col: string, index: number) => {
          const paramIndex = (config.type === 'mysql' || config.type === 'mariadb') ? '?' : `$${params.length + 3 + index}`;
          return `${col}::text ILIKE ${paramIndex}`;
        });
        
        whereClause = `WHERE ${searchConditions.join(' OR ')}`;
        params.push(...searchableColumns.map(() => `%${search}%`));
      }
    }

    // Build ORDER BY clause
    if (sortBy) {
      orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
    }

    // Get total count
    const countQuery = ((config.type === 'mysql' || config.type === 'mariadb') || config.type === 'mariadb')
      ? `SELECT COUNT(*) as total FROM \`${databaseName}\`.\`${tableName}\` ${whereClause}`
      : `SELECT COUNT(*) as total FROM "${databaseName}"."${tableName}" ${whereClause}`;
    
    const countResult = await databaseManager.executeQuery(connectionId, countQuery, params);
    const totalRows = countResult[0].total;
    const totalPages = Math.ceil(totalRows / pageSize);

    // Get data with pagination
    const dataQuery = ((config.type === 'mysql' || config.type === 'mariadb') || config.type === 'mariadb')
      ? `SELECT * FROM \`${databaseName}\`.\`${tableName}\` ${whereClause} ${orderClause} LIMIT ? OFFSET ?`
      : `SELECT * FROM "${databaseName}"."${tableName}" ${whereClause} ${orderClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const dataParams = [...params, pageSize, offset];
    const rows = await databaseManager.executeQuery(connectionId, dataQuery, dataParams);

    // Get column information
    const columnsQuery = ((config.type === 'mysql' || config.type === 'mariadb') || config.type === 'mariadb')
      ? `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`
      : `SELECT column_name FROM information_schema.columns WHERE table_catalog = $1 AND table_name = $2 ORDER BY ordinal_position`;
    
    const columns = await databaseManager.executeQuery(connectionId, columnsQuery, [databaseName, tableName]);
    const columnNames = columns.map((col: any) => col.column_name);

    const tableData: TableData = {
      columns: columnNames,
      rows,
      totalRows,
      page,
      pageSize,
      totalPages,
    };

    res.json({
      success: true,
      data: tableData,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get a specific row by primary key
 */
router.get('/:databaseName/:tableName/:id', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName, tableName, id } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    // Get primary key columns
    const pkQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_key = 'PRI' ORDER BY ordinal_position`
      : `SELECT column_name FROM information_schema.columns WHERE table_catalog = $1 AND table_name = $2 AND is_nullable = 'NO' ORDER BY ordinal_position LIMIT 1`;
    
    const pkColumns = await databaseManager.executeQuery(connectionId, pkQuery, [databaseName, tableName]);
    
    if (pkColumns.length === 0) {
      throw createError('No primary key found for this table', 400);
    }

    // For simplicity, assume single primary key and use the first column
    const pkColumn = pkColumns[0].column_name;
    
    const selectQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `SELECT * FROM \`${databaseName}\`.\`${tableName}\` WHERE \`${pkColumn}\` = ? LIMIT 1`
      : `SELECT * FROM "${databaseName}"."${tableName}" WHERE "${pkColumn}" = $1 LIMIT 1`;
    
    const rows = await databaseManager.executeQuery(connectionId, selectQuery, [id]);
    
    if (rows.length === 0) {
      throw createError('Row not found', 404);
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Create a new row
 */
router.post('/:databaseName/:tableName', [
  body().isObject().withMessage('Request body must be an object'),
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
    const { databaseName, tableName } = req.params;
    const data = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    // Get column information
    const columnsQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`
      : `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_catalog = $1 AND table_name = $2`;
    
    const columns = await databaseManager.executeQuery(connectionId, columnsQuery, [databaseName, tableName]);
    
    // Filter out auto-increment columns and columns with default values that are not provided
    const insertableColumns = columns.filter((col: any) => {
      const hasValue = data.hasOwnProperty(col.column_name);
      const hasDefault = col.column_default !== null;
      const isNullable = col.is_nullable === 'YES';
      
      return hasValue || (!hasDefault && !isNullable);
    });

    const columnNames = insertableColumns.map((col: any) => col.column_name);
    const values = columnNames.map((col: any) => data[col]);
    
    const placeholders = (config.type === 'mysql' || config.type === 'mariadb') 
      ? columnNames.map(() => '?').join(', ')
      : columnNames.map((_, index) => `$${index + 1}`).join(', ');
    
    const insertQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `INSERT INTO \`${databaseName}\`.\`${tableName}\` (\`${columnNames.join('`, `')}\`) VALUES (${placeholders})`
      : `INSERT INTO "${databaseName}"."${tableName}" ("${columnNames.join('", "')}") VALUES (${placeholders})`;
    
    const result = await databaseManager.executeQuery(connectionId, insertQuery, values);

    res.status(201).json({
      success: true,
      data: {
        insertId: result.insertId || result[0]?.id,
        affectedRows: result.affectedRows || 1,
      },
      message: 'Row created successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Update a row
 */
router.put('/:databaseName/:tableName/:id', [
  body().isObject().withMessage('Request body must be an object'),
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
    const { databaseName, tableName, id } = req.params;
    const data = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    // Get primary key columns
    const pkQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_key = 'PRI' ORDER BY ordinal_position`
      : `SELECT column_name FROM information_schema.columns WHERE table_catalog = $1 AND table_name = $2 AND is_nullable = 'NO' ORDER BY ordinal_position LIMIT 1`;
    
    const pkColumns = await databaseManager.executeQuery(connectionId, pkQuery, [databaseName, tableName]);
    
    if (pkColumns.length === 0) {
      throw createError('No primary key found for this table', 400);
    }

    const pkColumn = pkColumns[0].column_name;
    
    // Build SET clause
    const updateColumns = Object.keys(data).filter(key => key !== pkColumn);
    const setClause = (config.type === 'mysql' || config.type === 'mariadb')
      ? updateColumns.map(col => `\`${col}\` = ?`).join(', ')
      : updateColumns.map((col, index) => `"${col}" = $${index + 1}`).join(', ');
    
    const values = updateColumns.map(col => data[col]);
    const whereClause = (config.type === 'mysql' || config.type === 'mariadb') 
      ? `WHERE \`${pkColumn}\` = ?`
      : `WHERE "${pkColumn}" = $${values.length + 1}`;
    
    const updateQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `UPDATE \`${databaseName}\`.\`${tableName}\` SET ${setClause} ${whereClause}`
      : `UPDATE "${databaseName}"."${tableName}" SET ${setClause} ${whereClause}`;
    
    const result = await databaseManager.executeQuery(connectionId, updateQuery, [...values, id]);

    res.json({
      success: true,
      data: {
        affectedRows: result.affectedRows || result[0]?.rowCount || 0,
      },
      message: 'Row updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Delete a row
 */
router.delete('/:databaseName/:tableName/:id', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName, tableName, id } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    // Get primary key columns
    const pkQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_key = 'PRI' ORDER BY ordinal_position`
      : `SELECT column_name FROM information_schema.columns WHERE table_catalog = $1 AND table_name = $2 AND is_nullable = 'NO' ORDER BY ordinal_position LIMIT 1`;
    
    const pkColumns = await databaseManager.executeQuery(connectionId, pkQuery, [databaseName, tableName]);
    
    if (pkColumns.length === 0) {
      throw createError('No primary key found for this table', 400);
    }

    const pkColumn = pkColumns[0].column_name;
    
    const deleteQuery = (config.type === 'mysql' || config.type === 'mariadb')
      ? `DELETE FROM \`${databaseName}\`.\`${tableName}\` WHERE \`${pkColumn}\` = ?`
      : `DELETE FROM "${databaseName}"."${tableName}" WHERE "${pkColumn}" = $1`;
    
    const result = await databaseManager.executeQuery(connectionId, deleteQuery, [id]);

    res.json({
      success: true,
      data: {
        affectedRows: result.affectedRows || result[0]?.rowCount || 0,
      },
      message: 'Row deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
