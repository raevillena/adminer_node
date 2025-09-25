import React, { useRef, useEffect, useState } from 'react';
import { 
  Box, 
  Paper, 
  IconButton, 
  Tooltip, 
  Chip, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  Button,
  ButtonGroup,
  Divider,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  Save as SaveIcon,
  History as HistoryIcon,
  Clear as ClearIcon,
  ContentCopy as CopyIcon,
  FormatListBulleted as FormatIcon,
  KeyboardArrowDown as ArrowDownIcon,
  TableChart as TableIcon,
  ViewColumn as ColumnIcon,
  Functions as FunctionIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  InsertChart as InsertIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTheme } from '@mui/material/styles';
import { QueryResult, QueryTab } from '../../shared/types';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: (query: string) => void;
  onSave?: (query: string) => void;
  onClear?: () => void;
  onCopy?: (query: string) => void;
  onFormat?: (query: string) => void;
  result?: QueryResult;
  isLoading?: boolean;
  suggestions?: {
    keywords: string[];
    tables: string[];
    columns: string[];
    functions: string[];
  };
  onSuggestionSelect?: (suggestion: string) => void;
  height?: string | number;
  readOnly?: boolean;
  placeholder?: string;
  currentDatabase?: string;
  availableTables?: Array<{
    name: string;
    columns?: Array<{
      name: string;
      type: string;
    }>;
  }>;
}

