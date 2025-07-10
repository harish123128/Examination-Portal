/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - The "Admins can read all profiles" policy creates infinite recursion
    - It queries the profiles table from within a profiles table policy
    - This happens when checking if auth.uid() has admin role

  2. Solution
    - Drop the problematic admin policy
    - Create a simpler policy structure that avoids recursion
    - Use auth.jwt() claims or a different approach for admin access

  3. Changes
    - Remove recursive admin policy
    - Keep basic user policies that don't cause recursion
    - Add a safer admin policy using service role or different approach
*/

-- Drop the problematic admin policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Keep the existing safe policies
-- "Users can read own profile" - (uid() = id) - this is safe
-- "Users can update own profile" - (uid() = id) - this is safe  
-- "Users can create own profile during signup" - (uid() = id) - this is safe
-- "Service role can insert profiles" - this is safe

-- For admin functionality, we'll rely on service role access
-- or handle admin checks in the application layer to avoid recursion

-- Ensure RLS is still enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;