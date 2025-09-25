import React from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  useTheme,
  useMediaQuery,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Storage as DatabaseIcon,
  TableChart as TableIcon,
  Code as QueryIcon,
  People as UsersIcon,
  Monitor as ServerIcon,
  Settings as SettingsIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import DatabaseTreeView from './DatabaseTreeView';

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Query Editor', icon: <QueryIcon />, path: '/query' },
  { text: 'Users', icon: <UsersIcon />, path: '/users' },
  { text: 'Server', icon: <ServerIcon />, path: '/server' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar, setSidebarOpen, setTheme } = useApp();

  const handleDrawerToggle = () => {
    if (isMobile) {
      toggleSidebar();
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleThemeToggle = () => {
    setTheme(state.theme === 'light' ? 'dark' : 'light');
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          Adminer Node
        </Typography>
      </Toolbar>
      <Divider />
      
      {/* Connection Info */}
      {state.currentConnection && (
        <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Connected to
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {state.currentConnection.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {state.currentConnection.type} • {state.currentConnection.host}:{state.currentConnection.port}
          </Typography>
        </Box>
      )}

      <Divider />
      
      {/* Navigation */}
      <List>
        {navigationItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '30',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: location.pathname === item.path ? 600 : 400,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* Database Tree View */}
      {state.currentConnection && (
        <Box sx={{ height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
          <DatabaseTreeView
            connectionId={state.currentConnection.id}
            currentDatabase={state.currentDatabase}
            currentTable={state.currentTable}
          />
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${state.sidebarOpen ? drawerWidth : 0}px)` },
          ml: { md: state.sidebarOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {location.pathname === '/dashboard' && 'Dashboard'}
            {location.pathname.startsWith('/database/') && 'Database'}
            {location.pathname.startsWith('/table/') && 'Table'}
            {location.pathname === '/query' && 'Query Editor'}
            {location.pathname === '/users' && 'User Management'}
            {location.pathname === '/server' && 'Server Information'}
            {location.pathname === '/settings' && 'Settings'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Notifications">
              <IconButton color="inherit">
                <Badge badgeContent={0} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title={`Switch to ${state.theme === 'light' ? 'dark' : 'light'} mode`}>
              <IconButton color="inherit" onClick={handleThemeToggle}>
                {state.theme === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: state.sidebarOpen ? drawerWidth : 0 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={state.sidebarOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${state.sidebarOpen ? drawerWidth : 0}px)` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar />
        <Box sx={{ p: 3, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
