# OAuth & Authentication Guide

## Overview

Complete guide for implementing and troubleshooting OAuth authentication in the Hajri Admin Portal using Supabase and Google OAuth.

## Authentication Architecture

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Browser    │──────►│   Supabase   │──────►│    Google    │
│  (Frontend)  │       │   Auth API   │       │    OAuth     │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                       │
       │  1. signInWithOAuth  │                       │
       │─────────────────────►│                       │
       │                      │  2. Redirect to Google│
       │                      │──────────────────────►│
       │                      │                       │
       │  3. User Authenticates                       │
       │◄─────────────────────────────────────────────│
       │                      │                       │
       │  4. Callback with tokens                     │
       │◄─────────────────────│                       │
       │                      │                       │
       │  5. getSession()     │                       │
       │─────────────────────►│                       │
       │                      │                       │
       │  6. Auth State       │                       │
       │◄─────────────────────│                       │
       │                      │                       │
```

## Setup Guide

### Step 1: Google Cloud Console Configuration

#### 1.1 Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
5. Choose **"Web application"**

#### 1.2 Configure Authorized Origins

Add both development and production URLs:

```
http://localhost:3000
https://hajriadmin.netlify.app
https://etmlimraemfdpvrsgdpk.supabase.co
```

#### 1.3 Configure Redirect URIs

Add Supabase callback URL:

```
https://etmlimraemfdpvrsgdpk.supabase.co/auth/v1/callback
```

#### 1.4 Save Credentials

Copy:
- Client ID: `your-client-id.apps.googleusercontent.com`
- Client Secret: `your-client-secret`

### Step 2: Supabase Configuration

#### 2.1 Enable Google Provider

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and enable it

#### 2.2 Add Google Credentials

Paste the credentials from Google Cloud Console:
- **Client ID:** Your Google OAuth Client ID
- **Client Secret:** Your Google OAuth Client Secret

#### 2.3 Configure Site URL

Set to your production URL:
```
https://hajriadmin.netlify.app
```

For development, you can add:
```
http://localhost:3000
```

#### 2.4 Add Redirect URLs

Add all allowed redirect destinations:

```
https://hajriadmin.netlify.app
https://hajriadmin.netlify.app/
https://hajriadmin.netlify.app/**
http://localhost:3000
http://localhost:3000/
```

### Step 3: Frontend Implementation

#### 3.1 Supabase Client Setup

**File:** `hajri-admin/src/lib/supabase.js`

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
```

#### 3.2 Login Component

**File:** `hajri-admin/src/pages/Login.jsx`

```javascript
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function Login() {
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      })
      
      if (error) throw error
    } catch (error) {
      console.error('Login error:', error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Button onClick={handleGoogleLogin}>
        Login with Google
      </Button>
    </div>
  )
}
```

**Key Implementation Details:**

1. **Dynamic redirectTo:**
   ```javascript
   redirectTo: `${window.location.origin}/`
   ```
   - Uses current domain (localhost or production)
   - Prevents localhost redirect issues in production

2. **Error Handling:**
   - Catches and logs OAuth errors
   - Shows user-friendly error messages

#### 3.3 OAuth Callback Handler

**File:** `hajri-admin/src/App.tsx`

```typescript
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function App() {
  // Handle OAuth callback on app load
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if URL contains OAuth tokens
      const hashParams = new URLSearchParams(
        window.location.hash.substring(1)
      )
      
      if (hashParams.get('access_token')) {
        // Process the session
        await supabase.auth.getSession()
        
        // Clean the URL (remove hash fragment)
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        )
      }
    }
    
    handleOAuthCallback()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Your routes */}
      </Routes>
    </BrowserRouter>
  )
}
```

**Why This Matters:**

1. **Hash Fragment Processing:**
   - OAuth tokens come in URL hash: `#access_token=...`
   - Must be processed before React Router
   - Otherwise tokens are lost during routing

2. **URL Cleanup:**
   - Removes tokens from URL after processing
   - Improves security and UX
   - Prevents token exposure in browser history

