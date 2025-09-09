import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { ExportOptions, ImportResult, ApiResponse } from '../../shared/types';
import { createCsvWriter } from 'csv-writer';

const router = Router();

/**
 * Export database schema and/or data
 */
router.post('/export', [
  body('format').isIn(['sql', 'csv', 'json']).withMessage('Format must be sql, csv, or json'),
  body('tables').optional().isArray().withMessage('Tables must be an array'),
  body('dataOnly').optional().isBoolean().withMessage('DataOnly must be a boolean'),
  body('schemaOnly').optional().isBoolean().withMessage('SchemaOnly must be a boolean'),
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
    const { format, tables, dataOnly = false, schemaOnly = false } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let exportData: string | Buffer;

    if (format === 'sql') {
      exportData = await exportToSql(connectionId, config, tables, dataOnly, schemaOnly);
    } else if (format === 'csv') {
      exportData = await exportToCsv(connectionId, config, tables);
    } else if (format === 'json') {
      exportData = await exportToJson(connectionId, config, tables);
    } else {
      throw createError('Unsupported export format', 400);
    }

    const filename = `export_${config.database}_${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'sql' ? 'text/plain' : 
                              format === 'csv' ? 'text/csv' : 'application/json');
    
    res.send(exportData);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Import SQL dump
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { sql } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    if (!sql) {
      throw createError('SQL content is required', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    // Split SQL into individual statements
    const statements = sql.split(';').filter((stmt: string) => stmt.trim().length > 0);
    let importedRows = 0;
    const errors: string[] = [];

    for (const statement of statements) {
      try {
        const result = await databaseManager.executeQuery(connectionId, statement);
        if (result.affectedRows) {
          importedRows += result.affectedRows;
        }
      } catch (error: any) {
        errors.push(`Statement failed: ${statement.substring(0, 100)}... - ${error.message}`);
      }
    }

    const result: ImportResult = {
      success: errors.length === 0,
      message: errors.length === 0 ? 'Import completed successfully' : 'Import completed with errors',
      importedRows,
      errors: errors.length > 0 ? errors : undefined,
    };

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
 * Export to SQL format
 */
async function exportToSql(
  connectionId: string,
  config: any,
  tables?: string[],
  dataOnly: boolean = false,
  schemaOnly: boolean = false
): Promise<string> {
  let sql = '';
  
  // Add header comment
  sql += `-- Adminer Export\n`;
  sql += `-- Database: ${config.database}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;

    if (config.type === 'mysql' || config.type === 'mariadb') {
    // Get all tables if not specified
    if (!tables) {
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ?
        ORDER BY table_name
      `;
      const tableRows = await databaseManager.executeQuery(connectionId, tablesQuery, [config.database]);
      tables = tableRows.map((row: any) => row.table_name);
    }

    for (const tableName of tables) {
      if (!schemaOnly) {
        // Export table structure
        const createTableQuery = `SHOW CREATE TABLE \`${config.database}\`.\`${tableName}\``;
        const createTableResult = await databaseManager.executeQuery(connectionId, createTableQuery);
        const createTableSql = createTableResult[0]['Create Table'];
        
        sql += `-- Table structure for table \`${tableName}\`\n`;
        sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        sql += `${createTableSql};\n\n`;
      }

      if (!dataOnly) {
        // Export table data
        const dataQuery = `SELECT * FROM \`${config.database}\`.\`${tableName}\``;
        const data = await databaseManager.executeQuery(connectionId, dataQuery);
        
        if (data.length > 0) {
          sql += `-- Data for table \`${tableName}\`\n`;
          
          // Get column names
          const columnsQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = ? AND table_name = ?
            ORDER BY ordinal_position
          `;
          const columns = await databaseManager.executeQuery(connectionId, columnsQuery, [config.database, tableName]);
          const columnNames = columns.map((col: any) => col.column_name);
          
          // Generate INSERT statements
          for (const row of data) {
            const values = columnNames.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
              return value;
            });
            
            sql += `INSERT INTO \`${tableName}\` (\`${columnNames.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
          }
          sql += '\n';
        }
      }
    }
  } else if (config.type === 'postgresql') {
    // PostgreSQL export logic would go here
    // This is a simplified version
    sql += `-- PostgreSQL export not fully implemented\n`;
  }

  return sql;
}

/**
 * Export to CSV format
 */
async function exportToCsv(connectionId: string, config: any, tables?: string[]): Promise<string> {
  let csvData = '';
  
  if (!tables) {
    const tablesQuery = config.type === 'mysql'
      ? `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`
      : `SELECT table_name FROM information_schema.tables WHERE table_catalog = $1 ORDER BY table_name`;
    
    const tableRows = await databaseManager.executeQuery(connectionId, tablesQuery, [config.database]);
    tables = tableRows.map((row: any) => row.table_name);
  }

  for (const tableName of tables) {
    const dataQuery = config.type === 'mysql'
      ? `SELECT * FROM \`${config.database}\`.\`${tableName}\``
      : `SELECT * FROM "${config.database}"."${tableName}"`;
    
    const data = await databaseManager.executeQuery(connectionId, dataQuery);
    
    if (data.length > 0) {
      // Add table header
      csvData += `-- Table: ${tableName}\n`;
      
      // Get column names
      const columns = Object.keys(data[0]);
      csvData += columns.join(',') + '\n';
      
      // Add data rows
      for (const row of data) {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvData += values.join(',') + '\n';
      }
      csvData += '\n';
    }
  }

  return csvData;
}

/**
 * Export to JSON format
 */
async function exportToJson(connectionId: string, config: any, tables?: string[]): Promise<string> {
  const exportData: any = {
    database: config.database,
    exportedAt: new Date().toISOString(),
    tables: {},
  };

  if (!tables) {
    const tablesQuery = config.type === 'mysql'
      ? `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`
      : `SELECT table_name FROM information_schema.tables WHERE table_catalog = $1 ORDER BY table_name`;
    
    const tableRows = await databaseManager.executeQuery(connectionId, tablesQuery, [config.database]);
    tables = tableRows.map((row: any) => row.table_name);
  }

  for (const tableName of tables) {
    const dataQuery = config.type === 'mysql'
      ? `SELECT * FROM \`${config.database}\`.\`${tableName}\``
      : `SELECT * FROM "${config.database}"."${tableName}"`;
    
    const data = await databaseManager.executeQuery(connectionId, dataQuery);
    exportData.tables[tableName] = data;
  }

  return JSON.stringify(exportData, null, 2);
}

export default router;
