# HAJRI Admin Panel - Complete Rebuild

## 🎉 What's Been Done

Your admin panel has been completely modernized with a professional UI library, fixed port configuration, and strict admin-only access control.

### ✅ Major Changes

#### 1. **Fixed Port Configuration**
- **Port locked to 3000** - No more random ports
- Added `strictPort: true` to ensure it fails if port 3000 is busy rather than picking another port
- Added `host: true` to expose on network (accessible via http://192.168.0.104:3000)
- **Dev Server**: http://localhost:3000

#### 2. **Modern UI with shadcn/ui + Tailwind**
Replaced the basic custom dark theme with a professional component library:
- **shadcn/ui** - Modern component library built on Radix UI primitives
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **Dark theme** with professional color system using CSS variables

#### 3. **Strict Admin-Only Access**
- **AdminGuard component** - Checks if user email exists in `admin_users` table
- Non-admin users see "Access Denied" screen - **NO READ ACCESS**
- Admin check happens on every protected route
- Loading spinner during authentication check

#### 4. **Professional Dashboard Layout**
- **Sidebar navigation** with icons:
  - 📊 Dashboard (Home)
  - 🏢 Departments
  - 📚 Subjects  
  - 📅 Timetable
  - 👥 Students
  - ⚙️ Settings
- **User profile section** in sidebar with avatar, email, and sign-out button
- Responsive design that works on all screen sizes

#### 5. **Modern Component Library**
Created reusable UI components using shadcn/ui patterns:
- **Button** - Multiple variants (default, destructive, outline, secondary, ghost, link)
- **Card** - Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **Table** - Professional table components with hover states
- **Input** - Styled form inputs with focus rings
- **Label** - Accessible form labels

#### 6. **Comprehensive Pages**

**Home (Dashboard)**
- 4 stat cards showing counts: Departments, Subjects, Students, Timetable Slots
- Quick actions section for common tasks
- System status display (OCR API, Database, Auth Service)

**Departments Page (Fully Functional)**
- Two-column layout: Add form (left) + Table (right)
- Add new departments with code + name validation
- Display all departments in a beautiful table
- Delete departments with confirmation
- Loading states, error handling
- Real-time updates after add/delete

**Other Pages (Scaffolded)**
- Subjects, Timetable, Students, Settings pages created as placeholders
- Each shows "Coming soon" message
- Ready for you to define requirements and build out features

**Login Page**
- Modernized with Tailwind and Card component
- Google OAuth sign-in button with Chrome icon
- Error messages in styled alert boxes
- Loading spinner during sign-in

---

## 🏗️ Architecture

### Tech Stack
```
Frontend:
├── React 18
├── Vite 5
├── React Router v6
├── Zustand (state management)
├── shadcn/ui (component library)
├── Tailwind CSS (styling)
├── Radix UI (primitives)
└── Lucide React (icons)

Backend:
└── Supabase (Auth + Postgres + Data API)
```

### Project Structure
```
hajri-admin/
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── table.jsx
│   │   │   ├── input.jsx
│   │   │   └── label.jsx
│   │   ├── AdminGuard.jsx    # Admin access control
│   │   └── DashboardLayout.jsx  # Sidebar layout
│   ├── pages/
│   │   ├── Home.jsx          # Dashboard overview
│   │   ├── Departments.jsx   # Full CRUD (DONE)
│   │   ├── Subjects.jsx      # Placeholder
│   │   ├── Timetable.jsx     # Placeholder
│   │   ├── Students.jsx      # Placeholder
│   │   ├── Settings.jsx      # Placeholder
│   │   └── Login.jsx         # Google OAuth
│   ├── lib/
│   │   ├── supabase.js       # Supabase client
│   │   ├── store.js          # Zustand store
│   │   └── utils.js          # cn() helper
│   ├── App.jsx               # Routes + AdminGuard
│   └── styles.css            # Tailwind + CSS variables
├── .env.local                # Config (already set up)
├── vite.config.js            # Fixed port 3000
├── tailwind.config.js        # Dark theme config
└── package.json              # Dependencies
```

---

## 🔒 Security Setup

### 1. Admin Access Control

**AdminGuard Component** checks user against `admin_users` table:
```javascript
// On component mount:
1. Check if user is authenticated
2. Query admin_users table for user's email
3. If admin: allow access
4. If not admin: show "Access Denied" screen
5. If not authenticated: redirect to /login
```

**Create the admin_users table in Supabase**:
```sql
-- Go to Supabase Dashboard → SQL Editor → New Query

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read admin_users (to check if they're admin)
CREATE POLICY "Anyone can check if they are admin"
  ON admin_users FOR SELECT
  USING (auth.email() = email);

-- Add your email as an admin
INSERT INTO admin_users (email) VALUES ('your-email@gmail.com');
```

### 2. Google OAuth URLs

You need to configure URLs in two places:

#### A. Google Cloud Console
Go to: https://console.cloud.google.com/apis/credentials

Find your OAuth 2.0 Client ID and add:

**Authorized JavaScript origins:**
```
http://localhost:3000
https://your-production-domain.com
```

**Authorized redirect URIs:**
```
https://etmlimraemfdpvrsgdpk.supabase.co/auth/v1/callback
```

#### B. Supabase Dashboard
Go to: Dashboard → Authentication → URL Configuration

**Site URL:**
```
http://localhost:3000  (for development)
https://your-production-domain.com  (for production)
```

**Redirect URLs:**
```
http://localhost:3000/**
https://your-production-domain.com/**
```

---

## 🎨 Design System

### Color Tokens
The dark theme uses CSS variables defined in `src/styles.css`:
```css
--background: 224 71% 4%      /* Dark blue background */
--foreground: 213 31% 91%     /* Light text */
--primary: 210 40% 98%        /* Primary actions */
--secondary: 222 47% 11%      /* Secondary elements */
--accent: 216 34% 17%         /* Accents/hover */
--destructive: 0 63% 31%      /* Delete/danger */
--border: 216 34% 17%         /* Borders */
--ring: 216 34% 17%           /* Focus rings */
```

### Component Variants

**Button:**
```jsx
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon</Button>
```

**Card:**
```jsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Footer actions */}
  </CardFooter>
</Card>
```

---

## 🚀 Running the App

### 1. Start Dev Server
```bash
cd hajri-admin
npm run dev
```

✅ Server runs on: **http://localhost:3000** (fixed port)

### 2. Sign In
1. Go to http://localhost:3000
2. Click "Sign in with Google"
3. Complete OAuth flow
4. **If you're not in admin_users table**: You'll see "Access Denied"
5. **If you're an admin**: You'll see the dashboard

### 3. Test Departments CRUD
- Add a department: Enter code (e.g., "CS") and name (e.g., "Computer Science")
- View departments: Table shows all departments with creation date
- Delete department: Click delete button (requires confirmation)

---

## 📦 What's Installed

### New Dependencies (17 total)
```json
{
  "dependencies": {
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.4",
    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-select": "^2.1.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

---

## 🎯 Next Steps

### For You:
1. **Add your email to admin_users table** (SQL above)
2. **Configure Google OAuth URLs** (instructions above)
3. **Test the login flow** - Sign in and verify AdminGuard works
4. **Tell me what features you need** for each section:

### What I Need From You:

**Departments** ✅ (Already built with add/delete)
- Any additional fields needed?

**Subjects:**
- What fields? (subject_code, name, department_id, credits, semester?)
- Relationship to departments?
- Any special constraints?

**Timetable:**
- Structure: (day, time_slot, subject, room, instructor?)
- Weekly repeating or one-time events?
- Conflict detection needed?

**Students:**
- Fields: (roll_no, name, email, department, semester, enrollment_year?)
- Enrollment in subjects?
- Attendance tracking integration?

**Settings:**
- What settings do you need?
- Manage admin users?
- OCR configuration?
- Bulk operations?

---

## 🐛 Troubleshooting

### "Access Denied" after signing in
- Check that your email is in the `admin_users` table
- Query: `SELECT * FROM admin_users WHERE email = 'your-email@gmail.com'`

### Port 3000 already in use
- Stop other apps using port 3000
- Or change port in `vite.config.js` (line 9: `port: 3000`)

### Blank page / Config error
- Check `.env.local` exists with correct values
- Restart dev server: Ctrl+C then `npm run dev`

### Google OAuth fails
- Verify Authorized JavaScript origins includes http://localhost:3000
- Verify Authorized redirect URI matches Supabase callback URL
- Check Supabase Site URL is set correctly

---

## 📝 Summary

### ✅ Completed
- Fixed port to 3000 (no more random ports)
- Installed shadcn/ui + Tailwind CSS
- Created professional component library
- Built sidebar layout with navigation
- Added AdminGuard for strict admin-only access
- Modernized Login page
- Built comprehensive Departments CRUD page
- Created placeholder pages for other sections

### 🔄 Pending
- Define requirements for Subjects, Timetable, Students, Settings
- Set up admin_users table and add your email
- Configure Google OAuth URLs
- Test login and admin access flow
- Build out remaining pages based on your requirements

### 🎨 What You Get
- **Professional UI** - Modern, cohesive design system
- **Fixed Port** - Always runs on port 3000
- **Secure** - Only admins can access (enforced at route level)
- **Scalable** - Easy to add new pages using existing components
- **Maintainable** - Clean code structure with reusable components

---

## 📞 Ready for Next Phase

The foundation is complete. Now I need you to:
1. Set up the admin_users table and OAuth URLs (5 minutes)
2. Test login and verify AdminGuard works
3. Tell me what features you need in each section

Then I'll build out the remaining pages with full CRUD functionality!
