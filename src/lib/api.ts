import axios from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken: string | null = localStorage.getItem('paperly_access_token');
let refreshToken: string | null = localStorage.getItem('paperly_refresh_token');

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });

          const { accessToken: newAccessToken } = response.data.data;
          
          // Update tokens
          accessToken = newAccessToken;
          localStorage.setItem('paperly_access_token', newAccessToken);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        clearTokens();
        window.location.href = '/auth/signin';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Token management functions
export const setTokens = (newAccessToken: string, newRefreshToken: string) => {
  accessToken = newAccessToken;
  refreshToken = newRefreshToken;
  localStorage.setItem('paperly_access_token', newAccessToken);
  localStorage.setItem('paperly_refresh_token', newRefreshToken);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('paperly_access_token');
  localStorage.removeItem('paperly_refresh_token');
};

export const getTokens = () => ({
  accessToken,
  refreshToken
});

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'teacher';
  phone?: string;
  avatar?: string;
  isEmailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  role?: 'admin' | 'teacher';
  phone?: string;
}

export interface SecurityEvent {
  event: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  details?: any;
}

// Auth API functions
export const authAPI = {
  // Register new user
  register: async (data: RegisterData): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  // Login user
  login: async (data: LoginData): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  // Refresh access token
  refreshToken: async (): Promise<ApiResponse<{ accessToken: string }>> => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  // Logout user
  logout: async (): Promise<ApiResponse> => {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  },

  // Get current user profile
  getProfile: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  // Update user profile
  updateProfile: async (data: Partial<User>): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<ApiResponse> => {
    const response = await api.put('/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  // Get security events
  getSecurityEvents: async (): Promise<ApiResponse<{ events: SecurityEvent[] }>> => {
    const response = await api.get('/auth/security-events');
    return response.data;
  }
};

// Health check
export const healthCheck = async (): Promise<ApiResponse> => {
  const response = await api.get('/health');
  return response.data;
};

export default api;