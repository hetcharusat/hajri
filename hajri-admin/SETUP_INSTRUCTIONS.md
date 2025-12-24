# PROPER SETUP - Read This First!

## 🎯 How It Works Now

**PROPER LOGIC:**
1. User signs in with Google → automatically added to `users` table
2. Admin goes to Settings page → sees ALL users
3. Admin clicks status badge to toggle `is_admin` (true/false)
4. User with `is_admin = true` gets access, others see "Access Denied"

## 📋 Setup Steps

### Step 1: Run SQL in Supabase
1. Go to **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy ALL content from `supabase-setup.sql`
3. Click **RUN**

**What it does:**
- Creates `users` table with `id` (UUID from auth.users), `email`, `is_admin` (boolean)
- Auto-adds new users when they sign in with Google (trigger)
- Creates RLS policies so admins can see/edit all users
- Tries to make you (hetp2758@gmail.com) admin automatically

### Step 2: Sign In First Time
1. Go to http://localhost:3000
2. Click "Sign in with Google"
3. Complete OAuth
4. You'll see "Access Denied" (because is_admin = false by default)

### Step 3: Make Yourself Admin
**Option A - If the SQL script worked:**
- Just refresh the page - you should have access

**Option B - If you still see "Access Denied":**
1. Go to Supabase → **Table Editor** → **users** table
2. Find your email (hetp2758@gmail.com)
3. Click the row
4. Change `is_admin` from `false` to `true`
5. Save
6. Refresh admin panel

### Step 4: Manage Other Users
1. Sign out
2. Have someone else sign in with Google
3. Sign back in as admin
4. Go to **Settings** page
5. You'll see all users with toggle buttons
6. Click status badge to toggle admin access

## 🎨 How to Toggle Admin

In the **Settings** page, each user has a status badge:
- 🟢 **Green "Active"** = is_admin = true (has access)
- 🟠 **Orange "Inactive"** = is_admin = false (no access)

**Just click the badge** to toggle between Active/Inactive!

## 🔒 Security

- Uses auth.uid() from Supabase Auth (proper UUID matching)
- Only admins can see the Settings page
- Only admins can toggle other users' admin status
- Users can only see their own admin status
- No manual email entry needed - users auto-appear after first sign-in

## ✅ What's Fixed

- ❌ OLD: Used email matching (UID mismatch issues)
- ✅ NEW: Uses auth.uid() - proper UUID from Google OAuth
- ❌ OLD: Manual email entry to add admins
- ✅ NEW: Auto-adds users on first sign-in, toggle status in UI
- ❌ OLD: admin_users table separate from auth
- ✅ NEW: users table linked to auth.users via foreign key

Done!
