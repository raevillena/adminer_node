import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Storage as DatabaseIcon,
  TableChart as TableIcon,
  People as UsersIcon,
  Speed as SpeedIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { Database, DatabaseConnection } from '../../shared/types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, setCurrentConnection, setCurrentDatabase } = useApp();
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [showNewDatabaseDialog, setShowNewDatabaseDialog] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState('');
  const [newDatabaseCharset, setNewDatabaseCharset] = useState('');
  const [newDatabaseCollation, setNewDatabaseCollation] = useState('');

  // Fetch connections
  const { data: connections = [], isLoading: connectionsLoading } = useQuery(
    'connections',
    apiService.connections.getAll,
    {
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to load connections');
      },
    }
  );

  // Fetch databases for current connection
  const { data: databases = [], isLoading: databasesLoading } = useQuery(
    ['databases', state.currentConnection?.id],
    () => apiService.databases.getAll(),
    {
      enabled: !!state.currentConnection,
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to load databases');
      },
    }
  );

  // Fetch server info
  const { data: serverInfo, isLoading: serverInfoLoading } = useQuery(
    ['serverInfo', state.currentConnection?.id],
    () => apiService.server.getInfo(),
    {
      enabled: !!state.currentConnection,
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to load server info');
      },
    }
  );

  // Connect to database mutation
  const connectMutation = useMutation(
    async (connectionId: string) => {
      console.log('🔌 Attempting to connect to:', connectionId);
      const connection = connections.find(c => c.id === connectionId);
      if (!connection) {
        console.error('❌ Connection not found in connections list');
        throw new Error('Connection not found');
      }
      
      console.log('📡 Getting token for connection:', connection.name);
      // Get a proper JWT token from the backend
      const result = await apiService.connections.getToken(connectionId);
      console.log('✅ Token received:', result.token ? 'Yes' : 'No');
      
      // Store connection in context
      setCurrentConnection(connection);
      console.log('💾 Connection stored in context');
      
      // Use the JWT token from the backend
      localStorage.setItem('token', result.token);
      console.log('🔑 Token stored in localStorage');
      
      // Dispatch auth change event
      window.dispatchEvent(new Event('authChange'));
      console.log('📢 Auth change event dispatched');
      
      return result;
    },
    {
      onSuccess: () => {
        console.log('🎉 Connection successful!');
        toast.success('Connected successfully!');
        queryClient.invalidateQueries(['databases']);
        queryClient.invalidateQueries(['serverInfo']);
      },
      onError: (error: any) => {
        console.error('❌ Connection failed:', error);
        toast.error(error.message || 'Failed to connect');
      },
    }
  );

  // Delete connection mutation
  const deleteConnectionMutation = useMutation(
    (connectionId: string) => apiService.connections.delete(connectionId),
    {
      onSuccess: () => {
        toast.success('Connection deleted successfully');
        queryClient.invalidateQueries('connections');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete connection');
      },
    }
  );

  // Create connection mutation
  const createConnectionMutation = useMutation(
    (config: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>) => 
      apiService.connections.create(config),
    {
      onSuccess: (result) => {
        toast.success('Connection created successfully');
        queryClient.invalidateQueries('connections');
        setEditingConnection(null);
        // Auto-connect to the new connection
        setCurrentConnection(result.connection);
        localStorage.setItem('token', result.token);
        window.dispatchEvent(new Event('authChange'));
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create connection');
      },
    }
  );

  // Update connection mutation
  const updateConnectionMutation = useMutation(
    ({ id, updates }: { id: string; updates: Partial<DatabaseConnection> }) => 
      apiService.connections.update(id, updates),
    {
      onSuccess: () => {
        toast.success('Connection updated successfully');
        queryClient.invalidateQueries('connections');
        setEditingConnection(null);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update connection');
      },
    }
  );

  // Create database mutation
  const createDatabaseMutation = useMutation(
    ({ name, options }: { name: string; options?: { charset?: string; collation?: string } }) =>
      apiService.databases.create(name, options),
    {
      onSuccess: () => {
        toast.success('Database created successfully');
        queryClient.invalidateQueries(['databases']);
        handleCloseNewDatabaseDialog();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create database');
      },
    }
  );

  const handleConnect = (connection: DatabaseConnection) => {
    connectMutation.mutate(connection.id);
  };

  const handleCloseNewDatabaseDialog = () => {
    setShowNewDatabaseDialog(false);
    setNewDatabaseName('');
    setNewDatabaseCharset('');
    setNewDatabaseCollation('');
  };

  const handleDisconnect = () => {
    setCurrentConnection(null);
    setCurrentDatabase(null);
    localStorage.removeItem('token');
    
    // Dispatch auth change event
    window.dispatchEvent(new Event('authChange'));
    
    toast.success('Disconnected');
  };

  const handleDatabaseClick = (databaseName: string) => {
    setCurrentDatabase(databaseName);
    navigate(`/database/${databaseName}`);
  };

  const handleDeleteConnection = (connectionId: string) => {
    if (window.confirm('Are you sure you want to delete this connection?')) {
      deleteConnectionMutation.mutate(connectionId);
    }
  };

  const stats = [
    {
      title: 'Total Connections',
      value: connections.length,
      icon: <DatabaseIcon />,
      color: 'primary',
    },
    {
      title: 'Active Connection',
      value: state.currentConnection ? 'Connected' : 'None',
      icon: <CheckCircleIcon />,
      color: state.currentConnection ? 'success' : 'default',
    },
    {
      title: 'Databases',
      value: databases.length,
      icon: <TableIcon />,
      color: 'secondary',
    },
    {
      title: 'Server Status',
      value: serverInfo?.status || 'Unknown',
      icon: <SpeedIcon />,
      color: serverInfo?.status === 'online' ? 'success' : 'error',
    },
  ];

  return (
    <Box>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Typography variant="body2" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <HomeIcon fontSize="small" />
            Dashboard
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your database connections and monitor server status
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: `${stat.color}.main`,
                      color: 'white',
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" component="div">
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Connections */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Database Connections</Typography>
                <Button
                  startIcon={<AddIcon />}
                  variant="contained"
                  onClick={() => setEditingConnection({
                    id: '',
                    name: '',
                    type: 'mysql',
                    host: '',
                    port: 3306,
                    username: '',
                    password: '',
                    database: '',
                    ssl: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  })}
                >
                  New Connection
                </Button>
              </Box>

              {connectionsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List>
                  {connections.map((connection) => (
                    <ListItem
                      key={connection.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        bgcolor: state.currentConnection?.id === connection.id ? 'action.selected' : 'background.paper',
                      }}
                    >
                      <ListItemIcon>
                        <DatabaseIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={connection.name}
                        secondary={`${connection.type} • ${connection.host}:${connection.port}`}
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {state.currentConnection?.id === connection.id ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleDisconnect}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleConnect(connection)}
                            disabled={connectMutation.isLoading}
                          >
                            Connect
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => setEditingConnection(connection)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteConnection(connection.id)}
                          disabled={deleteConnectionMutation.isLoading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Databases */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Databases</Typography>
                {state.currentConnection && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      startIcon={<AddIcon />}
                      variant="contained"
                      size="small"
                      onClick={() => setShowNewDatabaseDialog(true)}
                    >
                      Add Database
                    </Button>
                    <IconButton onClick={() => queryClient.invalidateQueries(['databases'])}>
                      <RefreshIcon />
                    </IconButton>
                  </Box>
                )}
              </Box>

              {!state.currentConnection ? (
                <Alert severity="info">
                  Please connect to a database to view databases
                </Alert>
              ) : databasesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List>
                  {databases.map((database) => (
                    <ListItem
                      key={database.name}
                      button
                      onClick={() => handleDatabaseClick(database.name)}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon>
                        <TableIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={database.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              Tables: {database.tables} • Views: {database.views}
                            </Typography>
                            {database.size && (
                              <Typography variant="caption" color="text.secondary">
                                Size: {database.size} MB
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Server Info */}
        {state.currentConnection && serverInfo && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Server Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Version
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {serverInfo.version}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Uptime
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {Math.floor(serverInfo.uptime / 3600)}h {Math.floor((serverInfo.uptime % 3600) / 60)}m
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={serverInfo.status}
                      color={serverInfo.status === 'online' ? 'success' : 'error'}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Active Processes
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {serverInfo.processes.length}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Connection Edit Dialog */}
      <Dialog
        open={!!editingConnection}
        onClose={() => setEditingConnection(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingConnection ? 'Edit Connection' : 'New Connection'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Connection Name"
                  value={editingConnection?.name || ''}
                  onChange={(e) => setEditingConnection(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Database Type</InputLabel>
                  <Select
                    value={editingConnection?.type || 'mysql'}
                    onChange={(e) => setEditingConnection(prev => prev ? { ...prev, type: e.target.value as any } : null)}
                    label="Database Type"
                  >
                    <MenuItem value="mysql">MySQL</MenuItem>
                    <MenuItem value="mariadb">MariaDB</MenuItem>
                    <MenuItem value="postgresql">PostgreSQL</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Port"
                  type="number"
                  value={editingConnection?.port || 3306}
                  onChange={(e) => setEditingConnection(prev => prev ? { ...prev, port: parseInt(e.target.value) } : null)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Host"
                  value={editingConnection?.host || ''}
                  onChange={(e) => setEditingConnection(prev => prev ? { ...prev, host: e.target.value } : null)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Username"
                  value={editingConnection?.username || ''}
                  onChange={(e) => setEditingConnection(prev => prev ? { ...prev, username: e.target.value } : null)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={editingConnection?.password || ''}
                  onChange={(e) => setEditingConnection(prev => prev ? { ...prev, password: e.target.value } : null)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Database"
                  value={editingConnection?.database || ''}
                  onChange={(e) => setEditingConnection(prev => prev ? { ...prev, database: e.target.value } : null)}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingConnection(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (editingConnection) {
                if (editingConnection.id) {
                  // Update existing connection
                  updateConnectionMutation.mutate({
                    id: editingConnection.id,
                    updates: editingConnection
                  });
                } else {
                  // Create new connection
                  createConnectionMutation.mutate(editingConnection);
                }
              }
            }}
            disabled={createConnectionMutation.isLoading || updateConnectionMutation.isLoading}
          >
            {editingConnection?.id ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Database Dialog */}
      <Dialog open={showNewDatabaseDialog} onClose={handleCloseNewDatabaseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Database</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Database Name"
                  value={newDatabaseName}
                  onChange={(e) => setNewDatabaseName(e.target.value)}
                  placeholder="Enter database name"
                  required
                />
              </Grid>
              {state.currentConnection?.type === 'mysql' || state.currentConnection?.type === 'mariadb' ? (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Character Set"
                      value={newDatabaseCharset}
                      onChange={(e) => setNewDatabaseCharset(e.target.value)}
                      placeholder="e.g., utf8mb4"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Collation"
                      value={newDatabaseCollation}
                      onChange={(e) => setNewDatabaseCollation(e.target.value)}
                      placeholder="e.g., utf8mb4_unicode_ci"
                    />
                  </Grid>
                </>
              ) : null}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewDatabaseDialog}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (newDatabaseName.trim()) {
                createDatabaseMutation.mutate({
                  name: newDatabaseName.trim(),
                  options: {
                    charset: newDatabaseCharset || undefined,
                    collation: newDatabaseCollation || undefined,
                  }
                });
              }
            }}
            disabled={createDatabaseMutation.isLoading || !newDatabaseName.trim()}
          >
            {createDatabaseMutation.isLoading ? 'Creating...' : 'Create Database'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
