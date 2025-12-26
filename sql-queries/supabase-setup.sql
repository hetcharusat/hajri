-- HAJRI Admin Panel - Supabase Setup (PROPER VERSION)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 0. Clean up old schema if exists
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Create users table linked to auth.users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Users can ALWAYS read their own data (no circular dependency)
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 4. Policy: Allow insert for new authenticated users (auto-registration)
CREATE POLICY "Users can insert themselves"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 5. Policy: Admins can update OTHER users (not themselves)
-- This uses a subquery that's evaluated AFTER the user's own row is readable
CREATE POLICY "Admins can update other users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    auth.uid() != users.id  -- Can only update OTHER users
    AND (
      -- Check if current user is admin by looking at their own row
      SELECT u.is_admin FROM users u WHERE u.id = auth.uid()
    ) = true
  )
  WITH CHECK (
    auth.uid() != users.id  -- Can't make yourself admin
    AND (
      SELECT u.is_admin FROM users u WHERE u.id = auth.uid()
    ) = true
  );

-- 6. Create RPC function for admins to view all users (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  is_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can view all users';
  END IF;

  -- Return all users
  RETURN QUERY
  SELECT u.id, u.email, u.is_admin, u.created_at, u.updated_at
  FROM users u
  ORDER BY u.created_at DESC;
END;
$$;

-- 7. Create function to auto-add user on first login
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_admin)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger to auto-add user on signup/login
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 9. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Manually add your current user as admin (get your UUID from auth.users table)
-- First, find your user ID by running:
-- SELECT id, email FROM auth.users WHERE email = 'hetp2758@gmail.com';
-- Then insert with that ID, OR just run this after you sign in once:

-- This will work after you sign in at least once:
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Get the UUID of the user with your email
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'hetp2758@gmail.com';
  
  IF user_uuid IS NOT NULL THEN
    -- Insert or update the user as admin
    INSERT INTO users (id, email, is_admin)
    VALUES (user_uuid, 'hetp2758@gmail.com', true)
    ON CONFLICT (id) DO UPDATE SET is_admin = true;
    
    RAISE NOTICE 'Admin user created/updated successfully';
  ELSE
    RAISE NOTICE 'User not found. Please sign in with Google first, then run this script again.';
  END IF;
END $$;

-- Done! 
-- IMPORTANT: Sign in with Google FIRST, then run this script.
-- After running, refresh your admin panel.