#### 3.4 Auth State Management

**File:** `hajri-admin/src/lib/store.js`

```javascript
import { create } from 'zustand'
import { supabase } from './supabase'

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  
  initialize: async () => {
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession()
    set({ user: session?.user ?? null, loading: false })
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null })
    })
  },
  
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  }
}))
```

### Step 4: Admin Permission Check

#### 4.1 AdminGuard Component

**File:** `hajri-admin/src/components/AdminGuard.jsx`

```javascript
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export default function AdminGuard({ children }) {
  const { user, loading: authLoading } = useAuthStore()
  const [isAdmin, setIsAdmin] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setChecking(false)
      setIsAdmin(false)
      return
    }

    checkAdmin()
  }, [user])

  const checkAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        // If user doesn't exist, create with default permissions
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('users')
            .insert([{ 
              id: user.id, 
              email: user.email, 
              is_admin: false 
            }])
          
          if (!insertError) {
            setIsAdmin(false)
          }
        }
        setIsAdmin(false)
      } else {
        setIsAdmin(data?.is_admin === true)
      }
    } catch (e) {
      setIsAdmin(false)
    } finally {
      setChecking(false)
    }
  }

  if (authLoading || checking) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have admin permissions.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
```

#### 4.2 Protected Routes

**File:** `hajri-admin/src/App.tsx`

```typescript
import AdminGuard from '@/components/AdminGuard'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/app/*" element={
        <AdminGuard>
          <MainLayout />
        </AdminGuard>
      } />
    </Routes>
  )
}
```

## Database Setup

### Users Table

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own record
CREATE POLICY "Users can view own data"
  ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Only admins can update admin status
CREATE POLICY "Only admins can modify admin status"
  ON users
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE is_admin = true
    )
  );
```

### Grant Admin Permissions

```sql
-- Make a user admin
UPDATE users
SET is_admin = true
WHERE email = 'your-admin@email.com';
```

## OAuth Flow Explained

### 1. User Clicks Login

```javascript
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/`
  }
})
```

**What Happens:**
- Supabase generates OAuth URL
- Browser redirects to Google login
- User authenticates with Google

### 2. Google Redirects Back

```
https://etmlimraemfdpvrsgdpk.supabase.co/auth/v1/callback
  ?code=...
  &state=...
```

**What Happens:**
- Google sends authorization code to Supabase
- Supabase exchanges code for tokens
- Supabase redirects to your app with tokens in hash

### 3. App Receives Tokens

```
https://hajriadmin.netlify.app/#access_token=...&refresh_token=...
```

**What Happens:**
- Tokens are in URL hash fragment
- App.tsx useEffect captures and processes them
- `getSession()` stores tokens in local storage

### 4. Auth State Updates

```javascript
supabase.auth.onAuthStateChange((_event, session) => {
  // Session contains: user, access_token, refresh_token
  set({ user: session?.user ?? null })
})
```

**What Happens:**
- Auth state listener fires
- User object available throughout app
- Protected routes can verify authentication

## Common Issues & Solutions

### Issue 1: Redirects to Localhost in Production

**Symptoms:**
- Login works locally
- Production redirects to `localhost:3000`

**Root Cause:**
- Static `redirectTo` URL in code
- Not using `window.location.origin`

**Solution:**
```javascript
// ❌ Wrong: Hardcoded URL
redirectTo: 'http://localhost:3000/'

// ✅ Correct: Dynamic URL
redirectTo: `${window.location.origin}/`
```

### Issue 2: Tokens Lost After Redirect

**Symptoms:**
- Redirect works
- But user not logged in
- No session available

**Root Cause:**
- Tokens in hash fragment
- React Router processes URL before token extraction

**Solution:**
Add callback handler in App.tsx (see Step 3.3)

### Issue 3: CORS Errors

**Symptoms:**
- Network errors in console
- `Access-Control-Allow-Origin` errors

