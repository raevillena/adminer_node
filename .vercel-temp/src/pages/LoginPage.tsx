import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Grid,
  Paper,
} from '@mui/material';
import {
  Storage as DatabaseIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
// DatabaseConnection type is not needed in this component

interface LoginFormData {
  name: string;
  type: 'mysql' | 'mariadb' | 'postgresql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
}

// Cache key for storing form data
const CACHE_KEY = 'adminer_login_cache';

// Helper functions for caching
const getCachedFormData = (): Partial<LoginFormData> => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

const setCachedFormData = (data: Partial<LoginFormData>) => {
  try {
    // Don't cache password for security
    const { password, ...dataToCache } = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
  } catch {
    // Ignore storage errors
  }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);

  // Get cached data
  const cachedData = getCachedFormData();

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<LoginFormData>({
    defaultValues: {
      name: cachedData.name || '',
      type: cachedData.type || 'mysql',
      host: cachedData.host || 'localhost',
      port: cachedData.port || 3306,
      username: cachedData.username || '',
      password: '', // Never cache password
      database: cachedData.database || '',
      ssl: cachedData.ssl || false,
    },
  });

  const watchedType = watch('type');
  const watchedValues = watch();

  // Update port when database type changes
  React.useEffect(() => {
    setValue('port', (watchedType === 'mysql' || watchedType === 'mariadb') ? 3306 : 5432);
  }, [watchedType, setValue]);

  // Cache form data when values change (debounced)
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCachedFormData(watchedValues);
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [watchedValues]);

  const handleTestConnection = async (data: LoginFormData) => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await apiService.connections.test(data);
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Connection successful!' : 'Connection failed'),
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection test failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const result = await apiService.connections.create(data);
      
      // Store token and navigate to dashboard
      localStorage.setItem('token', result.token);
      
      // Cache the successful connection data (except password)
      setCachedFormData(data);
      
      // Dispatch auth change event
      window.dispatchEvent(new Event('authChange'));
      
      toast.success('Connected successfully!');
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      // Reset form to default values
      setValue('name', '');
      setValue('type', 'mysql');
      setValue('host', 'localhost');
      setValue('port', 3306);
      setValue('username', '');
      setValue('password', '');
      setValue('database', '');
      setValue('ssl', false);
      toast.success('Cache cleared successfully!');
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  const features = [
    {
      icon: <DatabaseIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Multi-Database Support',
      description: 'Connect to MySQL, PostgreSQL, and more database systems',
    },
    {
      icon: <CodeIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'SQL Query Editor',
      description: 'Advanced SQL editor with syntax highlighting and autocomplete',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Secure Connections',
      description: 'SSL support and encrypted connections for your data safety',
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'High Performance',
      description: 'Fast and responsive interface for efficient database management',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Grid container spacing={4} maxWidth="lg">
        {/* Features Section */}
        <Grid item xs={12} md={6}>
          <Box sx={{ color: 'white', textAlign: 'center', mb: 4 }}>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
              Adminer Node
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 4 }}>
              Modern database management tool built with React and Node.js
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} key={index}>
                <Paper
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                  }}
                >
                  {feature.icon}
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {feature.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Login Form */}
        <Grid item xs={12} md={6}>
          <Card sx={{ maxWidth: 500, mx: 'auto' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h4" component="h2" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
                Connect to Database
              </Typography>
              
              {Object.keys(cachedData).length > 0 && (
                <Box sx={{ mb: 2, p: 1, backgroundColor: 'info.light', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="body2" color="info.dark">
                    📝 Using cached connection details (password not cached for security)
                  </Typography>
                </Box>
              )}

              <form onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Controller
                      name="name"
                      control={control}
                      rules={{ required: 'Connection name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Connection Name"
                          error={!!errors.name}
                          helperText={errors.name?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="type"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Database Type</InputLabel>
                          <Select {...field} label="Database Type">
                            <MenuItem value="mysql">MySQL</MenuItem>
                            <MenuItem value="mariadb">MariaDB</MenuItem>
                            <MenuItem value="postgresql">PostgreSQL</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="port"
                      control={control}
                      rules={{ required: 'Port is required', min: 1, max: 65535 }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Port"
                          type="number"
                          error={!!errors.port}
                          helperText={errors.port?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="host"
                      control={control}
                      rules={{ required: 'Host is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Host"
                          error={!!errors.host}
                          helperText={errors.host?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="username"
                      control={control}
                      rules={{ required: 'Username is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Username"
                          error={!!errors.username}
                          helperText={errors.username?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="password"
                      control={control}
                      rules={{ required: 'Password is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Password"
                          type="password"
                          error={!!errors.password}
                          helperText={errors.password?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="database"
                      control={control}
                      rules={{ required: false }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Database (optional for root/admin access)"
                          placeholder="Leave empty to connect to all databases"
                          error={!!errors.database}
                          helperText={errors.database?.message || "Leave empty to access all databases as root/admin"}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="ssl"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="Use SSL"
                        />
                      )}
                    />
                  </Grid>

                  {testResult && (
                    <Grid item xs={12}>
                      <Alert severity={testResult.success ? 'success' : 'error'}>
                        {testResult.message}
                      </Alert>
                    </Grid>
                  )}

                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={handleSubmit(handleTestConnection)}
                        disabled={isLoading}
                        sx={{ minWidth: 120 }}
                      >
                        {isLoading ? <CircularProgress size={20} /> : 'Test Connection'}
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={isLoading}
                        sx={{ minWidth: 120 }}
                      >
                        {isLoading ? <CircularProgress size={20} /> : 'Connect'}
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        onClick={handleClearCache}
                        disabled={isLoading}
                        sx={{ minWidth: 100, color: 'text.secondary' }}
                      >
                        Clear Cache
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
