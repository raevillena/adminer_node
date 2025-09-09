import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Storage as DatabaseIcon,
  TableChart as TableIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Schema as SchemaIcon,
  DataObject as DataIcon,
  AccountTree as ErdIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { apiService } from '../services/api';
import ErdVisualization from '../components/ErdVisualization';
import { Database, Table as TableType } from '../../shared/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`database-tabpanel-${index}`}
      aria-labelledby={`database-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function DatabasePage() {
  const { databaseName } = useParams<{ databaseName: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, setCurrentDatabase } = useApp();
  const [activeTab, setActiveTab] = useState(0);

  // Set current database in context
  useEffect(() => {
    if (databaseName) {
      setCurrentDatabase(databaseName);
    }
  }, [databaseName, setCurrentDatabase]);

  // Fetch database information
  const { data: database, isLoading: databaseLoading } = useQuery(
    ['database', databaseName],
    () => apiService.databases.getByName(databaseName!),
    {
      enabled: !!databaseName && !!state.currentConnection,
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to load database information');
      },
    }
  );

  // Fetch tables
  const { data: tables = [], isLoading: tablesLoading } = useQuery(
    ['tables', databaseName],
    () => apiService.tables.getAll(databaseName!),
    {
      enabled: !!databaseName && !!state.currentConnection,
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to load tables');
      },
    }
  );

  // Fetch views
  const views = tables.filter(table => table.type === 'view');
  const regularTables = tables.filter(table => table.type === 'table');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleTableClick = (tableName: string) => {
    navigate(`/database/${databaseName}/table/${tableName}`);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries(['database', databaseName]);
    queryClient.invalidateQueries(['tables', databaseName]);
  };

  if (!state.currentConnection) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Database: {databaseName}
        </Typography>
        <Alert severity="info">
          Please connect to a database to view database information.
        </Alert>
      </Box>
    );
  }

  if (databaseLoading || tablesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Database: {databaseName}
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Database Info Cards */}
      {database && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <DatabaseIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Size</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {database.size || 0} MB
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TableIcon sx={{ mr: 1, color: 'secondary.main' }} />
                  <Typography variant="h6">Tables</Typography>
                </Box>
                <Typography variant="h4" color="secondary">
                  {database.tables || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ViewIcon sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="h6">Views</Typography>
                </Box>
                <Typography variant="h4" color="info.main">
                  {database.views || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SchemaIcon sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="h6">Collation</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {database.collation || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab
            icon={<DataIcon />}
            label="Tables & Views"
            iconPosition="start"
          />
          <Tab
            icon={<ErdIcon />}
            label="ERD Diagram"
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {/* Tables */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TableIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Tables ({regularTables.length})</Typography>
                </Box>
                <List>
                  {regularTables.map((table) => (
                    <ListItem
                      key={table.name}
                      button
                      onClick={() => handleTableClick(table.name)}
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
                        primary={table.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              Rows: {table.rows || 'N/A'} • Size: {table.size || 0} MB
                            </Typography>
                            {table.engine && (
                              <Typography variant="caption" display="block">
                                Engine: {table.engine}
                              </Typography>
                            )}
                            {table.comment && (
                              <Typography variant="caption" display="block">
                                {table.comment}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Views */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ViewIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Views ({views.length})</Typography>
                </Box>
                <List>
                  {views.map((view) => (
                    <ListItem
                      key={view.name}
                      button
                      onClick={() => handleTableClick(view.name)}
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
                        <ViewIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={view.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              Type: View • Size: {view.size || 0} MB
                            </Typography>
                            {view.comment && (
                              <Typography variant="caption" display="block">
                                {view.comment}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {databaseName && (
          <ErdVisualization
            databaseName={databaseName}
            onTableSelect={handleTableClick}
          />
        )}
      </TabPanel>
    </Box>
  );
}