**Root Cause:**
- Domain not in Supabase allowed list
- Missing from Google OAuth origins

**Solution:**
1. Add domain to Supabase redirect URLs
2. Add domain to Google OAuth authorized origins

### Issue 4: Infinite Redirect Loop

**Symptoms:**
- Keeps redirecting between app and Supabase
- Never completes login

**Root Cause:**
- Site URL mismatch in Supabase
- Trailing slash inconsistency

**Solution:**
1. Set exact Site URL in Supabase (with/without slash)
2. Add both variations to redirect URLs
3. Clear browser cache and cookies

### Issue 5: Session Not Persisting

**Symptoms:**
- Login works
- Refresh page loses session

**Root Cause:**
- `persistSession` not enabled
- Local storage blocked

**Solution:**
```javascript
createClient(url, key, {
  auth: {
    persistSession: true,  // Enable
    autoRefreshToken: true
  }
})
```

## Security Best Practices

### 1. Token Storage

- ✅ **DO:** Let Supabase handle token storage (localStorage)
- ❌ **DON'T:** Store tokens in cookies without HttpOnly
- ❌ **DON'T:** Store tokens in global variables

### 2. Token Exposure

- ✅ **DO:** Clean tokens from URL after processing
- ✅ **DO:** Use HTTPS in production
- ❌ **DON'T:** Log tokens to console
- ❌ **DON'T:** Send tokens in URL params

### 3. Session Management

- ✅ **DO:** Implement auto-refresh (Supabase handles this)
- ✅ **DO:** Clear session on logout
- ✅ **DO:** Validate session on protected routes
- ❌ **DON'T:** Rely solely on client-side validation

### 4. Admin Permissions

- ✅ **DO:** Check permissions in database (RLS)
- ✅ **DO:** Verify admin status on every request
- ✅ **DO:** Use Row Level Security policies
- ❌ **DON'T:** Trust client-side permission checks alone

## Testing OAuth Flow

### Local Development

1. Start dev server:
   ```powershell
   npm run dev
   ```

2. Visit: `http://localhost:3000/login`

3. Click "Login with Google"

4. Verify redirect to `localhost:3000` (not production URL)

### Production Testing

1. Visit: `https://hajriadmin.netlify.app/login`

2. Click "Login with Google"

3. Verify redirect to `hajriadmin.netlify.app` (not localhost)

4. Check browser console for errors

5. Verify session in DevTools:
   ```javascript
   // Run in console
   const { data } = await supabase.auth.getSession()
   console.log(data.session)
   ```

## Monitoring & Debugging

### Browser DevTools

**Network Tab:**
- Monitor OAuth redirects
- Check for CORS errors
- Verify token exchange

**Console:**
- Check for auth errors
- Monitor state changes
- Debug callback processing

**Application Tab:**
- View localStorage (supabase.auth.token)
- Check cookies
- Monitor session data

### Supabase Dashboard

**Auth Logs:**
- View login attempts
- Check failed authentications
- Monitor user activity

**Query:** Auth logs
```
timestamp | event | user_email | status
```

## Advanced Configuration

### Custom OAuth Scopes

```javascript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'email profile',
    redirectTo: `${window.location.origin}/`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent'
    }
  }
})
```

### Multiple OAuth Providers

```javascript
// GitHub
await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${window.location.origin}/`
  }
})

// Microsoft
await supabase.auth.signInWithOAuth({
  provider: 'azure',
  options: {
    redirectTo: `${window.location.origin}/`,
    scopes: 'email openid profile'
  }
})
```

### Session Refresh

```javascript
// Manual refresh
const { data, error } = await supabase.auth.refreshSession()

// Auto-refresh (enabled by default)
createClient(url, key, {
  auth: {
    autoRefreshToken: true
  }
})
```

## References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Google OAuth Guide](https://developers.google.com/identity/protocols/oauth2)
- [OAuth 2.0 Specification](https://oauth.net/2/)

---

**Last Updated:** December 24, 2024  
**Status:** Production Ready ✅
