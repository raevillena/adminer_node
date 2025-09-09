import { Router, Request, Response } from 'express';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { Table, Column, Index, ForeignKey, Trigger, Constraint, ApiResponse } from '../../shared/types';

const router = Router();

/**
 * Get all tables and views for a specific database
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

    let tables: Table[] = [];

    if (config.type === 'mysql' || config.type === 'mariadb') {
      const query = `
        SELECT 
          table_name as name,
          table_type as type,
          engine,
          table_collation as collation,
          table_rows as rows,
          ROUND((data_length + index_length) / 1024 / 1024, 2) as size,
          table_comment as comment
        FROM information_schema.tables 
        WHERE table_schema = ?
        ORDER BY table_type, table_name
      `;

      const rows = await databaseManager.executeQuery(connectionId, query, [databaseName]);
      
      tables = rows.map((row: any) => ({
        name: row.name,
        type: row.type === 'BASE TABLE' ? 'table' : 'view',
        engine: row.engine,
        collation: row.collation,
        rows: row.rows,
        size: row.size || 0,
        comment: row.comment,
      }));
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

    res.json({
      success: true,
      data: tables,
    });
  } catch (error: any) {
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
          numeric_precision as precision,
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
        precision: col.precision,
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
          constraint_name as name,
          column_name as column,
          referenced_table_name as referencedTable,
          referenced_column_name as referencedColumn,
          update_rule as onUpdate,
          delete_rule as onDelete
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc 
          ON kcu.constraint_name = rc.constraint_name
        WHERE kcu.table_schema = ? AND kcu.table_name = ?
        AND kcu.referenced_table_name IS NOT NULL
      `;

      const foreignKeys = await databaseManager.executeQuery(connectionId, foreignKeysQuery, [databaseName, tableName]);
      
      structure.foreignKeys = foreignKeys.map((fk: any) => ({
        name: fk.name,
        column: fk.column,
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
          constraint_name as name,
          constraint_type as type,
          GROUP_CONCAT(column_name) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = ? AND tc.table_name = ?
        GROUP BY constraint_name, constraint_type
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
          numeric_precision as precision,
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
        precision: col.precision,
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
          kcu.column_name as column,
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
        column: fk.column,
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn,
        onUpdate: fk.onUpdate,
        onDelete: fk.onDelete,
      }));

      // Get constraints
      const constraintsQuery = `
        SELECT 
          constraint_name as name,
          constraint_type as type,
          string_agg(column_name, ',') as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_catalog = $1 AND tc.table_name = $2
        GROUP BY constraint_name, constraint_type
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

export default router;
