import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { DatabaseConnection, AppState, QueryTab } from '../../shared/types';

// Action types
type AppAction =
  | { type: 'SET_CURRENT_CONNECTION'; payload: DatabaseConnection | null }
  | { type: 'SET_CURRENT_DATABASE'; payload: string | null }
  | { type: 'SET_CURRENT_TABLE'; payload: string | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'ADD_QUERY_TAB'; payload: QueryTab }
  | { type: 'UPDATE_QUERY_TAB'; payload: { id: string; updates: Partial<QueryTab> } }
  | { type: 'REMOVE_QUERY_TAB'; payload: string }
  | { type: 'SET_ACTIVE_QUERY_TAB'; payload: string | null }
  | { type: 'SET_TOKEN'; payload: string | null };

// Initial state
const initialState: AppState = {
  currentConnection: null,
  currentDatabase: null,
  currentTable: null,
  sidebarOpen: true,
  theme: 'light',
  queryTabs: [],
  activeQueryTab: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_CONNECTION':
      return {
        ...state,
        currentConnection: action.payload,
        currentDatabase: null,
        currentTable: null,
        queryTabs: [],
        activeQueryTab: null,
      };
    
    case 'SET_CURRENT_DATABASE':
      return {
        ...state,
        currentDatabase: action.payload,
        currentTable: null,
      };
    
    case 'SET_CURRENT_TABLE':
      return {
        ...state,
        currentTable: action.payload,
      };
    
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: !state.sidebarOpen,
      };
    
    case 'SET_SIDEBAR_OPEN':
      return {
        ...state,
        sidebarOpen: action.payload,
      };
    
    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload,
      };
    
    case 'ADD_QUERY_TAB':
      return {
        ...state,
        queryTabs: [...state.queryTabs, action.payload],
        activeQueryTab: action.payload.id,
      };
    
    case 'UPDATE_QUERY_TAB':
      return {
        ...state,
        queryTabs: state.queryTabs.map(tab =>
          tab.id === action.payload.id
            ? { ...tab, ...action.payload.updates }
            : tab
        ),
      };
    
    case 'REMOVE_QUERY_TAB':
      const newTabs = state.queryTabs.filter(tab => tab.id !== action.payload);
      const newActiveTab = state.activeQueryTab === action.payload
        ? newTabs.length > 0 ? newTabs[0].id : null
        : state.activeQueryTab;
      
      return {
        ...state,
        queryTabs: newTabs,
        activeQueryTab: newActiveTab,
      };
    
    case 'SET_ACTIVE_QUERY_TAB':
      return {
        ...state,
        activeQueryTab: action.payload,
      };
    
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions
  setCurrentConnection: (connection: DatabaseConnection | null) => void;
  setCurrentDatabase: (database: string | null) => void;
  setCurrentTable: (table: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  addQueryTab: (tab: QueryTab) => void;
  updateQueryTab: (id: string, updates: Partial<QueryTab>) => void;
  removeQueryTab: (id: string) => void;
  setActiveQueryTab: (id: string | null) => void;
  getActiveQueryTab: () => QueryTab | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Helper functions
  const setCurrentConnection = (connection: DatabaseConnection | null) => {
    dispatch({ type: 'SET_CURRENT_CONNECTION', payload: connection });
  };

  const setCurrentDatabase = (database: string | null) => {
    dispatch({ type: 'SET_CURRENT_DATABASE', payload: database });
  };

  const setCurrentTable = (table: string | null) => {
    dispatch({ type: 'SET_CURRENT_TABLE', payload: table });
  };

  const toggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  const setSidebarOpen = (open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_OPEN', payload: open });
  };

  const setTheme = (theme: 'light' | 'dark') => {
    dispatch({ type: 'SET_THEME', payload: theme });
    localStorage.setItem('theme', theme);
  };

  const addQueryTab = (tab: QueryTab) => {
    dispatch({ type: 'ADD_QUERY_TAB', payload: tab });
  };

  const updateQueryTab = (id: string, updates: Partial<QueryTab>) => {
    dispatch({ type: 'UPDATE_QUERY_TAB', payload: { id, updates } });
  };

  const removeQueryTab = (id: string) => {
    dispatch({ type: 'REMOVE_QUERY_TAB', payload: id });
  };

  const setActiveQueryTab = (id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_QUERY_TAB', payload: id });
  };

  const getActiveQueryTab = (): QueryTab | null => {
    return state.queryTabs.find(tab => tab.id === state.activeQueryTab) || null;
  };

  const value: AppContextType = {
    state,
    dispatch,
    setCurrentConnection,
    setCurrentDatabase,
    setCurrentTable,
    toggleSidebar,
    setSidebarOpen,
    setTheme,
    addQueryTab,
    updateQueryTab,
    removeQueryTab,
    setActiveQueryTab,
    getActiveQueryTab,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
