// API configuration and utilities
const API_BASE_URL = '/api/proxy';
const API_VERSION = 'v0';

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/${API_VERSION}/auth/login`,
  LOGOUT: `${API_BASE_URL}/${API_VERSION}/auth/logout`,
  PROJECTS: `/api/projects`, // Use our custom API route for better cookie handling
  PROJECTS_SEARCH: `${API_BASE_URL}/${API_VERSION}/projects:search`,
  WORKSPACES: `/api/workspaces`, // Use our custom API route for better cookie handling
} as const;

// Generic API response type
export interface ApiResponse<T = any> {
  data: T;
  error: null | string;
}

// API error type
export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Generic API client
export class ApiClient {
  private static async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for session management
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  static async get<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  static async post<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async put<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}
