'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { authApi } from './auth-api';
import { ApiError } from './api';
import type { AuthState, AuthContextType, User } from '@/types/auth';

// Generate a simple session ID
const generateSessionId = (): string => {
  return 'session-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
};

// Session storage keys
const SESSION_KEYS = {
  USER: 'osparc-user',
  SESSION_ID: 'osparc-session-id',
} as const;

// Auth reducer
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'LOGOUT' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        error: null,
        isLoading: false,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'LOGOUT':
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    default:
      return state;
  }
}

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading to check for existing session
  error: null,
};

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Check if user is authenticated by calling the backend
        const response = await authApi.checkAuth();
        if (response.authenticated && response.user) {
          dispatch({ type: 'SET_USER', payload: response.user });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    checkExistingSession();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const response = await authApi.login({ email, password });

      // After successful login, check authentication status to get user data
      const authCheck = await authApi.checkAuth();

      if (authCheck.authenticated && authCheck.user) {
        dispatch({ type: 'SET_USER', payload: authCheck.user });
      } else {
        throw new Error('Authentication failed after login');
      }
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : 'Login failed. Please try again.';
      dispatch({ type: 'SET_ERROR', payload: message });
    }
  };

  const logout = async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const sessionId = generateSessionId(); // Just generate a dummy session ID

      // Call logout API
      await authApi.logout({ client_session_id: sessionId });
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear any localStorage and state
      localStorage.removeItem(SESSION_KEYS.USER);
      localStorage.removeItem(SESSION_KEYS.SESSION_ID);
      dispatch({ type: 'LOGOUT' });
    }
  };

  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
