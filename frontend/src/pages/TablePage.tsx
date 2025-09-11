import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  CircularProgress,
  Pagination,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Menu,
  ListItemIcon,
  ListItemText,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon,
  EditNote as EditNoteIcon,
  Key as KeyIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Link as LinkIcon,
  AccountTree as AccountTreeIcon,
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { useApp } from '../contexts/AppContext';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
  autoIncrement: boolean;
  comment: string;
  key: string;
  extra: string;
}

interface Index {
  name: string;
  type: string;
  columns: string[];
  unique: boolean;
  comment: string;
}


export default function TablePage() {
  const { databaseName, tableName } = useParams<{ databaseName: string; tableName: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setCurrentTable } = useApp();
  
  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(25);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDropDialog, setShowDropDialog] = useState(false);
  const [showAddIndexDialog, setShowAddIndexDialog] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [newColumnData, setNewColumnData] = useState({
    name: '',
    type: 'VARCHAR(255)',
    nullable: true,
    defaultValue: '',
    autoIncrement: false,
    comment: '',
    after: '',
  });
  const [newIndexData, setNewIndexData] = useState({
    name: '',
    columns: [] as string[],
    type: 'INDEX' as 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL',
    comment: '',
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Set current table in context
  useEffect(() => {
    if (tableName) {
      setCurrentTable(tableName);
    }
    return () => {
      setCurrentTable(null);
    };
  }, [tableName, setCurrentTable]);

  // Fetch table structure
  const { data: structure, isLoading: structureLoading, refetch: refetchStructure } = useQuery({
    queryKey: ['table-structure', databaseName, tableName],
    queryFn: () => apiService.tables.getStructure(databaseName!, tableName!),
    enabled: !!databaseName && !!tableName,
  });

  // Fetch table data
  const { data: tableData, isLoading: dataLoading, error: dataError, refetch: refetchData } = useQuery({
    queryKey: ['table-data', databaseName, tableName, page, rowsPerPage],
    queryFn: () => {
      console.log('🚀 Executing data query for:', databaseName, tableName);
      return apiService.data.getTableData(databaseName!, tableName!, {
        page: page + 1, // API uses 1-based pagination
        pageSize: rowsPerPage,
      });
    },
    enabled: !!databaseName && !!tableName,
    onSuccess: (data) => {
      console.log('✅ Data query successful:', data);
    },
    onError: (error) => {
      console.error('❌ Data query failed:', error);
    },
  });

  // Debug logging
  console.log('TablePage Debug:', {
    databaseName,
    tableName,
    tableData,
    dataLoading,
    dataError,
    activeTab,
    'API call enabled': !!databaseName && !!tableName
  });


  // Mutations
  const updateRowMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      apiService.data.updateRow(databaseName!, tableName!, id, data),
    onSuccess: () => {
      toast.success('Row updated successfully');
      refetchData();
      setEditingRow(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update row');
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: (id: string) => apiService.data.deleteRow(databaseName!, tableName!, id),
    onSuccess: () => {
      toast.success('Row deleted successfully');
      refetchData();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete row');
    },
  });

  const addRowMutation = useMutation({
    mutationFn: (data: Record<string, any>) => apiService.data.createRow(databaseName!, tableName!, data),
    onSuccess: () => {
      toast.success('Row added successfully');
      refetchData();
      setShowAddRowDialog(false);
      setNewRowData({});
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add row');
    },
  });

  const addColumnMutation = useMutation({
    mutationFn: (columnData: any) => apiService.tables.addColumn(databaseName!, tableName!, columnData),
    onSuccess: () => {
      toast.success('Column added successfully');
      refetchStructure();
      setShowAddColumnDialog(false);
      setNewColumnData({
        name: '',
        type: 'VARCHAR(255)',
        nullable: true,
        defaultValue: '',
        autoIncrement: false,
        comment: '',
        after: '',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add column');
    },
  });

  const renameTableMutation = useMutation({
    mutationFn: (newName: string) => apiService.tables.rename(databaseName!, tableName!, newName),
    onSuccess: () => {
      toast.success('Table renamed successfully');
      queryClient.invalidateQueries(['tables', databaseName]);
      setShowRenameDialog(false);
      setNewTableName('');
      navigate(`/database/${databaseName}/table/${newTableName}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to rename table');
    },
  });

  const dropTableMutation = useMutation({
    mutationFn: () => apiService.tables.drop(databaseName!, tableName!),
    onSuccess: () => {
      toast.success('Table dropped successfully');
      queryClient.invalidateQueries(['tables', databaseName]);
      navigate(`/database/${databaseName}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to drop table');
    },
  });

  const createIndexMutation = useMutation({
    mutationFn: (indexData: any) => apiService.tables.createIndex(databaseName!, tableName!, indexData),
    onSuccess: () => {
      toast.success('Index created successfully');
      refetchStructure();
      setShowAddIndexDialog(false);
      setNewIndexData({
        name: '',
        columns: [],
        type: 'INDEX',
        comment: '',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create index');
    },
  });

  const dropIndexMutation = useMutation({
    mutationFn: (indexName: string) => apiService.tables.dropIndex(databaseName!, tableName!, indexName),
    onSuccess: () => {
      toast.success('Index dropped successfully');
      refetchStructure();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to drop index');
    },
  });

  const handleEditRow = (row: any) => {
    setEditingRow({ ...row });
  };

  const handleSaveRow = () => {
    if (editingRow) {
      const { id, ...data } = editingRow;
      updateRowMutation.mutate({ id, data });
    }
  };

  const handleDeleteRow = (id: string) => {
    if (window.confirm('Are you sure you want to delete this row?')) {
      deleteRowMutation.mutate(id);
    }
  };

  const handleAddRow = () => {
    if (Object.keys(newRowData).length > 0) {
      addRowMutation.mutate(newRowData);
    }
  };

  const handleAddColumn = () => {
    if (newColumnData.name.trim()) {
      addColumnMutation.mutate(newColumnData);
    }
  };

  const handleRenameTable = () => {
    if (newTableName.trim() && newTableName !== tableName) {
      renameTableMutation.mutate(newTableName.trim());
    }
  };

  const handleDropTable = () => {
    if (window.confirm(`Are you sure you want to drop the table "${tableName}"? This action cannot be undone.`)) {
      dropTableMutation.mutate();
    }
  };

  const handleAddIndex = () => {
    if (newIndexData.name.trim() && newIndexData.columns.length > 0) {
      createIndexMutation.mutate(newIndexData);
    }
  };

  const handleDropIndex = (indexName: string) => {
    if (window.confirm(`Are you sure you want to drop the index "${indexName}"?`)) {
      dropIndexMutation.mutate(indexName);
    }
  };

  const handleAddColumnToIndex = (columnName: string) => {
    if (!newIndexData.columns.includes(columnName)) {
      setNewIndexData({
        ...newIndexData,
        columns: [...newIndexData.columns, columnName],
      });
    }
  };

  const handleRemoveColumnFromIndex = (columnName: string) => {
    setNewIndexData({
      ...newIndexData,
      columns: newIndexData.columns.filter(col => col !== columnName),
    });
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const renderTableStructure = () => {
    // Helper function to check if a column is a foreign key
    const isForeignKey = (columnName: string) => {
      return structure?.foreignKeys?.some(fk => fk.column === columnName) || false;
    };

    // Helper function to get foreign key info for a column
    const getForeignKeyInfo = (columnName: string) => {
      return structure?.foreignKeys?.find(fk => fk.column === columnName);
    };

  return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Table Structure</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => setShowAddColumnDialog(true)}
          >
            Add Column
          </Button>
        </Box>

        {structureLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : structure ? (
          <>
            {/* Compact Columns Table */}
            <TableContainer component={Paper} sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ py: 1, px: 1 }}>Column</TableCell>
                    <TableCell sx={{ py: 1, px: 1 }}>Type</TableCell>
                    <TableCell sx={{ py: 1, px: 1 }}>Null</TableCell>
                    <TableCell sx={{ py: 1, px: 1 }}>Key</TableCell>
                    <TableCell sx={{ py: 1, px: 1 }}>Default</TableCell>
                    <TableCell sx={{ py: 1, px: 1 }}>Extra</TableCell>
                    <TableCell sx={{ py: 1, px: 1 }}>Comment</TableCell>
                    <TableCell sx={{ py: 1, px: 1 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {structure.columns.map((column: Column) => {
                    const fkInfo = getForeignKeyInfo(column.name);
                    return (
                      <TableRow key={column.name} sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {column.key === 'PRI' && <KeyIcon color="primary" fontSize="small" />}
                            {isForeignKey(column.name) && <LinkIcon color="secondary" fontSize="small" />}
                            {column.autoIncrement && <SpeedIcon color="secondary" fontSize="small" />}
                            <Typography variant="caption" fontWeight="medium">
                              {column.name}
                            </Typography>
                            {fkInfo && (
                              <Tooltip title={`Foreign Key → ${fkInfo.referencedTable}.${fkInfo.referencedColumn}`}>
                                <Chip
                                  label={`→ ${fkInfo.referencedTable}`}
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          <Chip 
                            label={column.type} 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          <Chip
                            label={column.nullable ? 'YES' : 'NO'}
                            size="small"
                            color={column.nullable ? 'default' : 'error'}
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          {column.key && (
                            <Chip
                              label={column.key}
                              size="small"
                              color={column.key === 'PRI' ? 'primary' : 'default'}
                              sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          <Typography variant="caption">
                            {column.defaultValue !== null ? String(column.defaultValue) : 'NULL'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          <Typography variant="caption">{column.extra}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          <Typography variant="caption">{column.comment || '-'}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1, px: 1 }}>
                          <IconButton size="small" onClick={() => {/* TODO: Edit column */}}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => {/* TODO: Delete column */}}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Compact Summary Section */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {/* Primary Key Summary - Compact */}
              {structure.columns.some((col: Column) => col.key === 'PRI') && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <KeyIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight="bold">Primary Key</Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {structure.columns
                          .filter((col: Column) => col.key === 'PRI')
                          .map((col: Column) => (
                            <Chip
                              key={col.name}
                              label={col.name}
                              size="small"
                              color="primary"
                              icon={<KeyIcon />}
                            />
                          ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Foreign Key Summary - Compact */}
              {structure.foreignKeys && structure.foreignKeys.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AccountTreeIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight="bold">
                          Foreign Keys ({structure.foreignKeys.length})
                        </Typography>
                      </Box>
                      
                      <Box sx={{ maxHeight: 120, overflowY: 'auto' }}>
                        {structure.foreignKeys.map((fk: any, index: number) => (
                          <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <LinkIcon color="secondary" fontSize="small" />
                              <Typography variant="caption" fontWeight="bold">
                                {fk.name}
                              </Typography>
                            </Box>
                            
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              {tableName}.{fk.column} → {fk.referencedTable}.{fk.referencedColumn}
                            </Typography>
                            
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Chip
                                label={`UPDATE ${fk.onUpdate}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                              <Chip
                                label={`DELETE ${fk.onDelete}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>

            {/* Compact Indexes Section */}
            {structure?.indexes && structure.indexes.length > 0 && (
              <Card variant="outlined" sx={{ mt: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <SpeedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Indexes ({structure.indexes.length})
                    </Typography>
                  </Box>
                  
                  <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ py: 1, px: 1 }}>Name</TableCell>
                          <TableCell sx={{ py: 1, px: 1 }}>Type</TableCell>
                          <TableCell sx={{ py: 1, px: 1 }}>Columns</TableCell>
                          <TableCell sx={{ py: 1, px: 1 }}>Unique</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {structure.indexes.map((index: Index) => (
                          <TableRow key={index.name} sx={{ '&:last-child td': { border: 0 } }}>
                            <TableCell sx={{ py: 1, px: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {index.type === 'PRIMARY' && <KeyIcon color="primary" fontSize="small" />}
                                {index.unique && <SpeedIcon color="secondary" fontSize="small" />}
                                <Typography variant="caption" fontWeight="medium">
                                  {index.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 1 }}>
                              <Chip
                                label={index.type}
                                size="small"
                                color={index.type === 'PRIMARY' ? 'primary' : index.unique ? 'secondary' : 'default'}
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 1 }}>
                              <Typography variant="caption">
                                {index.columns.join(', ')}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 1 }}>
                              <Chip
                                label={index.unique ? 'YES' : 'NO'}
                                size="small"
                                color={index.unique ? 'primary' : 'default'}
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Alert severity="error">Failed to load table structure</Alert>
        )}
      </Box>
    );
  };

  const renderTableData = () => {
    console.log('renderTableData called:', { tableData, dataLoading, dataError });
    
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Table Data</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => setShowAddRowDialog(true)}
            >
              Add Row
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                refetchData();
              }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                console.log('🌱 Adding sample data...');
                // Add sample user data
                const sampleData = {
                  email: 'test@example.com',
                  password: 'hashedpassword123',
                  first_name: 'John',
                  last_name: 'Doe',
                  phone: '+1234567890',
                  date_of_birth: '1990-01-01',
                  is_email_verified: true,
                  is_phone_verified: false,
                  is_active: true,
                  last_login_at: new Date().toISOString(),
                  failed_login_attempts: 0,
                  locked_until: null,
                  password_reset_token: null
                };
                
                apiService.data.createRow(databaseName!, tableName!, sampleData)
                  .then(() => {
                    console.log('✅ Sample data added successfully');
                    toast.success('Sample data added! Refreshing...');
                    refetchData();
                  })
                  .catch(error => {
                    console.error('❌ Failed to add sample data:', error);
                    toast.error('Failed to add sample data: ' + (error.response?.data?.message || error.message));
                  });
              }}
            >
              Add Sample Data
            </Button>
          </Box>
        </Box>

      {dataLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2 }}>Loading table data...</Typography>
        </Box>
      ) : dataError ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <Alert severity="error">
            Error loading table data: {(dataError as any)?.message || 'Unknown error'}
          </Alert>
        </Box>
      ) : tableData ? (
        <Box>
          <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
            ✅ Data loaded: {tableData.rows?.length || 0} rows, {tableData.columns?.length || 0} columns
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {tableData.columns.map((column: string) => (
                  <TableCell key={column}>{column}</TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableData.rows.map((row: any, index: number) => (
                <TableRow key={row.id || index}>
                  {tableData.columns.map((column: string) => (
                    <TableCell key={column}>
                      {editingRow && editingRow.id === row.id ? (
                        <TextField
                          size="small"
                          value={editingRow[column] || ''}
                          onChange={(e) =>
                            setEditingRow({ ...editingRow, [column]: e.target.value })
                          }
                        />
                      ) : (
                        <Typography variant="body2">
                          {row[column] !== null ? String(row[column]) : 'NULL'}
                        </Typography>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    {editingRow && editingRow.id === row.id ? (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small" onClick={handleSaveRow}>
                          <EditNoteIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setEditingRow(null)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small" onClick={() => handleEditRow(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteRow(row.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      ) : (
        <Alert severity="error">Failed to load table data</Alert>
      )}

      {/* Pagination */}
      {tableData && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={Math.ceil(tableData.totalRows / rowsPerPage)}
            page={page + 1}
            onChange={(_, newPage) => setPage(newPage - 1)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
  };

  const renderIndexes = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Table Indexes</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          onClick={() => setShowAddIndexDialog(true)}
        >
          Add Index
        </Button>
      </Box>

      {structureLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : structure?.indexes && structure.indexes.length > 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Columns</TableCell>
                <TableCell>Unique</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {structure.indexes.map((index: Index) => (
                <TableRow key={index.name}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {index.type === 'PRIMARY' && <KeyIcon color="primary" fontSize="small" />}
                      {index.unique && <SpeedIcon color="secondary" fontSize="small" />}
                      <Typography variant="body2" fontWeight="medium">
                        {index.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={index.type}
                      size="small"
                      color={index.type === 'PRIMARY' ? 'primary' : index.unique ? 'secondary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {index.columns.join(', ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={index.unique ? 'YES' : 'NO'}
                      size="small"
                      color={index.unique ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {index.comment || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleDropIndex(index.name)}
                      disabled={index.type === 'PRIMARY'}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          No indexes found for this table. Click "Add Index" to create one.
        </Alert>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <HomeIcon fontSize="small" />
            Dashboard
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate(`/database/${databaseName}`)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <StorageIcon fontSize="small" />
            {databaseName}
          </Link>
          <Typography variant="body2" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ViewIcon fontSize="small" />
            {tableName}
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Compact Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            size="small"
            onClick={() => navigate(`/database/${databaseName}`)}
          >
            Back to Database
          </Button>
          <Typography variant="h5" component="h1">
        Table: {tableName}
      </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<RefreshIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              refetchStructure();
              refetchData();
            }}
          >
            Refresh
          </Button>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { setShowRenameDialog(true); handleMenuClose(); }}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Rename Table</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setShowDropDialog(true); handleMenuClose(); }}>
              <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Drop Table</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Compact Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Structure" icon={<StorageIcon />} />
          <Tab label="Data" icon={<ViewIcon />} />
          <Tab label="Indexes" icon={<SpeedIcon />} />
        </Tabs>
      </Box>

      {/* Content Area */}
      <Box sx={{ flex: 1, pb: 2 }}>
        {activeTab === 0 && (
          <Box sx={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
            {renderTableStructure()}
          </Box>
        )}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
              Data Tab Active - Debug Info
            </Typography>
            {renderTableData()}
          </Box>
        )}
        {activeTab === 2 && (
          <Box sx={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
            {renderIndexes()}
          </Box>
        )}
      </Box>

      {/* Add Row Dialog */}
      <Dialog open={showAddRowDialog} onClose={() => setShowAddRowDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Row</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              {structure?.columns.map((column: Column) => (
                <Grid item xs={12} sm={6} key={column.name}>
                  <TextField
                    fullWidth
                    label={column.name}
                    value={newRowData[column.name] || ''}
                    onChange={(e) =>
                      setNewRowData({ ...newRowData, [column.name]: e.target.value })
                    }
                    placeholder={column.nullable ? 'Optional' : 'Required'}
                    required={!column.nullable}
                    helperText={`Type: ${column.type}${column.autoIncrement ? ' (Auto Increment)' : ''}`}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddRowDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddRow}
            disabled={addRowMutation.isLoading}
          >
            {addRowMutation.isLoading ? 'Adding...' : 'Add Row'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Column Dialog */}
      <Dialog open={showAddColumnDialog} onClose={() => setShowAddColumnDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Column</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Column Name"
                  value={newColumnData.name}
                  onChange={(e) => setNewColumnData({ ...newColumnData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Data Type"
                  value={newColumnData.type}
                  onChange={(e) => setNewColumnData({ ...newColumnData, type: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Default Value"
                  value={newColumnData.defaultValue}
                  onChange={(e) => setNewColumnData({ ...newColumnData, defaultValue: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Comment"
                  value={newColumnData.comment}
                  onChange={(e) => setNewColumnData({ ...newColumnData, comment: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newColumnData.nullable}
                      onChange={(e) => setNewColumnData({ ...newColumnData, nullable: e.target.checked })}
                    />
                  }
                  label="Allow NULL"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newColumnData.autoIncrement}
                      onChange={(e) => setNewColumnData({ ...newColumnData, autoIncrement: e.target.checked })}
                    />
                  }
                  label="Auto Increment"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddColumnDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddColumn}
            disabled={addColumnMutation.isLoading || !newColumnData.name.trim()}
          >
            {addColumnMutation.isLoading ? 'Adding...' : 'Add Column'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Table Dialog */}
      <Dialog open={showRenameDialog} onClose={() => setShowRenameDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rename Table</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="New Table Name"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder={tableName || ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRenameDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRenameTable}
            disabled={renameTableMutation.isLoading || !newTableName.trim() || newTableName === tableName}
          >
            {renameTableMutation.isLoading ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drop Table Dialog */}
      <Dialog open={showDropDialog} onClose={() => setShowDropDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Drop Table</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Are you sure you want to drop the table "{tableName}"? This action cannot be undone and will permanently delete all data in the table.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDropDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDropTable}
            disabled={dropTableMutation.isLoading}
          >
            {dropTableMutation.isLoading ? 'Dropping...' : 'Drop Table'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Index Dialog */}
      <Dialog open={showAddIndexDialog} onClose={() => setShowAddIndexDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Index</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Index Name"
                  value={newIndexData.name}
                  onChange={(e) => setNewIndexData({ ...newIndexData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Index Type</InputLabel>
                  <Select
                    value={newIndexData.type}
                    onChange={(e) => setNewIndexData({ ...newIndexData, type: e.target.value as any })}
                    label="Index Type"
                  >
                    <MenuItem value="INDEX">INDEX</MenuItem>
                    <MenuItem value="UNIQUE">UNIQUE</MenuItem>
                    <MenuItem value="FULLTEXT">FULLTEXT</MenuItem>
                    <MenuItem value="SPATIAL">SPATIAL</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Select Columns
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {structure?.columns.map((column: Column) => (
                    <Chip
                      key={column.name}
                      label={column.name}
                      onClick={() => handleAddColumnToIndex(column.name)}
                      color={newIndexData.columns.includes(column.name) ? 'primary' : 'default'}
                      variant={newIndexData.columns.includes(column.name) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
                {newIndexData.columns.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Selected Columns:
          </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {newIndexData.columns.map((columnName) => (
                        <Chip
                          key={columnName}
                          label={columnName}
                          onDelete={() => handleRemoveColumnFromIndex(columnName)}
                          color="primary"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Comment"
                  value={newIndexData.comment}
                  onChange={(e) => setNewIndexData({ ...newIndexData, comment: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddIndexDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddIndex}
            disabled={createIndexMutation.isLoading || !newIndexData.name.trim() || newIndexData.columns.length === 0}
          >
            {createIndexMutation.isLoading ? 'Creating...' : 'Create Index'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}