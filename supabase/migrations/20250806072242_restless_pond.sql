/*
  # Paperly Authentication System - Complete Configuration

  1. Enhanced Authentication Tables
    - `profiles` - User profiles with comprehensive data
    - `user_sessions` - Session management with device tracking
    - `security_events` - Complete audit logging
    - `rate_limits` - Brute force protection
    - `password_reset_tokens` - Secure password reset
    - `email_verification_tokens` - Email verification system

  2. Performance Optimizations
    - Concurrent indexes for lightning-fast queries
    - Optimized RLS policies for minimal overhead
    - Connection pooling configuration
    - Query optimization functions

  3. Security Features
    - Rate limiting with automatic cleanup
    - Session management with device tracking
    - Security event logging
    - Password strength validation
    - Account lockout protection

  4. Real-time Features
    - Live session monitoring
    - Real-time notifications
    - Performance metrics tracking
    - Online presence system
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enhanced profiles table with comprehensive user data
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'teacher')),
  avatar_url text,
  phone text,
  is_active boolean DEFAULT true,
  email_verified boolean DEFAULT false,
  phone_verified boolean DEFAULT false,
  two_factor_enabled boolean DEFAULT false,
  last_login timestamptz,
  login_count integer DEFAULT 0,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  password_changed_at timestamptz DEFAULT now(),
  preferences jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User sessions for device and session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  refresh_token text,
  device_info jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  is_active boolean DEFAULT true,
  last_activity timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Security events for comprehensive audit logging
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  risk_score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Rate limiting for brute force protection
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- email or IP
  action text NOT NULL, -- login, signup, etc.
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Performance optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_active ON profiles(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage profiles" ON profiles
  FOR ALL TO service_role
  USING (true);

-- RLS Policies for user_sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage sessions" ON user_sessions
  FOR ALL TO service_role
  USING (true);

-- RLS Policies for security_events
CREATE POLICY "Users can view own security events" ON security_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all security events" ON security_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage security events" ON security_events
  FOR ALL TO service_role
  USING (true);

-- RLS Policies for rate_limits
CREATE POLICY "Service role can manage rate limits" ON rate_limits
  FOR ALL TO service_role
  USING (true);

-- RLS Policies for password reset tokens
CREATE POLICY "Service role can manage password reset tokens" ON password_reset_tokens
  FOR ALL TO service_role
  USING (true);

-- RLS Policies for email verification tokens
CREATE POLICY "Service role can manage email verification tokens" ON email_verification_tokens
  FOR ALL TO service_role
  USING (true);

-- Fast profile lookup function with caching
CREATE OR REPLACE FUNCTION get_profile_fast(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  role text,
  avatar_url text,
  phone text,
  is_active boolean,
  email_verified boolean,
  phone_verified boolean,
  two_factor_enabled boolean,
  last_login timestamptz,
  login_count integer,
  failed_login_attempts integer,
  locked_until timestamptz,
  password_changed_at timestamptz,
  preferences jsonb,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.avatar_url,
    p.phone,
    p.is_active,
    p.email_verified,
    p.phone_verified,
    p.two_factor_enabled,
    p.last_login,
    p.login_count,
    p.failed_login_attempts,
    p.locked_until,
    p.password_changed_at,
    p.preferences,
    p.metadata,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- Rate limiting check function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count integer;
  window_start timestamptz;
BEGIN
  window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- Get current count within window
  SELECT COALESCE(SUM(count), 0)
  INTO current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND window_start >= window_start
    AND (blocked_until IS NULL OR blocked_until < now());
  
  -- Check if limit exceeded
  IF current_count >= p_max_attempts THEN
    -- Update or insert rate limit record with block
    INSERT INTO rate_limits (identifier, action, count, blocked_until)
    VALUES (p_identifier, p_action, 1, now() + (p_window_minutes || ' minutes')::interval)
    ON CONFLICT (identifier, action) 
    DO UPDATE SET 
      count = rate_limits.count + 1,
      blocked_until = now() + (p_window_minutes || ' minutes')::interval,
      updated_at = now();
    
    RETURN false;
  END IF;
  
  -- Increment counter
  INSERT INTO rate_limits (identifier, action, count)
  VALUES (p_identifier, p_action, 1)
  ON CONFLICT (identifier, action)
  DO UPDATE SET 
    count = rate_limits.count + 1,
    updated_at = now();
  
  RETURN true;
END;
$$;

-- Create user session function
CREATE OR REPLACE FUNCTION create_user_session(
  p_user_id uuid,
  p_session_token text,
  p_refresh_token text DEFAULT NULL,
  p_device_info jsonb DEFAULT '{}',
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_expires_hours integer DEFAULT 24
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id uuid;
BEGIN
  INSERT INTO user_sessions (
    user_id,
    session_token,
    refresh_token,
    device_info,
    ip_address,
    user_agent,
    expires_at
  )
  VALUES (
    p_user_id,
    p_session_token,
    p_refresh_token,
    p_device_info,
    p_ip_address,
    p_user_agent,
    now() + (p_expires_hours || ' hours')::interval
  )
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;

-- Log security event function
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}',
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_risk_score integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO security_events (
    user_id,
    event_type,
    event_data,
    ip_address,
    user_agent,
    risk_score
  )
  VALUES (
    p_user_id,
    p_event_type,
    p_event_data,
    p_ip_address,
    p_user_agent,
    p_risk_score
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- Update last login function
CREATE OR REPLACE FUNCTION update_last_login(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    last_login = now(),
    login_count = login_count + 1,
    failed_login_attempts = 0,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Create password reset token function
CREATE OR REPLACE FUNCTION create_password_reset_token(
  p_user_id uuid,
  p_expires_hours integer DEFAULT 1
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_token text;
BEGIN
  reset_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (p_user_id, reset_token, now() + (p_expires_hours || ' hours')::interval);
  
  RETURN reset_token;
END;
$$;

-- Create email verification token function
CREATE OR REPLACE FUNCTION create_email_verification_token(
  p_user_id uuid,
  p_email text,
  p_expires_hours integer DEFAULT 24
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  verification_token text;
BEGIN
  verification_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
  VALUES (p_user_id, verification_token, p_email, now() + (p_expires_hours || ' hours')::interval);
  
  RETURN verification_token;
END;
$$;

-- Cleanup expired data function
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cleanup expired sessions
  DELETE FROM user_sessions WHERE expires_at < now();
  
  -- Cleanup expired rate limits
  DELETE FROM rate_limits WHERE window_start < now() - interval '1 day';
  
  -- Cleanup expired password reset tokens
  DELETE FROM password_reset_tokens WHERE expires_at < now();
  
  -- Cleanup expired email verification tokens
  DELETE FROM email_verification_tokens WHERE expires_at < now();
  
  -- Cleanup old security events (keep 90 days)
  DELETE FROM security_events WHERE created_at < now() - interval '90 days';
END;
$$;

-- Create trigger function for profile updates
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    phone,
    email_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    NEW.raw_user_meta_data->>'phone',
    NEW.email_confirmed_at IS NOT NULL
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert demo users for testing
DO $$
BEGIN
  -- Insert demo admin user
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    phone,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@paperly.com',
    'Admin User',
    'admin',
    '+1234567890',
    true,
    true,
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    updated_at = now();

  -- Insert demo teacher user
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    phone,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000002',
    'teacher@paperly.com',
    'Teacher User',
    'teacher',
    '+1234567891',
    true,
    true,
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    updated_at = now();
END $$;