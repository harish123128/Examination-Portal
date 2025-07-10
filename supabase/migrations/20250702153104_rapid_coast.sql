/*
  # Fix user signup database error

  1. Database Functions
    - Create function to handle new user profile creation
    - Set up proper trigger for auth.users table

  2. Security Updates
    - Add proper RLS policies for profile creation
    - Ensure authenticated users can create their own profiles

  3. Schema Fixes
    - Remove foreign key constraint that references non-existent users table
    - Add proper constraints and defaults
*/

-- First, drop the problematic foreign key constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'teacher'),
    COALESCE(new.raw_user_meta_data->>'phone', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Add RLS policy for profile creation during signup
DROP POLICY IF EXISTS "Users can create own profile during signup" ON profiles;
CREATE POLICY "Users can create own profile during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Add RLS policy for service role to insert profiles (needed for the trigger)
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
CREATE POLICY "Service role can insert profiles"
  ON profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure the profiles table has proper constraints
ALTER TABLE profiles 
  ALTER COLUMN full_name SET DEFAULT '',
  ALTER COLUMN role SET DEFAULT 'teacher';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);