export default function SqlEditor({
  value,
  onChange,
  onExecute,
  onSave,
  onClear,
  onCopy,
  onFormat,
  result,
  isLoading = false,
  suggestions,
  onSuggestionSelect,
  height = '400px',
  readOnly = false,
  placeholder = 'Enter your SQL query here...',
  currentDatabase,
  availableTables = [],
}: SqlEditorProps) {
  const theme = useTheme();
  const editorRef = useRef<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [suggestionType, setSuggestionType] = useState<'keywords' | 'tables' | 'columns' | 'functions'>('keywords');

  const isDark = theme.palette.mode === 'dark';

  // CodeMirror extensions
  const extensions = React.useMemo(() => {
    try {
      return [
        sql({
          dialect: 'mysql', // Works for both MySQL and MariaDB
          upperCaseKeywords: true,
        }),
        // Add autocomplete
        // Add line numbers
        // Add bracket matching
      ];
    } catch (error) {
      console.warn('Failed to load SQL extension:', error);
      return [];
    }
  }, []);

  // SQL Templates and Macros
  const sqlTemplates = {
    selectAll: (tableName: string) => `SELECT * FROM ${tableName};`,
    selectCount: (tableName: string) => `SELECT COUNT(*) FROM ${tableName};`,
    selectWithLimit: (tableName: string) => `SELECT * FROM ${tableName} LIMIT 10;`,
    selectWithWhere: (tableName: string) => `SELECT * FROM ${tableName} WHERE id = 1;`,
    selectWithJoin: (table1: string, table2: string) => 
      `SELECT t1.*, t2.* 
FROM ${table1} t1 
INNER JOIN ${table2} t2 ON t1.id = t2.${table1}_id;`,
    insert: (tableName: string) => `INSERT INTO ${tableName} (column1, column2) VALUES ('value1', 'value2');`,
    update: (tableName: string) => `UPDATE ${tableName} SET column1 = 'new_value' WHERE id = 1;`,
    delete: (tableName: string) => `DELETE FROM ${tableName} WHERE id = 1;`,
    createTable: (tableName: string) => `CREATE TABLE ${tableName} (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
    describeTable: (tableName: string) => `DESCRIBE ${tableName};`,
    showTables: () => `SHOW TABLES;`,
    showDatabases: () => `SHOW DATABASES;`,
    showColumns: (tableName: string) => `SHOW COLUMNS FROM ${tableName};`,
  };

  // Common SQL keywords and functions
  const sqlKeywords = [
    'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
    'UNION', 'UNION ALL', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
    'ASC', 'DESC', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
  ];

  const sqlFunctions = [
    'COUNT()', 'SUM()', 'AVG()', 'MIN()', 'MAX()', 'CONCAT()', 'SUBSTRING()',
    'LENGTH()', 'UPPER()', 'LOWER()', 'TRIM()', 'DATE()', 'NOW()', 'CURDATE()',
    'CURTIME()', 'YEAR()', 'MONTH()', 'DAY()', 'HOUR()', 'MINUTE()', 'SECOND()',
    'IFNULL()', 'COALESCE()', 'CAST()', 'CONVERT()', 'ROUND()', 'FLOOR()', 'CEIL()'
  ];

  const handleExecute = () => {
    if (value.trim()) {
      onExecute(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          handleExecute();
          break;
        case 's':
          event.preventDefault();
          onSave?.(value);
          break;
        case 'k':
          event.preventDefault();
          onClear?.();
          break;
      }
    }
  };

  const handleSuggestionClick = (type: 'keywords' | 'tables' | 'columns' | 'functions') => {
    setSuggestionType(type);
    setAnchorEl(editorRef.current?.dom);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    onSuggestionSelect?.(suggestion);
    setAnchorEl(null);
  };

  const getSuggestionItems = () => {
    if (!suggestions) return [];
    
    switch (suggestionType) {
      case 'keywords':
        return suggestions.keywords;
      case 'tables':
        return suggestions.tables;
      case 'columns':
        return suggestions.columns;
      case 'functions':
        return suggestions.functions;
      default:
        return [];
    }
  };

  const formatQuery = (query: string) => {
    // Simple SQL formatting - in a real app, you'd use a proper SQL formatter
    return query
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
      .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
      .replace(/\bINNER JOIN\b/gi, '\nINNER JOIN')
      .replace(/\bOUTER JOIN\b/gi, '\nOUTER JOIN')
      .replace(/,/g, ',\n  ')
      .trim();
  };

  const handleFormat = () => {
    const formatted = formatQuery(value);
    onChange(formatted);
    onFormat?.(formatted);
  };

  // Insert text at cursor position
  const insertText = (text: string) => {
    const currentValue = value;
    const cursorPosition = editorRef.current?.view?.state?.selection?.main?.head || currentValue.length;
    const newValue = currentValue.slice(0, cursorPosition) + text + currentValue.slice(cursorPosition);
    onChange(newValue);
  };

  // Insert SQL template
  const insertTemplate = (template: string) => {
    const currentValue = value;
    const newValue = currentValue + (currentValue ? '\n\n' : '') + template;
    onChange(newValue);
  };

  // Insert table name
  const insertTableName = (tableName: string) => {
    insertText(tableName);
  };

  // Insert column name
  const insertColumnName = (columnName: string) => {
    insertText(columnName);
  };

  // Insert SQL keyword
  const insertKeyword = (keyword: string) => {
    insertText(keyword + ' ');
  };

  // Insert SQL function
  const insertFunction = (func: string) => {
    insertText(func);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Main Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Tooltip title="Execute Query (Ctrl+Enter)">
          <IconButton
            onClick={handleExecute}
            disabled={!value.trim() || isLoading}
            color="primary"
            size="small"
          >
            <ExecuteIcon />
          </IconButton>
        </Tooltip>

        {onSave && (
          <Tooltip title="Save Query (Ctrl+S)">
            <IconButton onClick={() => onSave(value)} size="small">
              <SaveIcon />
            </IconButton>
          </Tooltip>
        )}

        {onClear && (
          <Tooltip title="Clear (Ctrl+K)">
            <IconButton onClick={onClear} size="small">
              <ClearIcon />
            </IconButton>
          </Tooltip>
        )}

        {onCopy && (
          <Tooltip title="Copy Query">
            <IconButton onClick={() => onCopy(value)} size="small">
              <CopyIcon />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Format Query">
          <IconButton onClick={handleFormat} size="small">
            <FormatIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Quick SQL Templates */}
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="SELECT * FROM table">
            <Button onClick={() => insertTemplate(sqlTemplates.selectAll('table_name'))} startIcon={<SearchIcon />}>
              SELECT
            </Button>
          </Tooltip>
          <Tooltip title="INSERT INTO table">
            <Button onClick={() => insertTemplate(sqlTemplates.insert('table_name'))} startIcon={<InsertIcon />}>
              INSERT
            </Button>
          </Tooltip>
          <Tooltip title="UPDATE table">
            <Button onClick={() => insertTemplate(sqlTemplates.update('table_name'))} startIcon={<EditIcon />}>
              UPDATE
            </Button>
          </Tooltip>
          <Tooltip title="DELETE FROM table">
            <Button onClick={() => insertTemplate(sqlTemplates.delete('table_name'))} startIcon={<DeleteIcon />}>
              DELETE
            </Button>
          </Tooltip>
        </ButtonGroup>

        <Box sx={{ flexGrow: 1 }} />

        {/* Result Status */}
        {result && (
          <Chip
            label={`${result.rows.length} rows, ${result.executionTime}ms`}
            size="small"
            color="success"
            variant="outlined"
          />
        )}

        {isLoading && (
          <Chip
            label="Executing..."
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
      </Box>

      {/* Suggestive Buttons Panel */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon fontSize="small" />
              Quick Insert & Templates
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Grid container spacing={2}>
              {/* Tables */}
              {availableTables.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TableIcon fontSize="small" />
                        Tables ({availableTables.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 120, overflow: 'auto' }}>
                        {availableTables.map((table) => (
                          <Chip
                            key={table.name}
                            label={table.name}
                            size="small"
                            onClick={() => insertTableName(table.name)}
                            variant="outlined"
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* SQL Keywords */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeIcon fontSize="small" />
                      Keywords
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 120, overflow: 'auto' }}>
                      {sqlKeywords.slice(0, 20).map((keyword) => (
                        <Chip
                          key={keyword}
                          label={keyword}
                          size="small"
                          onClick={() => insertKeyword(keyword)}
                          variant="outlined"
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* SQL Functions */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FunctionIcon fontSize="small" />
                      Functions
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 120, overflow: 'auto' }}>
                      {sqlFunctions.slice(0, 15).map((func) => (
                        <Chip
                          key={func}
                          label={func}
                          size="small"
                          onClick={() => insertFunction(func)}
                          variant="outlined"
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Quick Templates */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon fontSize="small" />
                      Quick Templates
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 120, overflow: 'auto' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => insertTemplate(sqlTemplates.showTables())}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        SHOW TABLES
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => insertTemplate(sqlTemplates.showDatabases())}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        SHOW DATABASES
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => insertTemplate(sqlTemplates.describeTable('table_name'))}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        DESCRIBE TABLE
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => insertTemplate(sqlTemplates.selectCount('table_name'))}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        COUNT ROWS
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Editor */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <CodeMirror
          ref={editorRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          extensions={extensions}
          theme={isDark ? oneDark : undefined}
          height={height}
          placeholder={placeholder}
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: true,
            searchKeymap: true,
          }}
        />
      </Box>

      {/* Suggestions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          style: {
            maxHeight: 300,
            width: 250,
          },
        }}
      >
        {getSuggestionItems().map((item, index) => (
          <MenuItem
            key={index}
            onClick={() => handleSuggestionSelect(item)}
            dense
          >
            <ListItemText primary={item} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
