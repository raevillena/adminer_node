import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  History as HistoryIcon,
  PlayArrow as ExecuteIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { apiService } from '../services/api';
import SqlEditor from '../components/SqlEditor';
import { QueryResult, QueryTab } from '../../shared/types';

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
      id={`query-tabpanel-${index}`}
      aria-labelledby={`query-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3, height: '100%' }}>{children}</Box>}
    </div>
  );
}

export default function QueryPage() {
  const { state, addQueryTab, updateQueryTab, removeQueryTab, setActiveQueryTab, getActiveQueryTab } = useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savedQueryName, setSavedQueryName] = useState('');

  // Fetch query history
  const { data: queryHistory = [], isLoading: historyLoading } = useQuery(
    'queryHistory',
    apiService.query.getHistory,
    {
      enabled: !!state.currentConnection,
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to load query history');
      },
    }
  );

  // Fetch query suggestions
  const { data: suggestions } = useQuery(
    ['querySuggestions', state.currentDatabase],
    () => apiService.query.getSuggestions(state.currentDatabase || undefined),
    {
      enabled: !!state.currentConnection,
      onError: (error: any) => {
        console.warn('Failed to load query suggestions:', error);
      },
    }
  );

  // Fetch available tables for the current database
  const { data: availableTables = [] } = useQuery(
    ['tables', state.currentDatabase],
    () => apiService.tables.getAll(state.currentDatabase || ''),
    {
      enabled: !!state.currentConnection && !!state.currentDatabase,
      onError: (error: any) => {
        console.warn('Failed to load tables:', error);
      },
    }
  );

  // Execute query mutation
  const executeQueryMutation = useMutation(
    ({ query, confirmDangerous }: { query: string; confirmDangerous?: boolean }) =>
      apiService.query.execute(query, [], confirmDangerous),
    {
      onSuccess: (result, variables) => {
        const activeTab = getActiveQueryTab();
        if (activeTab) {
          updateQueryTab(activeTab.id, {
            result,
            isDirty: false,
          });
        }
        toast.success(`Query executed successfully in ${result.executionTime}ms`);
      },
      onError: (error: any) => {
        const activeTab = getActiveQueryTab();
        if (activeTab) {
          updateQueryTab(activeTab.id, {
            result: undefined,
            isDirty: false,
          });
        }
        toast.error(error.response?.data?.message || 'Query execution failed');
      },
    }
  );

  // Create new query tab
  const createNewTab = () => {
    const newTab: QueryTab = {
      id: Date.now().toString(),
      name: `Query ${state.queryTabs.length + 1}`,
      query: '',
      isDirty: false,
    };
    addQueryTab(newTab);
    setActiveTab(state.queryTabs.length);
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const tab = state.queryTabs[newValue];
    if (tab) {
      setActiveQueryTab(tab.id);
    }
  };

  // Handle tab close
  const handleTabClose = (event: React.MouseEvent, tabIndex: number) => {
    event.stopPropagation();
    const tab = state.queryTabs[tabIndex];
    if (tab) {
      removeQueryTab(tab.id);
      if (activeTab >= tabIndex && activeTab > 0) {
        setActiveTab(activeTab - 1);
      }
    }
  };

  // Handle query execution
  const handleExecuteQuery = (query: string) => {
    if (!state.currentConnection) {
      toast.error('No active connection');
      return;
    }

    executeQueryMutation.mutate({ query });
  };

  // Handle query save
  const handleSaveQuery = (query: string) => {
    if (!savedQueryName.trim()) {
      toast.error('Please enter a name for the query');
      return;
    }

    // In a real app, you'd save this to the backend
    toast.success('Query saved successfully');
    setShowSaveDialog(false);
    setSavedQueryName('');
  };

  // Handle query copy
  const handleCopyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
    toast.success('Query copied to clipboard');
  };

  // Handle query clear
  const handleClearQuery = () => {
    const activeTab = getActiveQueryTab();
    if (activeTab) {
      updateQueryTab(activeTab.id, {
        query: '',
        result: undefined,
        isDirty: false,
      });
    }
  };

  // Handle query change
  const handleQueryChange = (query: string) => {
    const activeTab = getActiveQueryTab();
    if (activeTab) {
      updateQueryTab(activeTab.id, {
        query,
        isDirty: true,
      });
    }
  };

  // Handle suggestion select
  const handleSuggestionSelect = (suggestion: string) => {
    const activeTab = getActiveQueryTab();
    if (activeTab) {
      const currentQuery = activeTab.query;
      const newQuery = currentQuery + (currentQuery ? ' ' : '') + suggestion;
      updateQueryTab(activeTab.id, {
        query: newQuery,
        isDirty: true,
      });
    }
  };

  // Load query from history
  const loadQueryFromHistory = (query: string) => {
    const activeTab = getActiveQueryTab();
    if (activeTab) {
      updateQueryTab(activeTab.id, {
        query,
        isDirty: true,
      });
    }
    setShowHistoryDialog(false);
  };

  // Create initial tab if none exist
  useEffect(() => {
    if (state.queryTabs.length === 0) {
      createNewTab();
    }
  }, []);

  if (!state.currentConnection) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Query Editor
        </Typography>
        <Alert severity="info">
          Please connect to a database to use the query editor.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Query Editor
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={createNewTab}
          sx={{ mr: 1 }}
        >
          New Query
        </Button>
        <Tooltip title="Query History">
          <IconButton onClick={() => setShowHistoryDialog(true)}>
            <HistoryIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tabs */}
      {state.queryTabs.length > 0 && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {state.queryTabs.map((tab, index) => (
              <Tab
                key={`tab-${tab.id}-${index}`}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{tab.name}</span>
                    {tab.isDirty && <Chip label="*" size="small" color="warning" />}
                    <Box
                      component="span"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTabClose(e, index);
                      }}
                      sx={{ 
                        ml: 1, 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': { opacity: 0.7 }
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </Box>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>
      )}

      {/* Query Editor and Results */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {state.queryTabs.map((tab, index) => (
          <TabPanel key={`tab-${tab.id}-${index}`} value={activeTab} index={index}>
            <Grid container spacing={2} sx={{ height: '100%' }}>
              {/* SQL Editor */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ height: '100%', p: 0 }}>
                    <SqlEditor
                      value={tab.query}
                      onChange={handleQueryChange}
                      onExecute={handleExecuteQuery}
                      onSave={() => setShowSaveDialog(true)}
                      onClear={handleClearQuery}
                      onCopy={handleCopyQuery}
                      result={tab.result}
                      isLoading={executeQueryMutation.isLoading}
                      suggestions={suggestions}
                      onSuggestionSelect={handleSuggestionSelect}
                      height="calc(100vh - 400px)"
                      currentDatabase={state.currentDatabase || undefined}
                      availableTables={availableTables}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Results */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ height: '100%', p: 0 }}>
                    {tab.result ? (
                      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Result Header */}
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                          <Typography variant="h6" gutterBottom>
                            Query Results
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              label={`${tab.result.rows.length} rows`}
                              size="small"
                              color="primary"
                            />
                            <Chip
                              label={`${tab.result.executionTime}ms`}
                              size="small"
                              color="secondary"
                            />
                            {tab.result.affectedRows && (
                              <Chip
                                label={`${tab.result.affectedRows} affected`}
                                size="small"
                                color="info"
                              />
                            )}
                          </Box>
                        </Box>

                        {/* Result Data */}
                        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                          {tab.result.rows.length > 0 ? (
                            <Box sx={{ overflow: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    {tab.result.columns.map((column, index) => (
                                      <th
                                        key={index}
                                        style={{
                                          border: '1px solid #ddd',
                                          padding: '8px',
                                          backgroundColor: '#f5f5f5',
                                          textAlign: 'left',
                                        }}
                                      >
                                        {column}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tab.result.rows.slice(0, 100).map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                      {tab.result.columns.map((column, colIndex) => (
                                        <td
                                          key={colIndex}
                                          style={{
                                            border: '1px solid #ddd',
                                            padding: '8px',
                                            maxWidth: '200px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {row[column] !== null ? String(row[column]) : 'NULL'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {tab.result.rows.length > 100 && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  Showing first 100 rows of {tab.result.rows.length} total rows
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No data returned
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 3,
                        }}
                      >
                        <Typography variant="body1" color="text.secondary">
                          Execute a query to see results here
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        ))}
      </Box>

      {/* Query History Dialog */}
      <Dialog
        open={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Query History</DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : queryHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No query history found
            </Typography>
          ) : (
            <List>
              {queryHistory.map((query, index) => (
                <React.Fragment key={`history-${index}-${query.executedAt}`}>
                  <ListItem
                    component="div"
                    onClick={() => loadQueryFromHistory(query.query)}
                    sx={{ 
                      flexDirection: 'column', 
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <ListItemText
                      primary={query.query}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            Executed: {new Date(query.executedAt).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Duration: {query.executionTime}ms
                          </Typography>
                          {query.success ? (
                            <Chip label="Success" size="small" color="success" />
                          ) : (
                            <Chip label="Failed" size="small" color="error" />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < queryHistory.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Save Query Dialog */}
      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Query</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Query Name"
            fullWidth
            variant="outlined"
            value={savedQueryName}
            onChange={(e) => setSavedQueryName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={() => handleSaveQuery(getActiveQueryTab()?.query || '')} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
