import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppProvider, useApp } from './contexts/AppContext';
import { lightTheme, darkTheme } from './theme';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DatabasePage from './pages/DatabasePage';
import TablePage from './pages/TablePage';
import QueryPage from './pages/QueryPage';
import UsersPage from './pages/UsersPage';
import ServerPage from './pages/ServerPage';
import SettingsPage from './pages/SettingsPage';

// Main app component with theme switching
function AppContent() {
  const { state, setTheme } = useApp();

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [setTheme]);

  // Apply theme class to body for CSS custom properties
  useEffect(() => {
    document.body.className = state.theme === 'dark' ? 'dark' : 'light';
  }, [state.theme]);

  const currentTheme = state.theme === 'dark' ? darkTheme : lightTheme;

  // Check if user is authenticated
  const isAuthenticated = !!localStorage.getItem('token');

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/database/:databaseName" element={<DatabasePage />} />
          <Route path="/database/:databaseName/table/:tableName" element={<TablePage />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/server" element={<ServerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  );
}

// Root app component with providers
function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
