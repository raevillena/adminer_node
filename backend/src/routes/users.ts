import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { databaseManager } from '../services/databaseManager';
import { createError } from '../middleware/errorHandler';
import { DatabaseUser, UserPrivilege, ApiResponse } from '../../shared/types';

const router = Router();

/**
 * Get all database users
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

    let users: DatabaseUser[] = [];

    if (config.type === 'mysql' || config.type === 'mariadb') {
      const query = `
        SELECT 
          User as name,
          Host as host,
          max_connections as maxConnections,
          max_user_connections as maxUserConnections,
          max_questions as maxQuestions,
          max_updates as maxUpdates,
          password_expired as passwordExpired,
          account_locked as accountLocked
        FROM mysql.user
        ORDER BY User, Host
      `;

      const rows = await databaseManager.executeQuery(connectionId, query);
      
      // Get privileges for each user
      for (const user of rows) {
        const privilegesQuery = `
          SELECT 
            GROUP_CONCAT(DISTINCT privilege_type) as privileges
          FROM information_schema.user_privileges 
          WHERE grantee = CONCAT('\\'', ?, '\\'@\\'', ?, '\\'')
        `;
        
        const privilegesResult = await databaseManager.executeQuery(connectionId, privilegesQuery, [user.name, user.host]);
        const privileges = privilegesResult[0]?.privileges?.split(',') || [];

        users.push({
          name: user.name,
          host: user.host,
          privileges,
          maxConnections: user.maxConnections,
          maxUserConnections: user.maxUserConnections,
          maxQuestions: user.maxQuestions,
          maxUpdates: user.maxUpdates,
          passwordExpired: user.passwordExpired === 'Y',
          accountLocked: user.accountLocked === 'Y',
        });
      }
    } else if (config.type === 'postgresql') {
      const query = `
        SELECT 
          usename as name,
          'localhost' as host,
          usesuper as isSuperuser,
          usecreatedb as canCreateDb,
          usebypassrls as canBypassRls
        FROM pg_user
        ORDER BY usename
      `;

      const rows = await databaseManager.executeQuery(connectionId, query);
      
      users = rows.map((user: any) => ({
        name: user.name,
        host: user.host,
        privileges: user.isSuperuser ? ['ALL'] : 
                   user.canCreateDb ? ['CREATE'] : [],
        accountLocked: false,
        passwordExpired: false,
      }));
    }

    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Create a new database user
 */
router.post('/', [
  body('name').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('host').optional().isString().withMessage('Host must be a string'),
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
    const { name, password, host = 'localhost' } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    if (config.type === 'mysql' || config.type === 'mariadb') {
      const createUserQuery = `CREATE USER ?@? IDENTIFIED BY ?`;
      await databaseManager.executeQuery(connectionId, createUserQuery, [name, host, password]);
    } else if (config.type === 'postgresql') {
      const createUserQuery = `CREATE USER "${name}" WITH PASSWORD $1`;
      await databaseManager.executeQuery(connectionId, createUserQuery, [password]);
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.status(201).json({
      success: true,
      message: `User '${name}' created successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Grant privileges to a user
 */
router.post('/:username/privileges', [
  body('privileges').isArray().withMessage('Privileges must be an array'),
  body('database').optional().isString().withMessage('Database must be a string'),
  body('table').optional().isString().withMessage('Table must be a string'),
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
    const { username } = req.params;
    const { privileges, database, table } = req.body;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    let grantQuery: string;
    const privilegeList = privileges.join(', ');

    if (config.type === 'mysql' || config.type === 'mariadb') {
      if (database && table) {
        grantQuery = `GRANT ${privilegeList} ON \`${database}\`.\`${table}\` TO ?@?`;
      } else if (database) {
        grantQuery = `GRANT ${privilegeList} ON \`${database}\`.* TO ?@?`;
      } else {
        grantQuery = `GRANT ${privilegeList} ON *.* TO ?@?`;
      }
      
      await databaseManager.executeQuery(connectionId, grantQuery, [username, 'localhost']);
    } else if (config.type === 'postgresql') {
      if (database && table) {
        grantQuery = `GRANT ${privilegeList} ON "${database}"."${table}" TO "${username}"`;
      } else if (database) {
        grantQuery = `GRANT ${privilegeList} ON DATABASE "${database}" TO "${username}"`;
      } else {
        grantQuery = `GRANT ${privilegeList} TO "${username}"`;
      }
      
      await databaseManager.executeQuery(connectionId, grantQuery);
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      message: `Privileges granted to user '${username}'`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Delete a database user
 */
router.delete('/:username', async (req: Request, res: Response) => {
  try {
    const connectionId = req.user?.connectionId;
    const { username } = req.params;

    if (!connectionId) {
      throw createError('No active connection', 400);
    }

    const config = databaseManager.getConnectionConfig(connectionId);
    if (!config) {
      throw createError('Connection not found', 404);
    }

    if (config.type === 'mysql' || config.type === 'mariadb') {
      const dropUserQuery = `DROP USER ?@?`;
      await databaseManager.executeQuery(connectionId, dropUserQuery, [username, 'localhost']);
    } else if (config.type === 'postgresql') {
      const dropUserQuery = `DROP USER "${username}"`;
      await databaseManager.executeQuery(connectionId, dropUserQuery);
    } else {
      throw createError('Unsupported database type', 400);
    }

    res.json({
      success: true,
      message: `User '${username}' deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
