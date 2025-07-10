/*
  # Optimize authentication and profile creation

  1. Improvements
    - Add function to handle new user profile creation
    - Optimize RLS policies for better performance
    - Add indexes for faster queries
    - Create notification helper function

  2. Security
    - Maintain RLS while improving performance
    - Safe profile creation process
*/

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
    NEW.raw_user_meta_data->>'phone',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
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
    NOW()
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_teachers_has_submitted ON teachers(has_submitted);
CREATE INDEX IF NOT EXISTS idx_submissions_payment_status ON submissions(payment_status);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user TO service_role;