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
  const [showNewConnectionDialog, setShowNewConnectionDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);

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
    (connectionId: string) => {
      const connection = connections.find(c => c.id === connectionId);
      if (!connection) throw new Error('Connection not found');
      
      // Store connection in context
      setCurrentConnection(connection);
      
      // Store token (in real app, this would come from login)
      localStorage.setItem('token', 'dummy-token');
      
      return Promise.resolve();
    },
    {
      onSuccess: () => {
        toast.success('Connected successfully!');
        queryClient.invalidateQueries(['databases']);
        queryClient.invalidateQueries(['serverInfo']);
      },
      onError: (error: any) => {
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

  const handleConnect = (connection: DatabaseConnection) => {
    connectMutation.mutate(connection.id);
  };

  const handleDisconnect = () => {
    setCurrentConnection(null);
    setCurrentDatabase(null);
    localStorage.removeItem('token');
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
                  onClick={() => setShowNewConnectionDialog(true)}
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
                  <IconButton onClick={() => queryClient.invalidateQueries(['databases'])}>
                    <RefreshIcon />
                  </IconButton>
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
    </Box>
  );
}
