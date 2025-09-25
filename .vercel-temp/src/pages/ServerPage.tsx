import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Computer as ComputerIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';

// Type definitions for server data
interface ServerInfo {
  version: string;
  uptime: number;
  status: string;
  variables: Record<string, string>;
  processes: Process[];
}

interface Process {
  id: number;
  user: string;
  host: string;
  database: string;
  command: string;
  time: number;
  state: string;
  info?: string;
}

interface DatabaseStats {
  totalSize: number;
  tableCount: number;
  largestTables: Array<{
    table_name: string;
    size_mb: number;
    row_count?: number;
  }>;
}

export default function ServerPage() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processPage, setProcessPage] = useState(0);
  const [processRowsPerPage, setProcessRowsPerPage] = useState(10);
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [processToKill, setProcessToKill] = useState<Process | null>(null);

  // Load server information
  const loadServerInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [serverData, statsData] = await Promise.all([
        apiService.server.getInfo(),
        apiService.server.getStats(),
      ]);
      
      setServerInfo(serverData);
      setDatabaseStats(statsData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load server information');
    } finally {
      setLoading(false);
    }
  };

  // Kill a process
  const handleKillProcess = async () => {
    if (!processToKill) return;
    
    try {
      await apiService.server.killProcess(processToKill.id.toString());
      setKillDialogOpen(false);
      setProcessToKill(null);
      // Refresh the processes list
      loadServerInfo();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to kill process');
    }
  };

  // Format uptime in human readable format
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status color
  const getStatusColor = (status: string): 'success' | 'error' | 'warning' => {
    switch (status.toLowerCase()) {
      case 'online':
      case 'running':
        return 'success';
      case 'offline':
      case 'stopped':
        return 'error';
      default:
        return 'warning';
    }
  };

  useEffect(() => {
    loadServerInfo();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={loadServerInfo}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Server Information
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadServerInfo}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Server Status Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ComputerIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Server Status</Typography>
              </Box>
              
              {serverInfo && (
                <Box>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                      Status:
                    </Typography>
                    <Chip
                      label={serverInfo.status}
                      color={getStatusColor(serverInfo.status)}
                      size="small"
                      icon={serverInfo.status === 'online' ? <CheckCircleIcon /> : <ErrorIcon />}
                    />
                  </Box>
                  
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                      Version:
                    </Typography>
                    <Typography variant="body2">{serverInfo.version}</Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                      Uptime:
                    </Typography>
                    <Typography variant="body2">{formatUptime(serverInfo.uptime)}</Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                      Active Processes:
                    </Typography>
                    <Typography variant="body2">{serverInfo.processes.length}</Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Database Statistics Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <StorageIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Database Statistics</Typography>
              </Box>
              
              {databaseStats && (
                <Box>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                      Total Size:
                    </Typography>
                    <Typography variant="body2">
                      {typeof databaseStats.totalSize === 'number' 
                        ? formatFileSize(databaseStats.totalSize * 1024 * 1024) 
                        : 'N/A'
                      }
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                      Tables:
                    </Typography>
                    <Typography variant="body2">
                      {typeof databaseStats.tableCount === 'number' ? databaseStats.tableCount : 'N/A'}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                      Largest Tables:
                    </Typography>
                    <Typography variant="body2">
                      {Array.isArray(databaseStats.largestTables) ? databaseStats.largestTables.length : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Active Processes */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SpeedIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Active Processes</Typography>
              </Box>
              
              {serverInfo && serverInfo.processes.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Host</TableCell>
                        <TableCell>Database</TableCell>
                        <TableCell>Command</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>State</TableCell>
                        <TableCell>Info</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {serverInfo.processes
                        .slice(processPage * processRowsPerPage, processPage * processRowsPerPage + processRowsPerPage)
                        .map((process) => (
                        <TableRow key={process.id}>
                          <TableCell>{process.id}</TableCell>
                          <TableCell>{process.user}</TableCell>
                          <TableCell>{process.host}</TableCell>
                          <TableCell>{process.database || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={process.command}
                              size="small"
                              variant="outlined"
                              color={process.command === 'Query' ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{process.time}s</TableCell>
                          <TableCell>
                            <Chip
                              label={process.state}
                              size="small"
                              color={process.state === 'Sleep' ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell>
                            {process.info && (
                              <Tooltip title={process.info} placement="top">
                                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                  {process.info}
                                </Typography>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Kill Process">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setProcessToKill(process);
                                  setKillDialogOpen(true);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={serverInfo.processes.length}
                    rowsPerPage={processRowsPerPage}
                    page={processPage}
                    onPageChange={(_, newPage) => setProcessPage(newPage)}
                    onRowsPerPageChange={(event) => {
                      setProcessRowsPerPage(parseInt(event.target.value, 10));
                      setProcessPage(0);
                    }}
                  />
                </TableContainer>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No active processes found.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Server Variables */}
        {serverInfo && Object.keys(serverInfo.variables).length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <MemoryIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Server Variables</Typography>
                </Box>
                
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      Configuration Variables ({Object.keys(serverInfo.variables).length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Variable</TableCell>
                            <TableCell>Value</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(serverInfo.variables).map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell>
                                <Typography variant="body2" fontFamily="monospace">
                                  {key}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontFamily="monospace">
                                  {value}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Largest Tables */}
        {databaseStats && Array.isArray(databaseStats.largestTables) && databaseStats.largestTables.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <StorageIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Largest Tables</Typography>
                </Box>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Table Name</TableCell>
                        <TableCell align="right">Size (MB)</TableCell>
                        <TableCell align="right">Rows</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {databaseStats.largestTables.map((table, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {table?.table_name || 'Unknown'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {typeof table?.size_mb === 'number' ? table.size_mb.toFixed(2) : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {typeof table?.row_count === 'number' ? table.row_count.toLocaleString() : '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Kill Process Dialog */}
      <Dialog
        open={killDialogOpen}
        onClose={() => setKillDialogOpen(false)}
        aria-labelledby="kill-process-dialog-title"
      >
        <DialogTitle id="kill-process-dialog-title">
          Kill Process
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to kill process {processToKill?.id}? This action cannot be undone.
          </DialogContentText>
          {processToKill && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                <strong>User:</strong> {processToKill.user}<br />
                <strong>Host:</strong> {processToKill.host}<br />
                <strong>Database:</strong> {processToKill.database || 'None'}<br />
                <strong>Command:</strong> {processToKill.command}<br />
                <strong>State:</strong> {processToKill.state}<br />
                <strong>Time:</strong> {processToKill.time}s
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKillDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleKillProcess} color="error" variant="contained">
            Kill Process
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
