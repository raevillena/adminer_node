import React, { useState } from 'react';
import {
  Box,
  TreeView,
  TreeItem,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Storage as DatabaseIcon,
  TableChart as TableIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface DatabaseTreeViewProps {
  connectionId?: string;
  currentDatabase?: string;
  currentTable?: string;
  onDatabaseSelect?: (databaseName: string) => void;
  onTableSelect?: (databaseName: string, tableName: string) => void;
}

interface DatabaseNode {
  name: string;
  tables: TableNode[];
  views: TableNode[];
}

interface TableNode {
  name: string;
  type: 'table' | 'view';
  rows?: number;
  size?: number;
}

export default function DatabaseTreeView({
  connectionId,
  currentDatabase,
  currentTable,
  onDatabaseSelect,
  onTableSelect,
}: DatabaseTreeViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  // Fetch databases
  const { data: databases = [], isLoading: databasesLoading, refetch: refetchDatabases } = useQuery(
    ['databases-tree', connectionId],
    () => apiService.databases.getAll(),
    {
      enabled: !!connectionId,
      onSuccess: (data) => {
        // Auto-expand current database
        if (currentDatabase && !expanded.includes(currentDatabase)) {
          setExpanded(prev => [...prev, currentDatabase]);
        }
      }
    }
  );

  // Fetch tables for each database
  const { data: allTables = {}, isLoading: tablesLoading } = useQuery(
    ['tables-tree', connectionId, databases],
    async () => {
      const tablesData: Record<string, { tables: TableNode[]; views: TableNode[] }> = {};
      
      console.log('🌳 Fetching tables for databases:', databases.map(db => db.name));
      
      for (const db of databases) {
        try {
          const tables = await apiService.tables.getAll(db.name);
          console.log(`🌳 Fetched ${tables.length} tables for ${db.name}:`, tables.map(t => t.name));
          
          tablesData[db.name] = {
            tables: tables.filter(t => t.type === 'table'),
            views: tables.filter(t => t.type === 'view'),
          };
          
          console.log(`🌳 Processed ${db.name}:`, {
            tables: tablesData[db.name].tables.length,
            views: tablesData[db.name].views.length
          });
        } catch (error) {
          console.error(`Failed to fetch tables for ${db.name}:`, error);
          tablesData[db.name] = { tables: [], views: [] };
        }
      }
      
      console.log('🌳 Final tables data:', tablesData);
      return tablesData;
    },
    {
      enabled: !!connectionId && databases.length > 0,
    }
  );

  const handleToggle = (event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  };

  const handleSelect = (event: React.SyntheticEvent, nodeIds: string[]) => {
    setSelected(nodeIds);
  };

  const handleDatabaseClick = (databaseName: string) => {
    if (onDatabaseSelect) {
      onDatabaseSelect(databaseName);
    } else {
      navigate(`/database/${databaseName}`);
    }
  };

  const handleTableClick = (databaseName: string, tableName: string) => {
    if (onTableSelect) {
      onTableSelect(databaseName, tableName);
    } else {
      navigate(`/database/${databaseName}/table/${tableName}`);
    }
  };

  const handleRefresh = () => {
    console.log('🌳 Refreshing tree view...');
    // Invalidate both databases and tables queries
    queryClient.invalidateQueries(['databases-tree', connectionId]);
    queryClient.invalidateQueries(['tables-tree', connectionId]);
    refetchDatabases();
  };

  if (databasesLoading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Loading databases...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderIcon />
            Databases
          </Typography>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tree View */}
      <Box sx={{ p: 1 }}>
        {databases.map((database) => {
          const databaseTables = allTables[database.name] || { tables: [], views: [] };
          const isExpanded = expanded.includes(database.name);
          const isCurrentDatabase = currentDatabase === database.name;
          
          console.log(`🌳 Rendering database ${database.name}:`, {
            tables: databaseTables.tables.length,
            views: databaseTables.views.length,
            isExpanded,
            isCurrentDatabase
          });

          return (
            <Box key={database.name} sx={{ mb: 1 }}>
              {/* Database Node */}
              <ListItemButton
                onClick={() => handleDatabaseClick(database.name)}
                selected={isCurrentDatabase}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {isExpanded ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DatabaseIcon fontSize="small" />
                      <Typography variant="body2" fontWeight={isCurrentDatabase ? 'bold' : 'normal'}>
                        {database.name}
                      </Typography>
                      <Chip
                        label={`${databaseTables.tables.length + databaseTables.views.length}`}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 'auto', fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                  }
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(prev => 
                      prev.includes(database.name)
                        ? prev.filter(id => id !== database.name)
                        : [...prev, database.name]
                    );
                  }}
                >
                  {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
              </ListItemButton>

              {/* Tables and Views */}
              {isExpanded && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ ml: 2 }}>
                    {/* Tables */}
                    {databaseTables.tables.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 'bold' }}>
                          TABLES
                        </Typography>
                        {databaseTables.tables.map((table) => (
                          <ListItemButton
                            key={`${database.name}-table-${table.name}`}
                            onClick={() => handleTableClick(database.name, table.name)}
                            selected={currentDatabase === database.name && currentTable === table.name}
                            sx={{
                              ml: 1,
                              borderRadius: 1,
                              '&.Mui-selected': {
                                backgroundColor: 'secondary.main',
                                color: 'secondary.contrastText',
                                '&:hover': {
                                  backgroundColor: 'secondary.dark',
                                },
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <TableIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2">
                                    {table.name}
                                  </Typography>
                                  {table.rows !== undefined && (
                                    <Chip
                                      label={`${table.rows} rows`}
                                      size="small"
                                      variant="outlined"
                                      sx={{ fontSize: '0.7rem', height: 18 }}
                                    />
                                  )}
                                </Box>
                              }
                            />
                          </ListItemButton>
                        ))}
                      </Box>
                    )}

                    {/* Views */}
                    {databaseTables.views.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 'bold' }}>
                          VIEWS
                        </Typography>
                        {databaseTables.views.map((view) => (
                          <ListItemButton
                            key={`${database.name}-view-${view.name}`}
                            onClick={() => handleTableClick(database.name, view.name)}
                            selected={currentDatabase === database.name && currentTable === view.name}
                            sx={{
                              ml: 1,
                              borderRadius: 1,
                              '&.Mui-selected': {
                                backgroundColor: 'secondary.main',
                                color: 'secondary.contrastText',
                                '&:hover': {
                                  backgroundColor: 'secondary.dark',
                                },
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <ViewIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2">
                                    {view.name}
                                  </Typography>
                                  <Chip
                                    label="VIEW"
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    sx={{ fontSize: '0.7rem', height: 18 }}
                                  />
                                </Box>
                              }
                            />
                          </ListItemButton>
                        ))}
                      </Box>
                    )}

                    {/* Empty state */}
                    {databaseTables.tables.length === 0 && databaseTables.views.length === 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 2, fontStyle: 'italic' }}>
                        No tables or views found
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              )}
            </Box>
          );
        })}

        {/* Empty state */}
        {databases.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No databases found
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
