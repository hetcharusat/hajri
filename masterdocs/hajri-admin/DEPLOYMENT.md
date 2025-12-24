# Deployment Guide

## Overview

Complete guide for deploying the Hajri Admin Portal to Netlify with Supabase backend integration.

## Prerequisites

- GitHub account and repository
- Netlify account
- Supabase project set up
- Node.js 18+ installed locally

## Deployment Architecture

```
┌─────────────────┐
│   GitHub Repo   │
│    (Source)     │
└────────┬────────┘
         │
         │ Auto Deploy
         ▼
┌─────────────────┐      ┌──────────────────┐
│   Netlify CDN   │◄────►│  Supabase API    │
│  (Static Host)  │      │  (PostgreSQL)    │
└────────┬────────┘      └──────────────────┘
         │
         │ HTTPS
         ▼
┌─────────────────┐
│   End Users     │
│   (Browsers)    │
└─────────────────┘
```

## Step 1: Prepare Your Repository

### 1.1 Ensure All Files Are Committed

```powershell
cd B:\hajri\hajri-admin
git add .
git commit -m "Prepare for deployment"
git push
```

### 1.2 Verify Project Structure

```
hajri-admin/
├── src/
│   ├── components/
│   ├── pages/
│   ├── lib/
│   └── main.jsx
├── public/
├── index.html
├── vite.config.js
├── package.json
└── netlify.toml    ✓ Required
```

### 1.3 Check netlify.toml Configuration

File: `hajri-admin/netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Step 2: Configure Supabase

### 2.1 Set Site URL in Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Authentication**
4. Update **Site URL:**
   ```
   https://hajriadmin.netlify.app
   ```

### 2.2 Add Redirect URLs

Add these URLs to **Redirect URLs:**

```
https://hajriadmin.netlify.app
https://hajriadmin.netlify.app/
https://hajriadmin.netlify.app/**
```

### 2.3 Verify RLS Policies

Ensure Row Level Security is properly configured:

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show rowsecurity = true for all tables
```

## Step 3: Deploy to Netlify

### 3.1 Connect GitHub Repository

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub**
4. Select repository: `hetcharusat/hajri`
5. Configure build settings:
   - **Base directory:** `hajri-admin`
   - **Build command:** `npm run build`
   - **Publish directory:** `hajri-admin/dist`

### 3.2 Set Environment Variables

In Netlify Dashboard → **Site settings** → **Environment variables:**

| Variable Name | Value | Example |
|--------------|-------|---------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://etmlimraemfdpvrsgdpk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

**Important:** These are public keys safe for client-side use.

### 3.3 Deploy

Click **"Deploy site"** and wait for build to complete (~2-3 minutes).

## Step 4: Configure OAuth

### 4.1 Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Edit your OAuth 2.0 Client

#### Authorized JavaScript Origins:
```
https://hajriadmin.netlify.app
https://etmlimraemfdpvrsgdpk.supabase.co
```

#### Authorized Redirect URIs:
```
https://etmlimraemfdpvrsgdpk.supabase.co/auth/v1/callback
https://hajriadmin.netlify.app
```

### 4.2 Test OAuth Flow

1. Visit: `https://hajriadmin.netlify.app`
2. Click **"Login with Google"**
3. Verify you're redirected back to Netlify URL (not localhost)
4. Check that you're logged in successfully

## Step 5: Verify Deployment

### 5.1 Health Checks

- [ ] Site loads without errors
- [ ] OAuth login works correctly
- [ ] Redirects to correct domain (not localhost)
- [ ] API calls to Supabase succeed
- [ ] Images and assets load correctly
- [ ] Routing works (no 404s on refresh)

### 5.2 Test Core Functionality

1. **Authentication:**
   - Login with Google
   - Check admin permissions
   - Verify user data in Supabase

2. **Data Loading:**
   - Navigate to Departments
   - Check Faculty page
   - View Offerings
   - Open Timetable editor

3. **CRUD Operations:**
   - Create a test record
   - Update it
   - Delete it

### 5.3 Performance Check

Open DevTools → Network tab:
- Check bundle sizes (main chunk < 300KB)
- Verify code splitting (multiple vendor chunks)
- Check API call frequency (should use cache)

## OAuth Redirect Fix Implementation

### Issue

After OAuth login, users were redirected to `localhost:3000` instead of the Netlify URL.

### Root Cause

1. **Static redirectTo:** Code used hardcoded localhost URL
2. **Hash Fragment Loss:** OAuth tokens in URL hash were lost during routing

### Solution

#### File 1: `hajri-admin/src/pages/Login.jsx`

```javascript
// Before: No redirectTo specified (defaults to localhost)
await supabase.auth.signInWithOAuth({
  provider: 'google'
})

// After: Dynamic redirectTo uses current domain
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/`
  }
})
```

#### File 2: `hajri-admin/src/App.tsx`

```javascript
// Added OAuth callback handler in useEffect
useEffect(() => {
  const handleOAuthCallback = async () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    if (hashParams.get('access_token')) {
      // Process the token
      await supabase.auth.getSession()
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }
  
  handleOAuthCallback()
}, [])
```

### Why This Works

1. **Dynamic Origin:** `window.location.origin` automatically uses:
   - `http://localhost:3000` in development
   - `https://hajriadmin.netlify.app` in production

