import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthService } from '../lib/auth';
import type { Profile, SignUpData, SignInData } from '../lib/auth';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (data: SignInData) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
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

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing authentication...');
        const startTime = Date.now();
        
        // Get current session and user
        const result = await AuthService.getCurrentUser();
        
        if (mounted) {
          setUser(result.user);
          setProfile(result.profile);
          setSession(result.session);
          
          const duration = Date.now() - startTime;
          
          if (result.user) {
            console.log(`✅ User authenticated in ${duration}ms:`, result.user.email);
            console.log('👤 Profile loaded:', result.profile?.full_name);
          } else {
            console.log(`ℹ️ No authenticated user (${duration}ms)`);
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Load profile for authenticated user
          const profile = await AuthService.getProfileFast(session.user.id);
          if (mounted) {
            setProfile(profile);
          }
        } else {
          if (mounted) {
            setProfile(null);
          }
        }

        // Handle specific auth events
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ User signed in successfully');
            break;
          case 'SIGNED_OUT':
            console.log('👋 User signed out');
            AuthService.clearCache();
            break;
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token refreshed');
            break;
          case 'PASSWORD_RECOVERY':
            toast.success('Password recovery email sent!');
            break;
          case 'USER_UPDATED':
            toast.success('Profile updated successfully!');
            break;
        }

        if (mounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (data: SignUpData) => {
    setLoading(true);
    
    try {
      const result = await AuthService.signUp(data);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      toast.success('Account created successfully! Please check your email to verify your account.');
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(error.message || 'Sign up failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (data: SignInData) => {
    setLoading(true);
    
    try {
      console.log('🔐 Attempting to sign in with:', data.email);
      
      const result = await AuthService.signIn(data);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log('✅ Sign in successful');
      toast.success(`Welcome back, ${result.profile?.full_name || 'User'}!`);
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      toast.error(error.message || 'Sign in failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    
    try {
      await AuthService.signOut();
      setProfile(null);
      toast.success('Successfully signed out!');
    } catch (error: any) {
      toast.error(error.message || 'Sign out failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      const updatedProfile = await AuthService.updateProfile(updates);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await AuthService.resetPassword(email);
      toast.success('Password reset email sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      await AuthService.updatePassword(newPassword);
      toast.success('Password updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
      throw error;
    }
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      return await AuthService.checkEmailExists(email);
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };

  const refreshProfile = async () => {
    try {
      if (user) {
        // Clear cache and reload
        AuthService.clearCache();
        const profile = await AuthService.getProfileFast(user.id);
        setProfile(profile);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      resetPassword,
      updatePassword,
      checkEmailExists,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};