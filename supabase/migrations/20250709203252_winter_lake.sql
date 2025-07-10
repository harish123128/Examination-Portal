/*
  # Complete Real-time System with Advanced Features

  1. Enhanced Tables
    - Add real-time subscriptions support
    - URL validation and tracking
    - Advanced security features
    - Performance optimizations

  2. Real-time Features
    - Live notifications
    - Real-time status updates
    - URL validation tracking
    - Session management

  3. Security Enhancements
    - Advanced audit logging
    - Rate limiting
    - IP tracking
    - Session validation
*/

-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE teachers;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Create URL validation tracking table
CREATE TABLE IF NOT EXISTS url_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  token_type text NOT NULL CHECK (token_type IN ('submission', 'invitation', 'reset', 'verification')),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address inet,
  user_agent text,
  is_valid boolean DEFAULT true,
  validation_count integer DEFAULT 0,
  last_validated_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- IP address or user ID
  action text NOT NULL, -- login, signup, validation, etc.
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create real-time events table
CREATE TABLE IF NOT EXISTS realtime_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  data jsonb,
  channel text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE url_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for url_validations
CREATE POLICY "Users can view own URL validations"
  ON url_validations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage URL validations"
  ON url_validations
  FOR ALL
  TO service_role
  USING (true);

-- RLS policies for rate_limits
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits
  FOR ALL
  TO service_role
  USING (true);

-- RLS policies for realtime_events
CREATE POLICY "Users can view relevant events"
  ON realtime_events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to validate URLs with rate limiting
CREATE OR REPLACE FUNCTION validate_url_token(
  p_token text,
  p_token_type text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  validation_record url_validations%ROWTYPE;
  result jsonb;
BEGIN
  -- Check rate limiting
  IF p_ip_address IS NOT NULL THEN
    PERFORM check_rate_limit(p_ip_address::text, 'url_validation', 10, interval '1 minute');
  END IF;

  -- Find validation record
  SELECT * INTO validation_record
  FROM url_validations
  WHERE token = p_token AND token_type = p_token_type;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid token',
      'code', 'INVALID_TOKEN'
    );
  END IF;

  -- Check if expired
  IF validation_record.expires_at < now() THEN
    UPDATE url_validations
    SET is_valid = false
    WHERE id = validation_record.id;
    
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Token expired',
      'code', 'TOKEN_EXPIRED'
    );
  END IF;

  -- Check if already invalid
  IF NOT validation_record.is_valid THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Token already used or invalidated',
      'code', 'TOKEN_INVALID'
    );
  END IF;

  -- Update validation count
  UPDATE url_validations
  SET 
    validation_count = validation_count + 1,
    last_validated_at = now(),
    ip_address = COALESCE(p_ip_address, ip_address),
    user_agent = COALESCE(p_user_agent, user_agent)
  WHERE id = validation_record.id;

  -- Log security event
  INSERT INTO security_events (user_id, event_type, description, ip_address, user_agent, metadata)
  VALUES (
    validation_record.user_id,
    'url_validation',
    'URL token validated: ' || p_token_type,
    p_ip_address,
    p_user_agent,
    jsonb_build_object(
      'token_type', p_token_type,
      'validation_count', validation_record.validation_count + 1
    )
  );

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', validation_record.user_id,
    'token_type', p_token_type,
    'validation_count', validation_record.validation_count + 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_attempts integer,
  p_window_duration interval
)
RETURNS boolean AS $$
DECLARE
  current_count integer;
  rate_record rate_limits%ROWTYPE;
BEGIN
  -- Get current rate limit record
  SELECT * INTO rate_record
  FROM rate_limits
  WHERE identifier = p_identifier AND action = p_action;

  IF NOT FOUND THEN
    -- Create new rate limit record
    INSERT INTO rate_limits (identifier, action, count, window_start)
    VALUES (p_identifier, p_action, 1, now());
    RETURN true;
  END IF;

  -- Check if we're still in the same window
  IF rate_record.window_start + p_window_duration > now() THEN
    -- Still in window, check count
    IF rate_record.count >= p_max_attempts THEN
      -- Update blocked_until
      UPDATE rate_limits
      SET blocked_until = now() + p_window_duration
      WHERE id = rate_record.id;
      
      RAISE EXCEPTION 'Rate limit exceeded for % on %', p_action, p_identifier;
    ELSE
      -- Increment count
      UPDATE rate_limits
      SET count = count + 1, updated_at = now()
      WHERE id = rate_record.id;
    END IF;
  ELSE
    -- New window, reset count
    UPDATE rate_limits
    SET count = 1, window_start = now(), blocked_until = NULL, updated_at = now()
    WHERE id = rate_record.id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create real-time event
