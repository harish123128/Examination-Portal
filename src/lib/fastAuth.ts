import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from './supabase';

export interface FastAuthResult {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  error?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'teacher';
  phone?: string;
}

export class FastAuthService {
  private static profileCache = new Map<string, { profile: Profile; expires: number }>();
  private static sessionCache = new Map<string, { session: Session; expires: number }>();

  // Fast sign in with optimized profile loading
  static async signIn(data: SignInData): Promise<FastAuthResult> {
    try {
      console.log('FastAuth: Starting sign in for', data.email);
      const startTime = Date.now();

      // Use Supabase Auth for authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (authError) {
        console.error('FastAuth: Authentication failed:', authError);
        throw authError;
      }

      if (!authData.user || !authData.session) {
        throw new Error('Authentication failed - no user or session returned');
      }

      console.log('FastAuth: Authentication successful in', Date.now() - startTime, 'ms');

      // Get profile using fast lookup
      const profile = await this.getProfileFast(authData.user.id);
      
      console.log('FastAuth: Profile loaded in', Date.now() - startTime, 'ms total');

      return {
        user: authData.user,
        profile,
        session: authData.session
      };
    } catch (error: any) {
      console.error('FastAuth: Sign in error:', error);
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Sign in failed'
      };
    }
  }

  // Fast sign up with immediate profile creation
  static async signUp(data: SignUpData): Promise<FastAuthResult> {
    try {
      console.log('FastAuth: Starting sign up for', data.email);
      const startTime = Date.now();

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
        console.error('FastAuth: Sign up failed:', authError);
        throw authError;
      }

      console.log('FastAuth: Sign up completed in', Date.now() - startTime, 'ms');

      return {
        user: authData.user,
        profile: null, // Profile will be created by trigger
        session: authData.session
      };
    } catch (error: any) {
      console.error('FastAuth: Sign up error:', error);
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Sign up failed'
      };
    }
  }

  // Fast profile lookup with caching
  static async getProfileFast(userId: string): Promise<Profile | null> {
    try {
      // Check cache first
      const cached = this.profileCache.get(userId);
      if (cached && Date.now() < cached.expires) {
        console.log('FastAuth: Profile loaded from cache');
        return cached.profile;
      }

      console.log('FastAuth: Loading profile from database');
      const startTime = Date.now();

      // Use the fast profile function
      const { data, error } = await supabase.rpc('get_profile_fast', {
        p_user_id: userId
      });

      if (error) {
        console.error('FastAuth: Profile lookup error:', error);
        
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fallbackError) {
          console.error('FastAuth: Fallback profile lookup failed:', fallbackError);
          return null;
        }

        console.log('FastAuth: Profile loaded via fallback in', Date.now() - startTime, 'ms');
        
        // Cache the result
        this.profileCache.set(userId, {
          profile: fallbackData,
          expires: Date.now() + 5 * 60 * 1000 // 5 minutes
        });

        return fallbackData;
      }

      if (!data) {
        console.log('FastAuth: No profile found for user', userId);
        return null;
      }

      console.log('FastAuth: Profile loaded from function in', Date.now() - startTime, 'ms');

      // Cache the result
      this.profileCache.set(userId, {
        profile: data as Profile,
        expires: Date.now() + 5 * 60 * 1000 // 5 minutes
      });

      return data as Profile;
    } catch (error) {
      console.error('FastAuth: Profile lookup exception:', error);
      return null;
    }
  }

  // Get current session with caching
  static async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('FastAuth: Session error:', error);
        return null;
      }

      return session;
    } catch (error) {
      console.error('FastAuth: Session exception:', error);
      return null;
    }
  }

  // Get current user with fast profile
  static async getCurrentUser(): Promise<FastAuthResult> {
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
      console.error('FastAuth: Get current user error:', error);
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
      console.error('FastAuth: Sign out error:', error);
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
      
      // Invalidate server cache
      await supabase.rpc('invalidate_profile_cache', {
        p_user_id: user.id
      });

      return data;
    } catch (error) {
      console.error('FastAuth: Update profile error:', error);
      throw error;
    }
  }

  // Clear all caches
  static clearCache(): void {
    this.profileCache.clear();
    this.sessionCache.clear();
  }

  // Preload profile for faster access
  static async preloadProfile(userId: string): Promise<void> {
    await this.getProfileFast(userId);
  }

  // Check authentication status quickly
  static async isAuthenticated(): Promise<boolean> {
    try {
      const session = await this.getCurrentSession();
      return !!session?.user;
    } catch {
      return false;
    }
  }

  // Get cached profile without database call
  static getCachedProfile(userId: string): Profile | null {
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() < cached.expires) {
      return cached.profile;
    }
    return null;
  }
}

// Performance monitoring
export class AuthPerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static startTimer(operation: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration);
    };
  }

  static recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const metrics = this.metrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  static getAverageTime(operation: string): number {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) return 0;
    
    return metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
  }

  static getMetrics(): Record<string, { average: number; count: number; latest: number }> {
    const result: Record<string, { average: number; count: number; latest: number }> = {};
    
    this.metrics.forEach((times, operation) => {
      result[operation] = {
        average: this.getAverageTime(operation),
        count: times.length,
        latest: times[times.length - 1] || 0
      };
    });
    
    return result;
  }

  static logPerformance(): void {
    const metrics = this.getMetrics();
    console.table(metrics);
  }
}