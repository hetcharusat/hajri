-- Debug: Check user setup
-- Run this in Supabase SQL Editor

-- 1. Check if user exists in auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'hetp2758@gmail.com';

-- 2. Check if user exists in users table
SELECT id, email, is_admin, created_at 
FROM users 
WHERE email = 'hetp2758@gmail.com';

-- 3. If user doesn't exist in users table, insert them:
-- (Copy the UUID from query #1 and paste below)

INSERT INTO users (id, email, is_admin)
SELECT id, email, true
FROM auth.users
WHERE email = 'hetp2758@gmail.com'
ON CONFLICT (id) DO UPDATE SET is_admin = true;

-- 4. Verify it worked:
SELECT u.id, u.email, u.is_admin, au.id as auth_id
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'hetp2758@gmail.com';
