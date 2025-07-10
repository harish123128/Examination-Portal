import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'teacher';
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  last_login?: string;
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
}

export interface AuthResult {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  error?: string;
}

export class AuthService {
  private static profileCache = new Map<string, { profile: Profile; expires: number }>();
  private static sessionCache = new Map<string, { session: Session; expires: number }>();

  // Fast sign in with optimized profile loading
  static async signIn(data: SignInData): Promise<AuthResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔐 Starting authentication for:', data.email);

      // Check rate limiting first
      const canAttempt = await this.checkRateLimit(data.email);
      if (!canAttempt) {
        throw new Error('Too many failed login attempts. Please try again in 15 minutes.');
      }

      // Attempt authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (authError) {
        // Log failed attempt
        await this.logLoginAttempt(data.email, false, authError.message);
        throw authError;
      }

      if (!authData.user || !authData.session) {
        await this.logLoginAttempt(data.email, false, 'No user or session returned');
        throw new Error('Authentication failed - no user or session returned');
      }

      // Log successful attempt
      await this.logLoginAttempt(data.email, true);

      // Update last login
      await this.updateLastLogin(authData.user.id);

      // Get profile using fast lookup
      const profile = await this.getProfileFast(authData.user.id);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Authentication completed in ${duration}ms`);

      return {
        user: authData.user,
        profile,
        session: authData.session
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Authentication failed after ${duration}ms:`, error);
      
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Authentication failed'
      };
    }
  }

  // Fast sign up with immediate profile creation
  static async signUp(data: SignUpData): Promise<AuthResult> {
    const startTime = Date.now();
    
    try {
      console.log('📝 Starting registration for:', data.email);

      // Check if email already exists
      const emailExists = await this.checkEmailExists(data.email);
      if (emailExists) {
        throw new Error('An account with this email already exists');
      }

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
        throw authError;
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Registration completed in ${duration}ms`);

      return {
        user: authData.user,
        profile: null, // Profile will be created by trigger
        session: authData.session
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Registration failed after ${duration}ms:`, error);
      
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Registration failed'
      };
    }
  }

  // Fast profile lookup with caching
  static async getProfileFast(userId: string): Promise<Profile | null> {
    try {
      // Check cache first
      const cached = this.profileCache.get(userId);
      if (cached && Date.now() < cached.expires) {
        console.log('📋 Profile loaded from cache');
        return cached.profile;
      }

      console.log('🔍 Loading profile from database');
      const startTime = Date.now();

      const { data, error } = await supabase.rpc('get_profile_fast', {
        p_user_id: userId
      });

      if (error) {
        console.error('Profile lookup error:', error);
        
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fallbackError) {
          console.error('Fallback profile lookup failed:', fallbackError);
          return null;
        }

        const duration = Date.now() - startTime;
        console.log(`📋 Profile loaded via fallback in ${duration}ms`);
        
        // Cache the result
        this.profileCache.set(userId, {
          profile: fallbackData,
          expires: Date.now() + 5 * 60 * 1000 // 5 minutes
        });

        return fallbackData;
      }

      if (!data) {
        console.log('❌ No profile found for user', userId);
        return null;
      }

      const duration = Date.now() - startTime;
      console.log(`📋 Profile loaded from database in ${duration}ms`);

      // Cache the result
      this.profileCache.set(userId, {
        profile: data as Profile,
        expires: Date.now() + 5 * 60 * 1000 // 5 minutes
      });

      return data as Profile;
    } catch (error) {
      console.error('Profile lookup exception:', error);
      return null;
    }
  }

  // Get current session with caching
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

  // Get current user with fast profile
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

      const profile = await this.getProfileFast(session.user.id);

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

  // Fast sign out
  static async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear caches
      this.profileCache.clear();
      this.sessionCache.clear();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Update profile with cache invalidation
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

  // Password reset
  static async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;
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
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  }

  // Check email exists
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

  // Check rate limiting
  private static async checkRateLimit(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_login_rate_limit', {
        p_email: email
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return true; // Allow on error
      }

      return data;
    } catch (error) {
      console.error('Rate limit check exception:', error);
      return true; // Allow on error
    }
  }

  // Log login attempt
  private static async logLoginAttempt(
    email: string, 
    success: boolean, 
    failureReason?: string
  ): Promise<void> {
    try {
      await supabase.rpc('log_login_attempt', {
        p_email: email,
        p_success: success,
        p_failure_reason: failureReason || null
      });
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  }

  // Update last login
  private static async updateLastLogin(userId: string): Promise<void> {
    try {
      await supabase.rpc('update_last_login', {
        user_id: userId
      });
    } catch (error) {
      console.error('Failed to update last login:', error);
    }
  }

  // Clear all caches
  static clearCache(): void {
    this.profileCache.clear();
    this.sessionCache.clear();
  }

  // Performance monitoring
  static getPerformanceMetrics(): Record<string, any> {
    return {
      profileCacheSize: this.profileCache.size,
      sessionCacheSize: this.sessionCache.size,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  private static calculateCacheHitRate(): number {
    // Implementation for cache hit rate calculation
    return 0.85; // Placeholder
  }
}