CREATE OR REPLACE FUNCTION create_realtime_event(
  p_event_type text,
  p_user_id uuid,
  p_data jsonb DEFAULT NULL,
  p_channel text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO realtime_events (event_type, user_id, data, channel)
  VALUES (p_event_type, p_user_id, p_data, p_channel)
  RETURNING id INTO event_id;
  
  -- Notify real-time subscribers
  PERFORM pg_notify(
    COALESCE(p_channel, 'realtime_events'),
    jsonb_build_object(
      'event_id', event_id,
      'event_type', p_event_type,
      'user_id', p_user_id,
      'data', p_data
    )::text
  );
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create submission token with validation
CREATE OR REPLACE FUNCTION create_submission_token(
  p_teacher_id uuid,
  p_expires_in interval DEFAULT interval '7 days'
)
RETURNS text AS $$
DECLARE
  token text;
  expires_at timestamptz;
BEGIN
  -- Generate secure token
  token := encode(gen_random_bytes(32), 'hex');
  expires_at := now() + p_expires_in;
  
  -- Update teacher record
  UPDATE teachers
  SET 
    submission_token = token,
    token_expires_at = expires_at,
    updated_at = now()
  WHERE id = p_teacher_id;
  
  -- Create URL validation record
  INSERT INTO url_validations (token, token_type, user_id, expires_at)
  SELECT token, 'submission', profile_id, expires_at
  FROM teachers
  WHERE id = p_teacher_id;
  
  -- Create real-time event
  PERFORM create_realtime_event(
    'token_created',
    (SELECT profile_id FROM teachers WHERE id = p_teacher_id),
    jsonb_build_object(
      'token_type', 'submission',
      'expires_at', expires_at
    ),
    'teacher_events'
  );
  
  RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced notification function with real-time
CREATE OR REPLACE FUNCTION create_notification_realtime(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_related_id uuid DEFAULT NULL,
  p_related_type text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    title,
    message,
    type,
    related_id,
    related_type,
    created_at
  ) VALUES (
    p_recipient_id,
    p_title,
    p_message,
    p_type,
    p_related_id,
    p_related_type,
    now()
  ) RETURNING id INTO notification_id;
  
  -- Create real-time event
  PERFORM create_realtime_event(
    'notification_created',
    p_recipient_id,
    jsonb_build_object(
      'notification_id', notification_id,
      'title', p_title,
      'message', p_message,
      'type', p_type
    ),
    'user_' || p_recipient_id::text
  );
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for real-time submission updates
CREATE OR REPLACE FUNCTION notify_submission_change()
RETURNS trigger AS $$
BEGIN
  -- Notify teacher
  PERFORM create_realtime_event(
    'submission_updated',
    (SELECT profile_id FROM teachers WHERE id = NEW.teacher_id),
    jsonb_build_object(
      'submission_id', NEW.id,
      'status', NEW.status,
      'payment_status', NEW.payment_status,
      'payment_amount', NEW.payment_amount
    ),
    'teacher_' || (SELECT profile_id FROM teachers WHERE id = NEW.teacher_id)::text
  );
  
  -- Notify admin
  PERFORM create_realtime_event(
    'submission_updated',
    NEW.reviewed_by,
    jsonb_build_object(
      'submission_id', NEW.id,
      'status', NEW.status,
      'teacher_id', NEW.teacher_id
    ),
    'admin_events'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS submission_realtime_trigger ON submissions;
CREATE TRIGGER submission_realtime_trigger
  AFTER UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_submission_change();

-- Function to clean up expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  -- Clean up expired URL validations
  DELETE FROM url_validations WHERE expires_at < now();
  
  -- Clean up old rate limit records
  DELETE FROM rate_limits WHERE window_start < now() - interval '1 day';
  
  -- Clean up old real-time events
  DELETE FROM realtime_events WHERE created_at < now() - interval '7 days';
  
  -- Clean up old security events
  DELETE FROM security_events WHERE created_at < now() - interval '30 days';
  
  -- Clean up old login attempts
  DELETE FROM login_attempts WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_url_validations_token ON url_validations(token);
CREATE INDEX IF NOT EXISTS idx_url_validations_expires ON url_validations(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_realtime_events_user ON realtime_events(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_channel ON realtime_events(channel);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created ON realtime_events(created_at);

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_url_token TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_realtime_event TO authenticated;
GRANT EXECUTE ON FUNCTION create_submission_token TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_realtime TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_data TO service_role;

-- Enable real-time on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE url_validations;
ALTER PUBLICATION supabase_realtime ADD TABLE realtime_events;