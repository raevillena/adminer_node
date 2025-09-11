import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
// Types are defined inline to avoid import issues
interface Table {
  name: string;
  type: 'table' | 'view';
  engine?: string;
  collation?: string;
  rows?: number;
  size?: number;
  comment?: string;
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
  autoIncrement: boolean;
  primaryKey: boolean;
  comment: string;
  length?: number;
  precision?: number;
  scale?: number;
}

interface Index {
  name: string;
  type: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL';
  columns: string[];
  unique: boolean;
  comment: string;
}

interface ForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: string;
  onDelete: string;
}

interface Trigger {
  name: string;
  event: string;
  timing: string;
  statement: string;
  definer: string;
}

interface Constraint {
  name: string;
  type: string;
  columns: string[];
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

const router = Router();

/**
 * Get all tables and views for a specific database
 */
router.get('/:databaseName', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName } = req.params;

    console.log(`🔍 Fetching tables for database: ${databaseName}`);

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let tables: Table[] = [];

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // First try a simple query to test connection
      const simpleQuery = `SELECT table_name as name, table_type as type FROM information_schema.tables WHERE table_schema = ?`;
      console.log(`🔍 Testing simple query first...`);
      const simpleRows = await databaseManager.executeQuery(connectionId, simpleQuery, [databaseName]);
      console.log(`✅ Simple query successful, found ${simpleRows.length} tables`);
      
      const query = `
        SELECT 
          table_name as name,
          table_type as type,
          engine,
          table_collation as collation,
          table_rows as \`rows\`,
          ROUND((data_length + index_length) / 1024 / 1024, 2) as size,
          table_comment as comment
        FROM information_schema.tables 
        WHERE table_schema = ?
        ORDER BY table_type, table_name
      `;

      // Use simple query results for now
      tables = simpleRows.map((row: any) => ({
        name: row.name,
        type: row.type === 'BASE TABLE' ? 'table' : 'view',
        engine: 'Unknown',
        collation: 'Unknown',
        rows: 0,
        size: 0,
        comment: '',
      }));
      
