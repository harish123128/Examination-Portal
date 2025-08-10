import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, setTokens, clearTokens, getTokens, type User, type LoginData, type RegisterData } from '../lib/api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const { accessToken } = getTokens();
      
      if (!accessToken) {
        setLoading(false);
        return;
      }

      // Try to get user profile
      const response = await authAPI.getProfile();
      
      if (response.success && response.data) {
        setUser(response.data.user);
        console.log('✅ User authenticated:', response.data.user.email);
      } else {
        clearTokens();
      }
    } catch (error: any) {
      console.error('Auth initialization error:', error);
      clearTokens();
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginData) => {
    try {
      setLoading(true);
      
      const response = await authAPI.login(data);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        
        // Store tokens
        setTokens(tokens.accessToken, tokens.refreshToken);
        
        // Set user
        setUser(user);
        
        toast.success(`Welcome back, ${user.fullName}!`);
        console.log('✅ Login successful:', user.email);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setLoading(true);
      
      const response = await authAPI.register(data);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        
        // Store tokens
        setTokens(tokens.accessToken, tokens.refreshToken);
        
        // Set user
        setUser(user);
        
        toast.success(`Welcome to Paperly, ${user.fullName}!`);
        console.log('✅ Registration successful:', user.email);
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Registration failed';
      toast.error(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      
      // Call logout API
      await authAPI.logout();
      
      // Clear tokens and user
      clearTokens();
      setUser(null);
      
      toast.success('Logged out successfully');
      console.log('✅ Logout successful');
    } catch (error: any) {
      console.error('Logout error:', error);
      // Clear tokens anyway
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await authAPI.updateProfile(data);
      
      if (response.success && response.data) {
        setUser(response.data.user);
        toast.success('Profile updated successfully');
      } else {
        throw new Error(response.message || 'Update failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Update failed';
      toast.error(message);
      throw new Error(message);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authAPI.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        toast.success('Password changed successfully. Please login again.');
        
        // Clear tokens and user (force re-login)
        clearTokens();
        setUser(null);
      } else {
        throw new Error(response.message || 'Password change failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Password change failed';
      toast.error(message);
      throw new Error(message);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getProfile();
      
      if (response.success && response.data) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};