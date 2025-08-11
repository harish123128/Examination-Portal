import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'teacher';
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'teacher';
  phone?: string;
}

export interface SignInData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  error?: string;
}

export class PaperlyAuth {
  private static profileCache = new Map<string, { profile: Profile; expires: number }>();

  // Sign in with email and password
  static async signIn(data: SignInData): Promise<AuthResult> {
    try {
      console.log('🔐 Paperly: Starting authentication for:', data.email);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (authError) {
        console.error('❌ Authentication failed:', authError);
        throw authError;
      }

      if (!authData.user || !authData.session) {
        throw new Error('Authentication failed - no user or session returned');
      }

      // Get user profile
      const profile = await this.getProfile(authData.user.id);
      
      console.log('✅ Authentication successful for:', data.email);

      return {
        user: authData.user,
        profile,
        session: authData.session
      };
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Sign in failed'
      };
    }
  }

  // Sign up with email and password
  static async signUp(data: SignUpData): Promise<AuthResult> {
    try {
      console.log('📝 Paperly: Starting registration for:', data.email);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            role: data.role,
            phone: data.phone || null
          }
        }
      });

      if (authError) {
        console.error('❌ Registration failed:', authError);
        throw authError;
      }

      console.log('✅ Registration successful for:', data.email);

      return {
        user: authData.user,
        profile: null, // Profile will be created by trigger
        session: authData.session
      };
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Sign up failed'
      };
    }
  }

  // Get user profile
  static async getProfile(userId: string): Promise<Profile | null> {
    try {
      // Check cache first
      const cached = this.profileCache.get(userId);
      if (cached && Date.now() < cached.expires) {
        console.log('📋 Profile loaded from cache');
        return cached.profile;
      }

      console.log('🔍 Loading profile from database');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile lookup error:', error);
        return null;
      }

      if (!data) {
        console.log('❌ No profile found for user', userId);
        return null;
      }

      // Cache the result
      this.profileCache.set(userId, {
        profile: data,
        expires: Date.now() + 5 * 60 * 1000 // 5 minutes
      });

      return data as Profile;
    } catch (error) {
      console.error('Profile lookup exception:', error);
      return null;
    }
  }

  // Get current session
  static async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Session exception:', error);
      return null;
    }
  }

  // Get current user with profile
  static async getCurrentUser(): Promise<AuthResult> {
    try {
      const session = await this.getCurrentSession();
      
      if (!session?.user) {
        return {
          user: null,
          profile: null,
          session: null
        };
      }

      const profile = await this.getProfile(session.user.id);

      return {
        user: session.user,
        profile,
        session
      };
    } catch (error: any) {
      console.error('Get current user error:', error);
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message
      };
    }
  }

  // Sign out
  static async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear cache
      this.profileCache.clear();
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Reset password
  static async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;
      console.log('✅ Password reset email sent');
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  // Update password
  static async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      console.log('✅ Password updated successfully');
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  }

  // Update profile
  static async updateProfile(updates: Partial<Profile>): Promise<Profile | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      this.profileCache.delete(user.id);

      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  // Check if email exists
  static async checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      
      return !!data;
    } catch {
      return false;
    }
  }

  // Clear cache
  static clearCache(): void {
    this.profileCache.clear();
  }
}