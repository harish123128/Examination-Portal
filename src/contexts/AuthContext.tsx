import React, { createContext, useContext, useState, useEffect } from 'react';
import { PaperlyAuth, type Profile, type SignInData, type SignUpData } from '../lib/auth';
import type { User, Session } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (data: SignInData) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user && !!profile;

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('🚀 Paperly: Initializing authentication...');
      
      const result = await PaperlyAuth.getCurrentUser();
      
      if (result.user && result.profile && result.session) {
        setUser(result.user);
        setProfile(result.profile);
        setSession(result.session);
        console.log('✅ User authenticated:', result.profile.email);
      } else {
        console.log('ℹ️ No authenticated user found');
      }
    } catch (error: any) {
      console.error('Auth initialization error:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (data: SignInData) => {
    try {
      setLoading(true);
      
      const result = await PaperlyAuth.signIn(data);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.user && result.profile && result.session) {
        setUser(result.user);
        setProfile(result.profile);
        setSession(result.session);
        
        toast.success(`Welcome back, ${result.profile.full_name}!`);
        console.log('✅ Sign in successful:', result.profile.email);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error: any) {
      const message = error.message || 'Sign in failed';
      toast.error(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: SignUpData) => {
    try {
      setLoading(true);
      
      const result = await PaperlyAuth.signUp(data);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.user) {
        toast.success(`Welcome to Paperly, ${data.fullName}!`);
        console.log('✅ Sign up successful:', data.email);
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      const message = error.message || 'Sign up failed';
      toast.error(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      await PaperlyAuth.signOut();
      
      setUser(null);
      setProfile(null);
      setSession(null);
      
      toast.success('Signed out successfully');
      console.log('✅ Sign out successful');
    } catch (error: any) {
      console.error('Sign out error:', error);
      // Clear state anyway
      setUser(null);
      setProfile(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await PaperlyAuth.resetPassword(email);
      toast.success('Password reset email sent!');
    } catch (error: any) {
      const message = error.message || 'Password reset failed';
      toast.error(message);
      throw new Error(message);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      await PaperlyAuth.updatePassword(newPassword);
      toast.success('Password updated successfully!');
    } catch (error: any) {
      const message = error.message || 'Password update failed';
      toast.error(message);
      throw new Error(message);
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    try {
      const updatedProfile = await PaperlyAuth.updateProfile(data);
      if (updatedProfile) {
        setProfile(updatedProfile);
        toast.success('Profile updated successfully!');
      }
    } catch (error: any) {
      const message = error.message || 'Profile update failed';
      toast.error(message);
      throw new Error(message);
    }
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      return await PaperlyAuth.checkEmailExists(email);
    } catch (error) {
      console.error('Check email exists error:', error);
      return false;
    }
  };

  const refreshUser = async () => {
    try {
      const result = await PaperlyAuth.getCurrentUser();
      if (result.user && result.profile && result.session) {
        setUser(result.user);
        setProfile(result.profile);
        setSession(result.session);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      isAuthenticated,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
      checkEmailExists,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};