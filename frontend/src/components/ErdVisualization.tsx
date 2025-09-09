import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Zoom,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  TableChart as TableIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { apiService } from '../services/api';
import { useApp } from '../contexts/AppContext';

interface TableNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    foreignKey?: boolean;
  }>;
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}

interface ErdVisualizationProps {
  databaseName: string;
  onTableSelect?: (tableName: string) => void;
}

export default function ErdVisualization({ databaseName, onTableSelect }: ErdVisualizationProps) {
  const { state } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showColumnTypes, setShowColumnTypes] = useState(true);
  const [showForeignKeys, setShowForeignKeys] = useState(true);
  const [layout, setLayout] = useState<'auto' | 'hierarchical' | 'circular'>('auto');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Fetch tables for the database
  const { data: tables = [], isLoading: tablesLoading } = useQuery(
    ['tables', databaseName],
    () => apiService.tables.getAll(databaseName),
    {
      enabled: !!state.currentConnection && !!databaseName,
      onError: (error: any) => {
        console.error('Failed to load tables:', error);
      },
    }
  );

  // Fetch table structures
  const { data: tableStructures = {}, isLoading: structuresLoading } = useQuery(
    ['tableStructures', databaseName, tables.map(t => t.name)],
    async () => {
      const structures: Record<string, any> = {};
      for (const table of tables) {
        try {
          const structure = await apiService.tables.getStructure(databaseName, table.name);
          structures[table.name] = structure;
        } catch (error) {
          console.error(`Failed to load structure for table ${table.name}:`, error);
        }
      }
      return structures;
    },
    {
      enabled: !!state.currentConnection && !!databaseName && tables.length > 0,
    }
  );

  // Generate table nodes
  const generateTableNodes = (): TableNode[] => {
    const nodes: TableNode[] = [];
    const nodeWidth = 200;
    const nodeHeight = 150;
    const spacing = 50;

    tables.forEach((table, index) => {
      const structure = tableStructures[table.name];
      const columns = structure?.columns || [];
      const foreignKeys = structure?.foreignKeys || [];

      const node: TableNode = {
        id: table.name,
        name: table.name,
        x: (index % 3) * (nodeWidth + spacing) + 50,
        y: Math.floor(index / 3) * (nodeHeight + spacing) + 50,
        width: nodeWidth,
        height: nodeHeight + (columns.length * 20),
        columns: columns.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          primaryKey: col.primaryKey,
          foreignKey: foreignKeys.some((fk: any) => fk.column === col.name),
        })),
        foreignKeys,
      };

      nodes.push(node);
    });

    return nodes;
  };

  // Draw the ERD
  const drawErd = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    const nodes = generateTableNodes();

    // Draw connections first (so they appear behind tables)
    if (showForeignKeys) {
      nodes.forEach(node => {
        node.foreignKeys.forEach(fk => {
          const targetNode = nodes.find(n => n.name === fk.referencedTable);
          if (targetNode) {
            drawConnection(ctx, node, targetNode, fk.column, fk.referencedColumn);
          }
        });
      });
    }

    // Draw tables
    nodes.forEach(node => {
      drawTable(ctx, node);
    });

    ctx.restore();
  };

  // Draw a table node
  const drawTable = (ctx: CanvasRenderingContext2D, node: TableNode) => {
    const isSelected = selectedTable === node.name;

    // Table background
    ctx.fillStyle = isSelected ? '#e3f2fd' : '#ffffff';
    ctx.strokeStyle = isSelected ? '#1976d2' : '#cccccc';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.fillRect(node.x, node.y, node.width, node.height);
    ctx.strokeRect(node.x, node.y, node.width, node.height);

    // Table name header
    ctx.fillStyle = '#1976d2';
    ctx.fillRect(node.x, node.y, node.width, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, node.x + node.width / 2, node.y + 20);

    // Columns
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    
    node.columns.forEach((column, index) => {
      const y = node.y + 50 + (index * 20);
      const x = node.x + 10;

      // Column name
      let columnText = column.name;
      if (column.primaryKey) columnText = `🔑 ${columnText}`;
      if (column.foreignKey) columnText = `🔗 ${columnText}`;
      if (!column.nullable) columnText = `* ${columnText}`;

      ctx.fillText(columnText, x, y);

      // Column type
      if (showColumnTypes) {
        ctx.fillStyle = '#666666';
        ctx.fillText(`(${column.type})`, x + 120, y);
        ctx.fillStyle = '#000000';
      }
    });
  };

  // Draw a connection between tables
  const drawConnection = (
    ctx: CanvasRenderingContext2D,
    fromNode: TableNode,
    toNode: TableNode,
    fromColumn: string,
    toColumn: string
  ) => {
    const fromX = fromNode.x + fromNode.width;
    const fromY = fromNode.y + 50 + (fromNode.columns.findIndex(c => c.name === fromColumn) * 20) + 10;
    const toX = toNode.x;
    const toY = toNode.y + 50 + (toNode.columns.findIndex(c => c.name === toColumn) * 20) + 10;

    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow head
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowLength = 10;
    const arrowAngle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle - arrowAngle),
      toY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle + arrowAngle),
      toY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();
  };

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  const handleTableClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - pan.x;
    const y = (e.clientY - rect.top) / zoom - pan.y;

    const nodes = generateTableNodes();
    const clickedNode = nodes.find(node => 
      x >= node.x && x <= node.x + node.width &&
      y >= node.y && y <= node.y + node.height
    );

    if (clickedNode) {
      setSelectedTable(clickedNode.name);
      onTableSelect?.(clickedNode.name);
    }
  };

  // Redraw when data changes
  useEffect(() => {
    drawErd();
  }, [tables, tableStructures, zoom, pan, showColumnTypes, showForeignKeys, selectedTable]);

  // Auto-layout
  const applyAutoLayout = () => {
    const nodes = generateTableNodes();
    const nodeWidth = 200;
    const nodeHeight = 150;
    const spacing = 50;
    const cols = Math.ceil(Math.sqrt(nodes.length));

    nodes.forEach((node, index) => {
      node.x = (index % cols) * (nodeWidth + spacing) + 50;
      node.y = Math.floor(index / cols) * (nodeHeight + spacing) + 50;
    });

    drawErd();
  };

  if (tablesLoading || structuresLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Typography>Loading ERD...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Entity Relationship Diagram
        </Typography>
        
        <Tooltip title="Zoom In">
          <IconButton onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}>
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Zoom Out">
          <IconButton onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}>
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Reset View">
          <IconButton onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <CenterIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Auto Layout">
          <Button onClick={applyAutoLayout} startIcon={<RefreshIcon />}>
            Auto Layout
          </Button>
        </Tooltip>
        
        <Tooltip title="Settings">
          <IconButton onClick={() => setShowSettings(!showSettings)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Settings Panel */}
      {showSettings && (
        <Paper sx={{ p: 2, m: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showColumnTypes}
                    onChange={(e) => setShowColumnTypes(e.target.checked)}
                  />
                }
                label="Show Column Types"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showForeignKeys}
                    onChange={(e) => setShowForeignKeys(e.target.checked)}
                  />
                }
                label="Show Foreign Keys"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Layout</InputLabel>
                <Select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as any)}
                >
                  <MenuItem value="auto">Auto</MenuItem>
                  <MenuItem value="hierarchical">Hierarchical</MenuItem>
                  <MenuItem value="circular">Circular</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Zoom Level</Typography>
              <Slider
                value={zoom}
                onChange={(_, value) => setZoom(value as number)}
                min={0.1}
                max={3}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Canvas */}
      <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleTableClick}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            border: '1px solid #ddd',
            borderRadius: 4,
          }}
        />
      </Box>

      {/* Legend */}
      <Paper sx={{ p: 2, m: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Legend
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, bgcolor: '#1976d2', borderRadius: 1 }} />
            <Typography variant="body2">Table</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">🔑</Typography>
            <Typography variant="body2">Primary Key</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">🔗</Typography>
            <Typography variant="body2">Foreign Key</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">*</Typography>
            <Typography variant="body2">Not Null</Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
