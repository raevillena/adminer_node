import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { databaseManager } from '../services/databaseManager';
import { generateToken } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { DatabaseConnection, ApiResponse, ConnectionTest } from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// File-based storage for connections
const CONNECTIONS_FILE = path.join(__dirname, '../../data/connections.json');

// Ensure data directory exists
const dataDir = path.dirname(CONNECTIONS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load connections from file
const loadConnections = (): Map<string, DatabaseConnection> => {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      const connectionsArray = JSON.parse(data);
      return new Map(connectionsArray.map((conn: any) => [conn.id, {
        ...conn,
        createdAt: new Date(conn.createdAt),
        updatedAt: new Date(conn.updatedAt),
      }]));
    }
  } catch (error) {
    console.error('Error loading connections:', error);
  }
  return new Map();
};

// Save connections to file
const saveConnections = (connections: Map<string, DatabaseConnection>): void => {
  try {
    const connectionsArray = Array.from(connections.values());
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connectionsArray, null, 2));
  } catch (error) {
    console.error('Error saving connections:', error);
  }
};

// Load connections on startup
const connections: Map<string, DatabaseConnection> = loadConnections();

// Initialize database connections for loaded connections
const initializeDatabaseConnections = async () => {
  for (const [id, connection] of connections) {
    try {
      await databaseManager.createConnection(connection);
      console.log(`✅ Database connection initialized for: ${connection.name}`);
    } catch (error) {
      console.error(`❌ Failed to initialize database connection for ${connection.name}:`, error);
    }
  }
};

// Initialize database connections on startup
initializeDatabaseConnections();

/**
 * Test a database connection
 */
router.post('/test', [
  body('type').isIn(['mysql', 'mariadb', 'postgresql']).withMessage('Type must be mysql, mariadb, or postgresql'),
  body('host').notEmpty().withMessage('Host is required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('database').notEmpty().withMessage('Database is required'),
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

    const { type, host, port, username, password, database, ssl } = req.body;

    const testResult = await databaseManager.testConnection({
      type,
      host,
      port,
      username,
      password,
      database,
      ssl: ssl || false,
    });

    res.json({
      success: testResult.success,
      data: testResult,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Create a new database connection
 */
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('type').isIn(['mysql', 'mariadb', 'postgresql']).withMessage('Type must be mysql, mariadb, or postgresql'),
  body('host').notEmpty().withMessage('Host is required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('database').notEmpty().withMessage('Database is required'),
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

    const { name, type, host, port, username, password, database, ssl } = req.body;

    // Test connection first
    const testResult = await databaseManager.testConnection({
      type,
      host,
      port,
      username,
      password,
      database,
      ssl: ssl || false,
    });

    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        message: testResult.message || 'Connection test failed',
      });
    }

    // Create connection object
    const connectionId = uuidv4();
    const connection: DatabaseConnection = {
      id: connectionId,
      name,
      type,
      host,
      port,
      username,
      password,
      database,
      ssl: ssl || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store connection
    connections.set(connectionId, connection);
    saveConnections(connections);

    // Create database connection
    await databaseManager.createConnection(connection);

    // Generate JWT token
    const token = generateToken(connectionId);

    res.status(201).json({
      success: true,
      data: {
        connection,
        token,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get all connections
 */
router.get('/', (req: Request, res: Response) => {
  const connectionList = Array.from(connections.values()).map(conn => ({
    ...conn,
    password: '***', // Hide password in response
  }));

  res.json({
    success: true,
    data: connectionList,
  });
});

/**
 * Get a specific connection
 */
router.get('/:id', (req: Request, res: Response) => {
  const connectionId = req.params.id;
  if (!connectionId) {
    return res.status(400).json({
      success: false,
      message: 'Connection ID is required',
    });
  }
  
  const connection = connections.get(connectionId);
  
  if (!connection) {
    return res.status(404).json({
      success: false,
      message: 'Connection not found',
    });
  }

  res.json({
    success: true,
    data: {
      ...connection,
      password: '***', // Hide password in response
    },
  });
});

/**
 * Update a connection
 */
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('type').optional().isIn(['mysql', 'mariadb', 'postgresql']).withMessage('Type must be mysql, mariadb, or postgresql'),
  body('host').optional().notEmpty().withMessage('Host cannot be empty'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('username').optional().notEmpty().withMessage('Username cannot be empty'),
  body('password').optional().notEmpty().withMessage('Password cannot be empty'),
  body('database').optional().notEmpty().withMessage('Database cannot be empty'),
], async (req: Request, res: Response) => {
  try {
    const connectionId = req.params.id;
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const connection = connections.get(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found',
      });
    }

    const updates = req.body;
    const updatedConnection = {
      ...connection,
      ...updates,
      updatedAt: new Date(),
    };

    // Test connection if credentials changed
    if (updates.host || updates.port || updates.username || updates.password || updates.database) {
      const testResult = await databaseManager.testConnection({
        type: updatedConnection.type,
        host: updatedConnection.host,
        port: updatedConnection.port,
        username: updatedConnection.username,
        password: updatedConnection.password,
        database: updatedConnection.database,
        ssl: updatedConnection.ssl,
      });

      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          message: testResult.message || 'Connection test failed',
        });
      }

      // Close old connection and create new one
      await databaseManager.closeConnection(connection.id);
      await databaseManager.createConnection(updatedConnection);
    }

    connections.set(connectionId, updatedConnection);
    saveConnections(connections);

    res.json({
      success: true,
      data: {
        ...updatedConnection,
        password: '***', // Hide password in response
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Delete a connection
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const connectionId = req.params.id;
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required',
      });
    }

    const connection = connections.get(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found',
      });
    }

    // Close database connection
    await databaseManager.closeConnection(connectionId);
    
    // Remove from storage
    connections.delete(connectionId);
    saveConnections(connections);

    res.json({
      success: true,
      message: 'Connection deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get connection status
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const connectionId = req.params.id;
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required',
      });
    }

    const connection = connections.get(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found',
      });
    }

    const isConnected = await databaseManager.getConnectionStatus(connectionId);

    res.json({
      success: true,
      data: {
        connected: isConnected,
        lastChecked: new Date(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Generate a token for an existing connection
 */
router.post('/:id/token', async (req: Request, res: Response) => {
  try {
    const connectionId = req.params.id;
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required',
      });
    }

    console.log(`🔑 Generating token for connection ID: ${connectionId}`);
    
    const connection = connections.get(connectionId);
    if (!connection) {
      console.error(`❌ Connection not found in connections map: ${connectionId}`);
      return res.status(404).json({
        success: false,
        message: 'Connection not found',
      });
    }

    console.log(`✅ Connection found: ${connection.name} (${connection.type})`);

    // Ensure database connection exists in database manager
    const existingConnection = databaseManager.getConnection(connectionId);
    if (!existingConnection) {
      console.log(`🔌 Creating database connection for: ${connection.name}`);
      // Create the database connection if it doesn't exist
      await databaseManager.createConnection(connection);
      console.log(`✅ Database connection created for: ${connection.name}`);
    } else {
      console.log(`✅ Database connection already exists for: ${connection.name}`);
    }

    // Generate JWT token
    const token = generateToken(connectionId);
    console.log(`🎫 JWT token generated for: ${connection.name}`);

    res.json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error: any) {
    const connectionId = req.params.id;
    console.error(`❌ Error generating token for connection ${connectionId}:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
