'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { authApi } from './auth-api';
import { ApiError } from './api';
import { SessionManager } from './session';
import type { AuthState, AuthContextType, User } from '@/types/auth';

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
          // Ensure we have a session if the user is authenticated
          if (!SessionManager.hasActiveSession()) {
            SessionManager.initializeSession();
          }
          dispatch({ type: 'SET_USER', payload: response.user });
        } else {
          // Clear any stale session if user is not authenticated
          SessionManager.clearSession();
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
        // Clear session on error
        SessionManager.clearSession();
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

      // Initialize session after successful login
      SessionManager.initializeSession();

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
      // Get the current session ID for logout
      const clientSessionId = SessionManager.getClientSessionId();

      if (clientSessionId) {
        // Call logout API with the current session ID
        await authApi.logout({ client_session_id: clientSessionId });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear session and state
      SessionManager.clearSession();
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
