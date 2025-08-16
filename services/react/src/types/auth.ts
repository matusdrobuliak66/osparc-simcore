// Authentication related types

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: {
    message: string;
    level: 'DEBUG' | 'WARNING' | 'INFO' | 'ERROR';
    logger: string;
  };
  error: null;
}

export interface LogoutRequest {
  client_session_id: string;
}

export interface LogoutResponse {
  data: {
    message: string;
    level: 'DEBUG' | 'WARNING' | 'INFO' | 'ERROR';
    logger: string;
  };
  error: null;
}

export interface User {
  email: string;
  // Add more user fields as needed based on actual API response
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}