2. **Token Processing:** Hash fragment is captured before React Router processes the URL

3. **Clean URLs:** After token extraction, hash is removed from URL

## Continuous Deployment

### Auto-Deploy Configuration

Netlify automatically deploys when:
- You push to `main` branch on GitHub
- A pull request is merged
- You trigger a manual deploy

### Deploy Previews

Netlify creates deploy previews for:
- Pull requests
- Branch pushes
- Rollback scenarios

Access previews at:
```
https://deploy-preview-{PR_NUMBER}--hajriadmin.netlify.app
```

## Custom Domain Setup (Optional)

### 1. Add Custom Domain

1. In Netlify: **Domain settings** → **Add custom domain**
2. Enter your domain: `admin.yourdomain.com`
3. Follow DNS configuration instructions

### 2. Update DNS Records

Add CNAME record:
```
Name: admin
Type: CNAME
Value: hajriadmin.netlify.app
```

### 3. Update Supabase & Google OAuth

Update all redirect URLs to use your custom domain:
- Supabase Site URL
- Google OAuth Authorized Origins
- Google OAuth Redirect URIs

### 4. Enable HTTPS

Netlify provides free SSL certificates via Let's Encrypt (automatic).

## Rollback Procedure

### If Deployment Fails

1. Go to Netlify Dashboard → **Deploys**
2. Find last successful deploy
3. Click **"..."** → **"Publish deploy"**
4. Site rolls back in ~30 seconds

### If Code Issues Found

```powershell
# Revert last commit
git revert HEAD
git push

# Or reset to previous commit
git reset --hard <previous-commit-hash>
git push --force
```

## Environment-Specific Configuration

### Development

```javascript
// .env.local
VITE_SUPABASE_URL=https://etmlimraemfdpvrsgdpk.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here
```

### Production (Netlify)

Set via Netlify Dashboard → Environment variables

### Testing Locally with Production Config

```powershell
# Load production env vars
$env:VITE_SUPABASE_URL="https://etmlimraemfdpvrsgdpk.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="your-key-here"

# Run dev server
npm run dev
```

## Monitoring & Logs

### Netlify Logs

Access logs in Dashboard:
- **Deploy logs:** Build output and errors
- **Function logs:** Serverless function logs (if any)

### Supabase Logs

Access in Supabase Dashboard:
- **Query logs:** SQL queries and performance
- **Auth logs:** Login attempts and errors
- **API logs:** REST API requests

### Browser Console

Monitor client-side errors:
- Network failures
- JavaScript errors
- React warnings

## Security Checklist

- [x] Supabase RLS policies enabled
- [x] OAuth configured with correct domains
- [x] Environment variables set in Netlify
- [x] HTTPS enabled (automatic via Netlify)
- [x] CORS configured in Supabase
- [ ] Rate limiting configured (if needed)
- [ ] API keys rotated regularly
- [ ] Admin permissions properly restricted

## Performance Optimization

### Build Optimization

Current configuration in `vite.config.js`:
- Code splitting enabled
- Vendor chunks separated
- Source maps disabled in production

### CDN & Caching

Netlify CDN automatically:
- Caches static assets
- Compresses responses (gzip/brotli)
- Serves from edge locations

### Monitoring Performance

Use Lighthouse in Chrome DevTools:
```
Performance Score Target: >90
First Contentful Paint: <1.5s
Time to Interactive: <3.0s
```

## Troubleshooting

### Build Fails

**Error:** `Module not found`

**Solution:**
```powershell
# Clear cache and reinstall
rm -r node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

### OAuth Redirect Loop

**Error:** Keeps redirecting between Supabase and app

**Solution:**
1. Check Site URL in Supabase matches Netlify URL exactly
2. Verify redirect URLs include trailing slash variations
3. Clear browser cache and cookies

### API Calls Failing

**Error:** 401 Unauthorized or CORS errors

**Solution:**
1. Verify environment variables in Netlify
2. Check RLS policies in Supabase
3. Confirm user has proper permissions in `users` table

### Assets Not Loading

**Error:** 404 on CSS/JS files

**Solution:**
1. Check `netlify.toml` publish directory: `dist`
2. Verify build command ran successfully
3. Check deploy log for missing files

## Cost Estimation

### Netlify (Free Tier)

- 100 GB bandwidth/month
- 300 build minutes/month
- Unlimited sites
- HTTPS included

**Estimated:** $0/month for typical usage

### Supabase (Free Tier)

- 500 MB database
- 1 GB file storage
- 2 GB bandwidth
- 50,000 monthly active users

**Estimated:** $0/month for early stage

### Total Monthly Cost

**Free tier:** $0/month  
**Paid tier:** ~$25-50/month (if needed)

## Support & Resources

- **Netlify Status:** https://www.netlifystatus.com/
- **Netlify Docs:** https://docs.netlify.com/
- **Supabase Status:** https://status.supabase.com/
- **Supabase Docs:** https://supabase.com/docs
- **Project Repo:** https://github.com/hetcharusat/hajri

---

**Last Updated:** December 24, 2024  
**Deployment Status:** ✅ Live at https://hajriadmin.netlify.app
