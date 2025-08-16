import { ApiClient, API_ENDPOINTS } from './api';
import type {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse
} from '@/types/auth';

export const authApi = {
  /**
   * Login user with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return ApiClient.post<LoginResponse>(API_ENDPOINTS.LOGIN, credentials);
  },

  /**
   * Logout user with session ID
   */
  async logout(sessionData: LogoutRequest): Promise<LogoutResponse> {
    return ApiClient.post<LogoutResponse>(API_ENDPOINTS.LOGOUT, sessionData);
  },
};
