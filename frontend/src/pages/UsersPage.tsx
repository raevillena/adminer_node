import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

export default function UsersPage() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        User Management
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Database user management and permissions will be implemented here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
