import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Application settings and preferences will be implemented here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
