# 🚀 Deploy Hajri Admin Portal

## ✅ Prerequisites Done
- SQL script executed successfully
- RLS enabled on all tables
- Admin portal built and tested locally

---

## Option 1: Deploy to Netlify (Recommended - Easier)

### Step 1: Push to GitHub
```powershell
cd hajri-admin
git add .
git commit -m "Ready for deployment"
git push
```

### Step 2: Deploy on Netlify
1. Go to https://netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub → Select `hajri` repository
4. **Build settings:**
   - Base directory: `hajri-admin`
   - Build command: `npm run build`
   - Publish directory: `hajri-admin/dist`

5. **Environment variables:** (Click "Add environment variables")
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

6. Click "Deploy site"

### Step 3: Get Your URL
- Netlify will give you: `https://hajri-admin-xyz.netlify.app`
- You can change this in Site settings → Domain management

---

## Option 2: Deploy to Vercel (Alternative)

### Step 1: Push to GitHub (same as above)

### Step 2: Deploy on Vercel
1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import from GitHub → Select `hajri` repository
4. **Build settings:**
   - Framework Preset: `Vite`
   - Root Directory: `hajri-admin`
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. **Environment Variables:**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

6. Click "Deploy"

### Step 3: Get Your URL
- Vercel will give you: `https://hajri-admin.vercel.app`

---

## 🔐 Important: Update Supabase Redirect URLs

After deployment, add your domain to Supabase:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to **Site URL**: `https://your-domain.netlify.app` (or vercel)
3. Add to **Redirect URLs**:
   ```
   https://your-domain.netlify.app
   https://your-domain.netlify.app/app/*
   ```

---

## 🧪 Test After Deployment

1. Visit your deployed URL
2. Try to login (Google OAuth should work)
3. Check if Tree loads data from Supabase
4. Test creating a timetable
5. Publish a timetable

---

## 🐛 Troubleshooting

### Build fails: "Module not found"
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Commit and push

### "Redirect URI mismatch" error on login
- Check Supabase → Auth → URL Configuration
- Make sure your deployed URL is added

### Blank page after deployment
- Check browser console for errors
- Verify environment variables are set correctly
- Make sure `dist` folder has `index.html`

---

## 🎯 Quick Deploy Commands

```powershell
# 1. Make sure everything is committed
cd hajri-admin
git status

# 2. Test build locally
npm run build

# 3. If build succeeds, push to GitHub
git add .
git commit -m "Deploy admin portal"
git push

# 4. Then deploy via Netlify/Vercel UI (steps above)
```

---

## ✨ You're Almost Done!

Once deployed:
- ✅ Admin portal accessible from anywhere
- ✅ Multiple admins can manage timetables
- ✅ Mobile app can fetch data from Supabase
- ✅ Everything synced in real-time

**Next:** Start building your Android app! 📱
