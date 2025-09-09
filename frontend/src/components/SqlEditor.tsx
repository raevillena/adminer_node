import React, { useRef, useEffect, useState } from 'react';
import { Box, Paper, IconButton, Tooltip, Chip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  Save as SaveIcon,
  History as HistoryIcon,
  Clear as ClearIcon,
  ContentCopy as CopyIcon,
  FormatListBulleted as FormatIcon,
  KeyboardArrowDown as ArrowDownIcon,
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
}: SqlEditorProps) {
  const theme = useTheme();
  const editorRef = useRef<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [suggestionType, setSuggestionType] = useState<'keywords' | 'tables' | 'columns' | 'functions'>('keywords');

  const isDark = theme.palette.mode === 'dark';

  // CodeMirror extensions
  const extensions = [
    sql({
      dialect: 'mysql', // Works for both MySQL and MariaDB
      upperCaseKeywords: true,
    }),
    // Add autocomplete
    // Add line numbers
    // Add bracket matching
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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
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

        <Box sx={{ flexGrow: 1 }} />

        {/* Suggestions Menu */}
        {suggestions && (
          <>
            <Chip
              label="Keywords"
              size="small"
              onClick={() => handleSuggestionClick('keywords')}
              variant={suggestionType === 'keywords' ? 'filled' : 'outlined'}
            />
            <Chip
              label="Tables"
              size="small"
              onClick={() => handleSuggestionClick('tables')}
              variant={suggestionType === 'tables' ? 'filled' : 'outlined'}
            />
            <Chip
              label="Columns"
              size="small"
              onClick={() => handleSuggestionClick('columns')}
              variant={suggestionType === 'columns' ? 'filled' : 'outlined'}
            />
            <Chip
              label="Functions"
              size="small"
              onClick={() => handleSuggestionClick('functions')}
              variant={suggestionType === 'functions' ? 'filled' : 'outlined'}
            />
          </>
        )}

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
