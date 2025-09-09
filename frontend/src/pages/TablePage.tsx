import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { useParams } from 'react-router-dom';

export default function TablePage() {
  const { databaseName, tableName } = useParams<{ databaseName: string; tableName: string }>();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Table: {tableName}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Table structure, data browsing, and CRUD operations will be implemented here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
