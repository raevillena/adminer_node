import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  Chip,
  Alert,
  Tabs,
  Tab,
  Grid,
  Switch,
  FormControlLabel,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { apiService } from '../services/api';

interface DatabaseUser {
  name: string;
  host: string;
  privileges: string[];
  maxConnections?: number;
  maxUserConnections?: number;
  maxQuestions?: number;
  maxUpdates?: number;
  passwordExpired?: boolean;
  accountLocked?: boolean;
}

interface UserPrivilege {
  database: string;
  table: string;
  privileges: string[];
}

const COMMON_PRIVILEGES = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'INDEX', 'REFERENCES', 'TRIGGER', 'EXECUTE', 'USAGE', 'ALL'
];

const DATABASE_PRIVILEGES = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'INDEX', 'REFERENCES', 'TRIGGER', 'EXECUTE', 'USAGE', 'ALL'
];

const GLOBAL_PRIVILEGES = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'INDEX', 'REFERENCES', 'TRIGGER', 'EXECUTE', 'USAGE', 'RELOAD',
  'SHUTDOWN', 'PROCESS', 'FILE', 'GRANT OPTION', 'REPLICATION CLIENT',
  'REPLICATION SLAVE', 'CREATE USER', 'ALL'
];

export default function UsersPage() {
  const { state } = useApp();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPrivilegeDialog, setShowPrivilegeDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<DatabaseUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<DatabaseUser | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const [newUser, setNewUser] = useState({
    name: '',
    password: '',
    host: 'localhost',
    privileges: [] as string[],
  });
  
  const [privilegeData, setPrivilegeData] = useState({
    database: '',
    table: '',
    privileges: [] as string[],
    scope: 'global' as 'global' | 'database' | 'table',
  });

  // Fetch users
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiService.users.getAll(),
    enabled: !!state.currentConnection,
  });

  // Fetch databases for privilege assignment
  const { data: databases = [] } = useQuery({
    queryKey: ['databases'],
    queryFn: () => apiService.databases.getAll(),
    enabled: !!state.currentConnection,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (userData: { name: string; password: string; host: string }) =>
      apiService.users.create(userData.name, userData.password, userData.host),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowCreateDialog(false);
      setNewUser({ name: '', password: '', host: 'localhost', privileges: [] });
      toast.success('User created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create user');
    },
  });

  // Grant privileges mutation
  const grantPrivilegesMutation = useMutation({
    mutationFn: ({ username, privileges, database, table }: {
      username: string;
      privileges: string[];
      database?: string;
      table?: string;
    }) => apiService.users.grantPrivileges(username, privileges, database, table),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowPrivilegeDialog(false);
      setPrivilegeData({ database: '', table: '', privileges: [], scope: 'global' });
      toast.success('Privileges granted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to grant privileges');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (username: string) => apiService.users.delete(username),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('User deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.password) {
      toast.error('Name and password are required');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleGrantPrivileges = () => {
    console.log('Grant privileges debug:', {
      selectedUser,
      privilegeData,
      privilegesLength: privilegeData.privileges.length,
      hasSelectedUser: !!selectedUser,
      hasPrivileges: privilegeData.privileges.length > 0
    });
    
    if (!selectedUser) {
      toast.error('Please select a user first');
      return;
    }
    
    if (privilegeData.privileges.length === 0) {
      toast.error('Please select at least one privilege');
      return;
    }
    
    // Check for global-only privileges when not granting globally
    const globalOnlyPrivileges = ['SHUTDOWN', 'RELOAD', 'PROCESS', 'FILE', 'REPLICATION CLIENT', 'REPLICATION SLAVE', 'CREATE USER'];
    const { database, table, privileges, scope } = privilegeData;
    
    if (scope !== 'global') {
      const globalPrivs = privileges.filter(p => globalOnlyPrivileges.includes(p));
      if (globalPrivs.length > 0) {
        toast.warning(`Global privileges (${globalPrivs.join(', ')}) will be ignored at ${scope} level`);
      }
    }
    
    grantPrivilegesMutation.mutate({
      username: selectedUser.name,
      privileges,
      database: scope === 'database' ? database : undefined,
      table: scope === 'table' ? table : undefined,
    });
  };

  const handleDeleteUser = (username: string) => {
    if (window.confirm(`Are you sure you want to delete user '${username}'?`)) {
      deleteUserMutation.mutate(username);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, user: DatabaseUser) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const getPrivilegeColor = (privilege: string) => {
    if (privilege === 'ALL') return 'primary';
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(privilege)) return 'success';
    if (['CREATE', 'DROP', 'ALTER'].includes(privilege)) return 'warning';
    return 'default';
  };

  const renderUsersList = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Username</TableCell>
            <TableCell>Host</TableCell>
            <TableCell>Privileges</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Limits</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user: DatabaseUser) => (
            <TableRow key={`${user.name}@${user.host}`}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {user.name}
                  </Typography>
                  {user.accountLocked && <LockIcon color="error" fontSize="small" />}
                  {user.passwordExpired && <KeyIcon color="warning" fontSize="small" />}
                </Box>
              </TableCell>
              <TableCell>{user.host}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {user.privileges.slice(0, 3).map((privilege) => (
                    <Chip
                      key={privilege}
                      label={privilege}
                      size="small"
                      color={getPrivilegeColor(privilege) as any}
                    />
                  ))}
                  {user.privileges.length > 3 && (
                    <Chip
                      label={`+${user.privileges.length - 3}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {user.accountLocked && (
                    <Chip label="Locked" size="small" color="error" />
                  )}
                  {user.passwordExpired && (
                    <Chip label="Expired" size="small" color="warning" />
                  )}
                  {!user.accountLocked && !user.passwordExpired && (
                    <Chip label="Active" size="small" color="success" />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {user.maxConnections && `Max: ${user.maxConnections}`}
                  {user.maxUserConnections && ` | User: ${user.maxUserConnections}`}
                </Typography>
              </TableCell>
              <TableCell>
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuClick(e, user)}
                >
                  <MoreVertIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderCreateUserDialog = () => (
    <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Create New User</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Username"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Host"
              value={newUser.host}
              onChange={(e) => setNewUser({ ...newUser, host: e.target.value })}
              placeholder="localhost"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
        <Button
          onClick={handleCreateUser}
          variant="contained"
          disabled={createUserMutation.isLoading}
        >
          Create User
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderPrivilegeDialog = () => {
    console.log('Privilege dialog render:', {
      showPrivilegeDialog,
      selectedUser,
      privilegeData
    });
    
    return (
      <Dialog open={showPrivilegeDialog} onClose={() => setShowPrivilegeDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Grant Privileges to {selectedUser?.name}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Scope</InputLabel>
              <Select
                value={privilegeData.scope}
                onChange={(e) => setPrivilegeData({ ...privilegeData, scope: e.target.value as any })}
              >
                <MenuItem value="global">Global</MenuItem>
                <MenuItem value="database">Database</MenuItem>
                <MenuItem value="table">Table</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {privilegeData.scope === 'database' && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Database</InputLabel>
                <Select
                  value={privilegeData.database}
                  onChange={(e) => setPrivilegeData({ ...privilegeData, database: e.target.value })}
                >
                  {databases.map((db: any) => (
                    <MenuItem key={db.name} value={db.name}>{db.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          
          {privilegeData.scope === 'table' && (
            <>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Database</InputLabel>
                  <Select
                    value={privilegeData.database}
                    onChange={(e) => setPrivilegeData({ ...privilegeData, database: e.target.value })}
                  >
                    {databases.map((db: any) => (
                      <MenuItem key={db.name} value={db.name}>{db.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Table"
                  value={privilegeData.table}
                  onChange={(e) => setPrivilegeData({ ...privilegeData, table: e.target.value })}
                />
              </Grid>
            </>
          )}
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Select Privileges:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(privilegeData.scope === 'global' ? GLOBAL_PRIVILEGES : 
                privilegeData.scope === 'database' ? DATABASE_PRIVILEGES : 
                COMMON_PRIVILEGES).map((privilege) => (
                <Chip
                  key={privilege}
                  label={privilege}
                  clickable
                  color={privilegeData.privileges.includes(privilege) ? 'primary' : 'default'}
                  onClick={() => {
                    const newPrivileges = privilegeData.privileges.includes(privilege)
                      ? privilegeData.privileges.filter(p => p !== privilege)
                      : [...privilegeData.privileges, privilege];
                    setPrivilegeData({ ...privilegeData, privileges: newPrivileges });
                  }}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowPrivilegeDialog(false)}>Cancel</Button>
        <Button
          onClick={handleGrantPrivileges}
          variant="contained"
          disabled={grantPrivilegesMutation.isLoading}
        >
          Grant Privileges
        </Button>
      </DialogActions>
    </Dialog>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          User Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<RefreshIcon />}
            variant="outlined"
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setShowCreateDialog(true)}
          >
            Create User
          </Button>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Users" icon={<SecurityIcon />} />
          </Tabs>

          {activeTab === 0 && (
            <Box sx={{ mt: 2 }}>
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <Typography>Loading users...</Typography>
                </Box>
              ) : users.length === 0 ? (
                <Alert severity="info">
                  No users found. Create a new user to get started.
                </Alert>
              ) : (
                renderUsersList()
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {renderCreateUserDialog()}
      {renderPrivilegeDialog()}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          setShowPrivilegeDialog(true);
          setAnchorEl(null); // Close menu but keep selectedUser
        }}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Grant Privileges</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          handleDeleteUser(selectedUser?.name || '');
          setAnchorEl(null); // Close menu but keep selectedUser
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete User</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
