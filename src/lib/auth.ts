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
  email_verified: boolean;
  phone_verified: boolean;
  two_factor_enabled: boolean;
  last_login?: string;
  login_count: number;
  failed_login_attempts: number;
  locked_until?: string;
  password_changed_at?: string;
  preferences: Record<string, any>;
  metadata: Record<string, any>;
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

export interface SecurityEvent {
  event_type: string;
  event_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  risk_score?: number;
}

export class PaperlyAuth {
  private static profileCache = new Map<string, { profile: Profile; expires: number }>();
  private static sessionCache = new Map<string, { session: Session; expires: number }>();
  private static performanceMetrics = new Map<string, number[]>();

  // Performance monitoring
  private static startTimer(operation: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration);
      console.log(`🚀 Paperly ${operation} completed in ${duration}ms`);
    };
  }

  private static recordMetric(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  // Get client information for security tracking
  private static async getClientInfo(): Promise<{
    ip_address?: string;
    user_agent: string;
    device_info: Record<string, any>;
  }> {
    const user_agent = navigator.userAgent;
    let ip_address: string | undefined;

    try {
      // Get IP address from a reliable service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ip_address = data.ip;
    } catch (error) {
      console.warn('Could not fetch IP address:', error);
    }

    const device_info = {
      platform: navigator.platform,
      language: navigator.language,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    };

    return { ip_address, user_agent, device_info };
  }

  // Enhanced sign in with security tracking
  static async signIn(data: SignInData): Promise<AuthResult> {
    const endTimer = this.startTimer('signIn');
    
    try {
      console.log('🔐 Paperly: Starting enhanced authentication for:', data.email);
      
      const clientInfo = await this.getClientInfo();
      
      // Check rate limiting
      const canAttempt = await this.checkRateLimit(data.email, 'login');
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
        await this.logSecurityEvent(null, 'login_failed', {
          email: data.email,
          error: authError.message,
          ...clientInfo
        });
        
        throw authError;
      }

      if (!authData.user || !authData.session) {
        throw new Error('Authentication failed - no user or session returned');
      }

      // Get profile using fast lookup
      const profile = await this.getProfileFast(authData.user.id);
      
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Check if account is active
      if (!profile.is_active) {
        throw new Error('Account is deactivated. Please contact support.');
      }

      // Check if account is locked
      if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      // Create user session
      await this.createUserSession(
        authData.user.id,
        authData.session.access_token,
        authData.session.refresh_token,
        clientInfo
      );

      // Update last login
      await this.updateLastLogin(authData.user.id);

      // Log successful login
      await this.logSecurityEvent(authData.user.id, 'login_success', {
        email: data.email,
        remember_me: data.rememberMe,
        ...clientInfo
      });

      endTimer();

      return {
        user: authData.user,
        profile,
        session: authData.session
      };
    } catch (error: any) {
      endTimer();
      console.error('❌ Paperly authentication failed:', error);
      
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Authentication failed'
      };
    }
  }

  // Enhanced sign up with comprehensive validation
  static async signUp(data: SignUpData): Promise<AuthResult> {
    const endTimer = this.startTimer('signUp');
    
    try {
      console.log('📝 Paperly: Starting enhanced registration for:', data.email);
      
      const clientInfo = await this.getClientInfo();

      // Check if email already exists
      const emailExists = await this.checkEmailExists(data.email);
      if (emailExists) {
        throw new Error('An account with this email already exists');
      }

      // Validate password strength
      const passwordValidation = this.validatePasswordStrength(data.password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password is too weak: ${passwordValidation.errors.join(', ')}`);
      }

      // Create auth user
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

      if (authData.user) {
        // Log registration event
        await this.logSecurityEvent(authData.user.id, 'registration_success', {
          email: data.email,
          role: data.role,
          ...clientInfo
        });

        // Create email verification token if needed
        if (!authData.user.email_confirmed_at) {
          await this.createEmailVerificationToken(authData.user.id, data.email);
        }
      }

      endTimer();

      return {
        user: authData.user,
        profile: null, // Profile will be created by trigger
        session: authData.session
      };
    } catch (error: any) {
      endTimer();
      console.error('❌ Paperly registration failed:', error);
      
      return {
        user: null,
        profile: null,
        session: null,
        error: error.message || 'Registration failed'
      };
    }
  }

  // Fast profile lookup with intelligent caching
  static async getProfileFast(userId: string): Promise<Profile | null> {
    try {
      // Check cache first
      const cached = this.profileCache.get(userId);
      if (cached && Date.now() < cached.expires) {
        console.log('📋 Paperly: Profile loaded from cache');
        return cached.profile;
      }

      console.log('🔍 Paperly: Loading profile from database');
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
        console.log(`📋 Paperly: Profile loaded via fallback in ${duration}ms`);
        
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
      console.log(`📋 Paperly: Profile loaded from database in ${duration}ms`);

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

  // Enhanced session management
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

  // Get current user with comprehensive data
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

  // Enhanced sign out with session cleanup
  static async signOut(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Log sign out event
        await this.logSecurityEvent(user.id, 'logout', {
          timestamp: new Date().toISOString()
        });

        // Deactivate user sessions
        await supabase
          .from('user_sessions')
          .update({ is_active: false })
          .eq('user_id', user.id);
      }

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

  // Password strength validation
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    strength: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let strength = 0;

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else {
      strength++;
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      strength++;
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      strength++;
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      strength++;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      strength++;
    }

    return {
      isValid: errors.length === 0,
      strength,
      errors
    };
  }

  // Rate limiting check
  private static async checkRateLimit(
    identifier: string,
    action: string,
    maxAttempts: number = 5,
    windowMinutes: number = 15
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_identifier: identifier,
        p_action: action,
        p_max_attempts: maxAttempts,
        p_window_minutes: windowMinutes
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

  // Create user session
  private static async createUserSession(
    userId: string,
    sessionToken: string,
    refreshToken?: string,
    clientInfo?: any
  ): Promise<void> {
    try {
      await supabase.rpc('create_user_session', {
        p_user_id: userId,
        p_session_token: sessionToken,
        p_refresh_token: refreshToken,
        p_device_info: clientInfo?.device_info || {},
        p_ip_address: clientInfo?.ip_address,
        p_user_agent: clientInfo?.user_agent,
        p_expires_hours: 24
      });
    } catch (error) {
      console.error('Failed to create user session:', error);
    }
  }

  // Log security events
  private static async logSecurityEvent(
    userId: string | null,
    eventType: string,
    eventData: any = {}
  ): Promise<void> {
    try {
      await supabase.rpc('log_security_event', {
        p_user_id: userId,
        p_event_type: eventType,
        p_event_data: eventData,
        p_ip_address: eventData.ip_address,
        p_user_agent: eventData.user_agent,
        p_risk_score: eventData.risk_score || 0
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // Update last login
  private static async updateLastLogin(userId: string): Promise<void> {
    try {
      await supabase.rpc('update_last_login', {
        p_user_id: userId
      });
    } catch (error) {
      console.error('Failed to update last login:', error);
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

  // Create email verification token
  private static async createEmailVerificationToken(
    userId: string,
    email: string
  ): Promise<void> {
    try {
      await supabase.rpc('create_email_verification_token', {
        p_user_id: userId,
        p_email: email
      });
    } catch (error) {
      console.error('Failed to create email verification token:', error);
    }
  }

  // Password reset
  static async resetPassword(email: string): Promise<void> {
    try {
      const clientInfo = await this.getClientInfo();
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;

      // Log password reset request
      await this.logSecurityEvent(null, 'password_reset_requested', {
        email,
        ...clientInfo
      });
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  // Update password
  static async updatePassword(newPassword: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Validate password strength
      const passwordValidation = this.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Password is too weak: ${passwordValidation.errors.join(', ')}`);
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Update password changed timestamp
      await supabase
        .from('profiles')
        .update({ 
          password_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      // Log password change
      await this.logSecurityEvent(user.id, 'password_changed', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update password error:', error);
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

      // Log profile update
      await this.logSecurityEvent(user.id, 'profile_updated', {
        updated_fields: Object.keys(updates),
        timestamp: new Date().toISOString()
      });

      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  // Get performance metrics
  static getPerformanceMetrics(): Record<string, {
    average: number;
    count: number;
    latest: number;
  }> {
    const result: Record<string, { average: number; count: number; latest: number }> = {};
    
    this.performanceMetrics.forEach((times, operation) => {
      const average = times.reduce((sum, time) => sum + time, 0) / times.length;
      result[operation] = {
        average: Math.round(average),
        count: times.length,
        latest: times[times.length - 1] || 0
      };
    });
    
    return result;
  }

  // Clear all caches
  static clearCache(): void {
    this.profileCache.clear();
    this.sessionCache.clear();
  }

  // Cleanup expired data
  static async cleanupExpiredData(): Promise<void> {
    try {
      await supabase.rpc('cleanup_expired_data');
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
    }
  }
}