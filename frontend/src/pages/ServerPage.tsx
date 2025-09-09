import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

export default function ServerPage() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Server Information
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Server monitoring and status information will be implemented here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