      // Try the complex query for additional data
      try {
        console.log(`📊 Executing complex query for database: ${databaseName}`);
        console.log(`🔍 Query: ${query}`);
        console.log(`🔍 Params: [${databaseName}]`);
        const rows = await databaseManager.executeQuery(connectionId, query, [databaseName]);
        console.log(`📋 Found ${rows.length} tables/views with detailed info`);
        
        // Update tables with detailed information
        tables = rows.map((row: any) => ({
          name: row.name,
          type: row.type === 'BASE TABLE' ? 'table' : 'view',
          engine: row.engine,
          collation: row.collation,
          rows: row.rows,
          size: row.size || 0,
          comment: row.comment,
        }));
      } catch (complexError: any) {
        console.log(`⚠️ Complex query failed, using basic table info:`, complexError.message);
      }
    } else if (config.type === 'postgresql') {
      const query = `
        SELECT 
          table_name as name,
          table_type as type,
          pg_size_pretty(pg_total_relation_size(quote_ident(table_schema)||'.'||quote_ident(table_name))) as size_pretty,
          pg_total_relation_size(quote_ident(table_schema)||'.'||quote_ident(table_name)) as size_bytes
        FROM information_schema.tables 
        WHERE table_catalog = $1
        AND table_schema = 'public'
        ORDER BY table_type, table_name
      `;

      const rows = await databaseManager.executeQuery(connectionId, query, [databaseName]);
      
      tables = rows.map((row: any) => ({
        name: row.name,
        type: row.type === 'BASE TABLE' ? 'table' : 'view',
        size: Math.round(row.size_bytes / 1024 / 1024), // Convert to MB
        comment: '', // PostgreSQL doesn't have table comments in information_schema
      }));
    }

    console.log(`✅ Returning ${tables.length} tables to frontend`);
    res.json({
      success: true,
      data: tables,
    });
  } catch (error: any) {
    console.error(`❌ Error fetching tables for database ${req.params.databaseName}:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get table structure (columns, indexes, foreign keys, triggers, constraints)
 */
router.get('/:databaseName/:tableName/structure', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName, tableName } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    const structure = {
      columns: [] as Column[],
      indexes: [] as Index[],
      foreignKeys: [] as ForeignKey[],
      triggers: [] as Trigger[],
      constraints: [] as Constraint[],
    };

    if (config.type === 'mysql' || config.type === 'mariadb') {
      // Get columns
      const columnsQuery = `
        SELECT 
          column_name as name,
          data_type as type,
          is_nullable as nullable,
          column_default as defaultValue,
          extra,
          column_comment as comment,
          character_maximum_length as length,
          numeric_precision as \`precision\`,
          numeric_scale as scale,
          CASE WHEN column_key = 'PRI' THEN 1 ELSE 0 END as isPrimaryKey
        FROM information_schema.columns 
        WHERE table_schema = ? AND table_name = ?
        ORDER BY ordinal_position
      `;

      const columns = await databaseManager.executeQuery(connectionId, columnsQuery, [databaseName, tableName]);
      
      structure.columns = columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable === 'YES',
        defaultValue: col.defaultValue,
        autoIncrement: col.extra.includes('auto_increment'),
        primaryKey: col.isPrimaryKey === 1,
        comment: col.comment,
        length: col.length,
        precision: col[`precision`],
        scale: col.scale,
      }));

      // Get indexes
      const indexesQuery = `
        SELECT 
          index_name as name,
          non_unique as nonUnique,
          index_type as type,
          GROUP_CONCAT(column_name ORDER BY seq_in_index) as columns
        FROM information_schema.statistics 
        WHERE table_schema = ? AND table_name = ?
        GROUP BY index_name, non_unique, index_type
        ORDER BY index_name
      `;

      const indexes = await databaseManager.executeQuery(connectionId, indexesQuery, [databaseName, tableName]);
      
      structure.indexes = indexes.map((idx: any) => ({
        name: idx.name,
        type: idx.name === 'PRIMARY' ? 'PRIMARY' : 
              idx.type === 'FULLTEXT' ? 'FULLTEXT' :
              idx.type === 'SPATIAL' ? 'SPATIAL' :
              idx.nonUnique === 0 ? 'UNIQUE' : 'INDEX',
        columns: idx.columns.split(','),
        unique: idx.nonUnique === 0,
        comment: '',
      }));

      // Get foreign keys
      const foreignKeysQuery = `
        SELECT 
          kcu.constraint_name as name,
          kcu.column_name as \`column\`,
          kcu.referenced_table_name as referencedTable,
          kcu.referenced_column_name as referencedColumn,
          rc.update_rule as onUpdate,
          rc.delete_rule as onDelete
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc 
          ON kcu.constraint_name = rc.constraint_name
        WHERE kcu.table_schema = ? AND kcu.table_name = ?
        AND kcu.referenced_table_name IS NOT NULL
      `;

      const foreignKeys = await databaseManager.executeQuery(connectionId, foreignKeysQuery, [databaseName, tableName]);
      
      structure.foreignKeys = foreignKeys.map((fk: any) => ({
        name: fk.name,
        column: fk[`column`],
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn,
        onUpdate: fk.onUpdate,
        onDelete: fk.onDelete,
      }));

      // Get triggers
      const triggersQuery = `
        SELECT 
          trigger_name as name,
          event_manipulation as event,
          action_timing as timing,
          action_statement as statement,
          definer
        FROM information_schema.triggers 
        WHERE event_object_schema = ? AND event_object_table = ?
        ORDER BY trigger_name
      `;

      const triggers = await databaseManager.executeQuery(connectionId, triggersQuery, [databaseName, tableName]);
      
      structure.triggers = triggers.map((trigger: any) => ({
        name: trigger.name,
        event: trigger.event,
        timing: trigger.timing,
        statement: trigger.statement,
        definer: trigger.definer,
      }));

      // Get constraints
      const constraintsQuery = `
        SELECT 
          tc.constraint_name as name,
          tc.constraint_type as type,
          GROUP_CONCAT(kcu.column_name) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = ? AND tc.table_name = ?
        GROUP BY tc.constraint_name, tc.constraint_type
      `;

      const constraints = await databaseManager.executeQuery(connectionId, constraintsQuery, [databaseName, tableName]);
      
      structure.constraints = constraints.map((constraint: any) => ({
        name: constraint.name,
        type: constraint.type,
        columns: constraint.columns.split(','),
      }));

    } else if (config.type === 'postgresql') {
      // Get columns
      const columnsQuery = `
        SELECT 
          column_name as name,
          data_type as type,
          is_nullable as nullable,
          column_default as defaultValue,
          character_maximum_length as length,
          numeric_precision as \`precision\`,
          numeric_scale as scale,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as isPrimaryKey
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku 
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_catalog = $1 
            AND tc.table_name = $2 
            AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_catalog = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
      `;

      const columns = await databaseManager.executeQuery(connectionId, columnsQuery, [databaseName, tableName]);
      
      structure.columns = columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable === 'YES',
        defaultValue: col.defaultValue,
        autoIncrement: col.defaultValue?.includes('nextval') || false,
        primaryKey: col.isPrimaryKey,
        comment: '',
        length: col.length,
        precision: col[`precision`],
        scale: col.scale,
      }));

      // Get indexes
      const indexesQuery = `
        SELECT 
          indexname as name,
          indexdef as definition,
          CASE WHEN indisunique THEN 'UNIQUE' ELSE 'INDEX' END as type
        FROM pg_indexes pi
        JOIN pg_class pc ON pi.indexname = pc.relname
        JOIN pg_index pgi ON pc.oid = pgi.indexrelid
        WHERE pi.tablename = $2
        ORDER BY indexname
      `;

      const indexes = await databaseManager.executeQuery(connectionId, indexesQuery, [databaseName, tableName]);
      
      structure.indexes = indexes.map((idx: any) => {
        const columns = idx.definition.match(/\(([^)]+)\)/)?.[1]?.split(',').map((c: string) => c.trim()) || [];
        return {
          name: idx.name,
          type: idx.type as any,
          columns,
          unique: idx.type === 'UNIQUE',
          comment: '',
        };
      });

      // Get foreign keys
      const foreignKeysQuery = `
        SELECT 
          tc.constraint_name as name,
          kcu.column_name as "column",
          ccu.table_name as referencedTable,
          ccu.column_name as referencedColumn,
          rc.update_rule as onUpdate,
          rc.delete_rule as onDelete
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints rc 
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_catalog = $1 
          AND tc.table_name = $2 
          AND tc.constraint_type = 'FOREIGN KEY'
      `;

      const foreignKeys = await databaseManager.executeQuery(connectionId, foreignKeysQuery, [databaseName, tableName]);
      
      structure.foreignKeys = foreignKeys.map((fk: any) => ({
        name: fk.name,
        column: fk[`column`],
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn,
        onUpdate: fk.onUpdate,
        onDelete: fk.onDelete,
      }));

      // Get constraints
      const constraintsQuery = `
        SELECT 
          tc.constraint_name as name,
          tc.constraint_type as type,
          string_agg(kcu.column_name, ',') as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_catalog = $1 AND tc.table_name = $2
        GROUP BY tc.constraint_name, tc.constraint_type
      `;

      const constraints = await databaseManager.executeQuery(connectionId, constraintsQuery, [databaseName, tableName]);
      
      structure.constraints = constraints.map((constraint: any) => ({
        name: constraint.name,
        type: constraint.type,
        columns: constraint.columns.split(','),
      }));
    }

    res.json({
      success: true,
      data: structure,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Create a new table
 */
router.post('/:databaseName', [
  body('name').notEmpty().withMessage('Table name is required'),
  body('columns').isArray({ min: 1 }).withMessage('At least one column is required'),
  body('engine').optional().isString().withMessage('Engine must be a string'),
  body('charset').optional().isString().withMessage('Charset must be a string'),
  body('collation').optional().isString().withMessage('Collation must be a string'),
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
    const { name, columns, engine, charset, collation } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    // Build CREATE TABLE query
    let createQuery = `CREATE TABLE \`${databaseName}\`.\`${name}\` (`;
    
    const columnDefinitions = columns.map((col: any) => {
      let def = `\`${col.name}\` ${col.type}`;
      
      if (col.length) {
        def += `(${col.length})`;
      } else if (col.precision && col.scale) {
        def += `(${col.precision},${col.scale})`;
      }
      
      if (col.autoIncrement) {
        def += ' AUTO_INCREMENT';
      }
      
      if (!col.nullable) {
        def += ' NOT NULL';
      }
      
      if (col.defaultValue !== null && col.defaultValue !== undefined) {
        def += ` DEFAULT ${col.defaultValue}`;
      }
      
      if (col.comment) {
        def += ` COMMENT '${col.comment.replace(/'/g, "''")}'`;
      }
      
      return def;
    });

    createQuery += columnDefinitions.join(', ');

    // Add primary key if specified
    const primaryKeys = columns.filter((col: any) => col.primaryKey);
    if (primaryKeys.length > 0) {
      createQuery += `, PRIMARY KEY (\`${primaryKeys.map((col: any) => col.name).join('`, `')}\`)`;
    }

    createQuery += ')';

    // Add table options
    if (engine) {
      createQuery += ` ENGINE=${engine}`;
    }
    if (charset) {
      createQuery += ` DEFAULT CHARSET=${charset}`;
    }
    if (collation) {
      createQuery += ` COLLATE=${collation}`;
    }

    await databaseManager.executeQuery(connectionId, createQuery);

    res.status(201).json({
      success: true,
      message: `Table '${name}' created successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Drop a table
 */
router.delete('/:databaseName/:tableName', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName, tableName } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    const dropQuery = `DROP TABLE \`${databaseName}\`.\`${tableName}\``;
    await databaseManager.executeQuery(connectionId, dropQuery);

    res.json({
      success: true,
      message: `Table '${tableName}' dropped successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Rename a table
 */
router.put('/:databaseName/:tableName/rename', [
  body('newName').notEmpty().withMessage('New table name is required'),
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
    const { newName } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    const renameQuery = `RENAME TABLE \`${databaseName}\`.\`${tableName}\` TO \`${databaseName}\`.\`${newName}\``;
    await databaseManager.executeQuery(connectionId, renameQuery);

    res.json({
      success: true,
      message: `Table '${tableName}' renamed to '${newName}' successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Add a column to a table
 */
router.post('/:databaseName/:tableName/columns', [
  body('name').notEmpty().withMessage('Column name is required'),
  body('type').notEmpty().withMessage('Column type is required'),
  body('nullable').optional().isBoolean().withMessage('Nullable must be a boolean'),
  body('defaultValue').optional().isString().withMessage('Default value must be a string'),
  body('autoIncrement').optional().isBoolean().withMessage('Auto increment must be a boolean'),
  body('comment').optional().isString().withMessage('Comment must be a string'),
  body('after').optional().isString().withMessage('After column must be a string'),
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
    const { name, type, nullable = true, defaultValue, autoIncrement = false, comment, after } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let alterQuery = `ALTER TABLE \`${databaseName}\`.\`${tableName}\` ADD COLUMN \`${name}\` ${type}`;
    
    if (!nullable) {
      alterQuery += ' NOT NULL';
    }
    
    if (autoIncrement) {
      alterQuery += ' AUTO_INCREMENT';
    }
    
    if (defaultValue !== null && defaultValue !== undefined) {
      alterQuery += ` DEFAULT ${defaultValue}`;
    }
    
    if (comment) {
      alterQuery += ` COMMENT '${comment.replace(/'/g, "''")}'`;
    }
    
    if (after) {
      alterQuery += ` AFTER \`${after}\``;
    }

    await databaseManager.executeQuery(connectionId, alterQuery);

    res.status(201).json({
      success: true,
      message: `Column '${name}' added to table '${tableName}' successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Modify a column in a table
 */
router.put('/:databaseName/:tableName/columns/:columnName', [
  body('type').optional().isString().withMessage('Column type must be a string'),
  body('nullable').optional().isBoolean().withMessage('Nullable must be a boolean'),
  body('defaultValue').optional().isString().withMessage('Default value must be a string'),
  body('autoIncrement').optional().isBoolean().withMessage('Auto increment must be a boolean'),
  body('comment').optional().isString().withMessage('Comment must be a string'),
  body('newName').optional().isString().withMessage('New column name must be a string'),
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
    const { databaseName, tableName, columnName } = req.params;
    const { type, nullable, defaultValue, autoIncrement, comment, newName } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let alterQuery = `ALTER TABLE \`${databaseName}\`.\`${tableName}\` MODIFY COLUMN \`${columnName}\``;
    
    if (type) {
      alterQuery += ` ${type}`;
    }
    
    if (nullable !== undefined) {
      alterQuery += nullable ? ' NULL' : ' NOT NULL';
    }
    
    if (autoIncrement !== undefined) {
      if (autoIncrement) {
        alterQuery += ' AUTO_INCREMENT';
      }
    }
    
    if (defaultValue !== undefined) {
      if (defaultValue === null) {
        alterQuery += ' DEFAULT NULL';
      } else {
        alterQuery += ` DEFAULT ${defaultValue}`;
      }
    }
    
    if (comment !== undefined) {
      alterQuery += ` COMMENT '${comment.replace(/'/g, "''")}'`;
    }

    await databaseManager.executeQuery(connectionId, alterQuery);

    // If renaming the column
    if (newName && newName !== columnName) {
      const renameQuery = `ALTER TABLE \`${databaseName}\`.\`${tableName}\` CHANGE COLUMN \`${columnName}\` \`${newName}\` ${type || 'VARCHAR(255)'}`;
      await databaseManager.executeQuery(connectionId, renameQuery);
    }

    res.json({
      success: true,
      message: `Column '${columnName}' modified successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Drop a column from a table
 */
router.delete('/:databaseName/:tableName/columns/:columnName', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName, tableName, columnName } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    const dropQuery = `ALTER TABLE \`${databaseName}\`.\`${tableName}\` DROP COLUMN \`${columnName}\``;
    await databaseManager.executeQuery(connectionId, dropQuery);

    res.json({
      success: true,
      message: `Column '${columnName}' dropped from table '${tableName}' successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Create an index on a table
 */
router.post('/:databaseName/:tableName/indexes', [
  body('name').notEmpty().withMessage('Index name is required'),
  body('columns').isArray({ min: 1 }).withMessage('At least one column is required'),
  body('type').optional().isIn(['PRIMARY', 'UNIQUE', 'INDEX', 'FULLTEXT', 'SPATIAL']).withMessage('Invalid index type'),
  body('comment').optional().isString().withMessage('Comment must be a string'),
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
    const { name, columns, type = 'INDEX', comment } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let createQuery = `ALTER TABLE \`${databaseName}\`.\`${tableName}\` ADD`;
    
    if (type === 'PRIMARY') {
      createQuery += ` PRIMARY KEY (\`${columns.join('`, `')}\`)`;
    } else {
      createQuery += ` ${type} \`${name}\` (\`${columns.join('`, `')}\`)`;
    }
    
    if (comment) {
      createQuery += ` COMMENT '${comment.replace(/'/g, "''")}'`;
    }

    await databaseManager.executeQuery(connectionId, createQuery);

    res.status(201).json({
      success: true,
      message: `Index '${name}' created successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Drop an index from a table
 */
router.delete('/:databaseName/:tableName/indexes/:indexName', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { databaseName, tableName, indexName } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let dropQuery;
    if (indexName === 'PRIMARY') {
      dropQuery = `ALTER TABLE \`${databaseName}\`.\`${tableName}\` DROP PRIMARY KEY`;
    } else {
      dropQuery = `ALTER TABLE \`${databaseName}\`.\`${tableName}\` DROP INDEX \`${indexName}\``;
    }

    await databaseManager.executeQuery(connectionId, dropQuery);

    res.json({
      success: true,
      message: `Index '${indexName}' dropped successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
