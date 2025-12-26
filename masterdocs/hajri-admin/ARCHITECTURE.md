# Hajri Admin Portal - Technical Architecture

**Project:** Hajri Admin Portal  
**Purpose:** Full-featured academic timetable management system  
**Stack:** React + Vite + Supabase + Tailwind  
**Status:** V3 Hierarchy + Offerings/Timetable (December 2025)

---

## At a Glance

**What it is**
- React SPA for managing academic data + building timetables.

**What to read first**
- New devs: /getting-started/
- Data model: /hajri-admin/SCHEMA_V2
- How admins actually use it: /hajri-admin/WORKFLOWS

**Core concepts (current)**
- **Hierarchy scope** via Tree Explorer: department → branch → semester → class → batch.
- **Course offering** = subject + batch + faculty (+ default room).
- **Timetable versioning** per batch: draft + published + archived.- **Smart Scheduling:** Automatic 2-hour slot merging for LAB components and real-time conflict detection.
**Key source files**
- `hajri-admin/CLEAN-SCHEMA.sql`
- `hajri-admin/src/App.tsx`
- `hajri-admin/src/components/AppShell.jsx`
- `hajri-admin/src/pages/OfferingsNew.jsx`
- `hajri-admin/src/pages/TimetableNew.jsx`
- `hajri-admin/src/pages/FacultyImproved.jsx`
- `hajri-admin/src/pages/AcademicCalendar.jsx` ← Global scope calendar
- `hajri-admin/src/lib/calendarUtils.js` ← Attendance engine helpers
- `hajri-admin/src/components/AdminGuard.jsx`

**Common pitfalls**
- Navigation tabs are scope-gated (select the right node in the Tree Explorer).
- Timetable editing won’t work until offerings exist (events reference offerings).
- “Access denied” usually means `users.is_admin=false`.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  React SPA (Vite) + React Router + Tailwind + shadcn/ui        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ HTTP/REST + Realtime
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Supabase Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Auth       │  │  Postgres    │  │   Storage    │         │
│  │  (Google)    │  │   + RLS      │  │   (Future)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
hajri-admin/
├── public/                     # Static assets
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── input.jsx
│   │   │   ├── label.jsx
│   │   │   └── table.jsx
│   │   ├── AdminGuard.jsx      # Auth + admin check wrapper
│   │   ├── AppShell.jsx         # /app layout + Tree Explorer + scope gating
│   │   └── DashboardLayout.jsx  # Legacy layout (older pages)
│   ├── lib/
│   │   ├── supabase.js         # Supabase client instance
│   │   ├── store.js            # Zustand state (auth + departments)
│   │   └── utils.js            # cn() helper for Tailwind
│   ├── pages/
│   │   ├── Login.jsx           # Google OAuth flow
│   │   ├── Dashboard.jsx       # Home/landing page
│   │   ├── Departments.jsx     # CRUD (shadcn-style)
│   │   ├── Subjects.jsx        # CRUD
│   │   ├── Faculty.jsx         # CRUD (legacy Tailwind)
│   │   ├── Rooms.jsx           # CRUD (legacy Tailwind)
│   │   ├── Semesters.jsx       # CRUD (legacy Tailwind)
│   │   ├── Batches.jsx         # CRUD
│   │   ├── Students.jsx        # CRUD (legacy Tailwind)
│   │   ├── OfferingsNew.jsx    # /app/assignments
│   │   ├── TimetableNew.jsx    # /app/timetable (DND editor)
│   │   └── Settings.jsx        # User management
│   ├── App.tsx                 # Routes + AdminGuard + /app/*
│   └── main.jsx                # React entry point
├── CLEAN-SCHEMA.sql            # Complete DB schema (V2)
├── .env.local                  # Supabase credentials (not in repo)
├── vite.config.js              # Vite + alias config
├── tailwind.config.js          # Tailwind + CSS variables
├── package.json                # Dependencies
└── README.md                   # Project readme
```

---

## 🔧 Technology Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool + dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library (partial adoption)
- **lucide-react** - Icon library
- **Zustand** - State management (minimal)

### Backend (Supabase)
- **Postgres** - Database
- **Row Level Security (RLS)** - Access control
- **Auth** - Google OAuth
- **Realtime** - (Future: live timetable updates)
- **Edge Functions** - (Not used yet)

### Build & Dev Tools
- **Vite** - Fast dev server, HMR
- **ESLint** - Linting
- **PostCSS** - CSS processing

---

## 🔐 Authentication & Authorization

### Flow
```
User → Google OAuth → Supabase Auth → auth.users table
                                    ↓
                          Trigger: handle_new_user()
                                    ↓
                          Insert into public.users (is_admin=false)
                                    ↓
                          AdminGuard checks is_admin
                                    ↓
                          Grant/Deny access to admin portal
```

### Implementation Details

**Login (`src/pages/Login.jsx`):**
```javascript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/` }
})
```

**AdminGuard (`src/components/AdminGuard.jsx`):**
- Checks `users.is_admin` by `auth.uid()`
- Auto-inserts user row if missing (belt-and-suspenders with trigger)
- Redirects non-admins to `/login`
- Shows loading state during check

**Auth Store (`src/lib/store.js`):**
```javascript
export const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null })
}))
```

**RLS Policies (Database):**
- Admins: Full CRUD on all tables
- Students: Read-only on subjects + published timetables
- Users can view/insert own row, admins update others (not self)

---

## 🗄️ Data Layer

### Supabase Client (`src/lib/supabase.js`)
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Query Patterns

**Basic CRUD:**
```javascript
// SELECT
const { data, error } = await supabase
  .from('departments')
  .select('*')
  .order('code', { ascending: true })

// INSERT
const { error } = await supabase
  .from('departments')
  .insert([{ code: 'CS', name: 'Computer Science' }])

// UPDATE
const { error } = await supabase
  .from('departments')
  .update({ name: 'New Name' })
  .eq('id', departmentId)

// DELETE
const { error } = await supabase
  .from('departments')
  .delete()
  .eq('id', departmentId)
```

**Joins:**
```javascript
const { data, error } = await supabase
  .from('course_offerings')
  .select(`
    *,
    subjects(code, name, type),
    faculty(name),
    rooms:default_room_id(room_number, building)
  `)
  .eq('batch_id', batchId)
```

**RPC Calls:**
```javascript
const { data, error } = await supabase.rpc('get_all_users')
```

---

## 🎨 UI Component System

### shadcn/ui Philosophy
- Copy-paste components (not npm package)
- Built on Radix UI primitives
- Tailwind + CSS variables for theming
- Full control over component code

### Component Variants (Button Example)
```javascript
<Button variant="default">Primary</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
```

### Utility Helper (`src/lib/utils.js`)
```javascript
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

Usage:
```javascript
className={cn(
  'base-classes',
  isActive && 'active-classes',
  isDisabled && 'disabled-classes'
)}
```

---

## 🧩 Key Features Implementation

### 1. Course Offerings Management

**Page:** `src/pages/OfferingsNew.jsx` (route: `/app/assignments`)

**Workflow:**
1. Select batch (filtered by department)
2. View existing offerings for batch
3. Create new: Select subject + faculty + default room
4. Delete offering
5. Search/filter by subject or faculty name

**Key Logic:**
```javascript
// Unique constraint ensures one offering per subject+batch combo
const { error } = await supabase
  .from('course_offerings')
  .insert([{
    subject_id: selectedSubject,
    batch_id: selectedBatch,
    faculty_id: selectedFaculty,
    default_room_id: selectedRoom
  }])
```

### 2. Timetable V2 Editor

**Page:** `src/pages/TimetableNew.jsx` (route: `/app/timetable`)

**Architecture:**
- **Paint Workflow:** Click offering → drag-select cells → apply
- **Versioning:** Draft/Published per batch
- **Data Model:** Events reference offerings (not raw subjects)

**Key Functions:**

**Auto-create draft version:**
```javascript
async function getOrCreateDraftVersion(batchId) {
  const existing = await supabase
    .from('timetable_versions')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'draft')
    .maybeSingle()
  
  if (existing.data?.id) return existing.data.id
  
  const created = await supabase
    .from('timetable_versions')
    .insert([{ batch_id: batchId, status: 'draft' }])
    .select('id')
    .single()
  
  return created.data.id
}
```

**Upsert events (paint):**
```javascript
async function applyOfferingToSelection() {
  const rows = selectedCells.map(cellKey => {
    const [dayIdx, startTime] = cellKey.split('|')
    return {
      version_id: activeVersionId,
      offering_id: activeOfferingId,
      day_of_week: parseInt(dayIdx),
      start_time: startTime,
      end_time: correspondingEndTime,
      room_id: null
    }
  })
  
  // Unique constraint (version_id, day_of_week, start_time) enables upsert
  const { error } = await supabase
    .from('timetable_events')
    .upsert(rows, { onConflict: 'version_id,day_of_week,start_time' })
}
```

**Publish workflow:**
```javascript
async function publishDraft() {
  // 1. Archive existing published
  await supabase
    .from('timetable_versions')
    .update({ status: 'archived' })
    .eq('batch_id', batchId)
    .eq('status', 'published')
  
  // 2. Publish current draft
  await supabase
    .from('timetable_versions')
    .update({ status: 'published', published_at: new Date() })
    .eq('id', draftVersionId)
  
  // 3. Create new empty draft
  const newDraft = await supabase
    .from('timetable_versions')
    .insert([{ batch_id: batchId, status: 'draft' }])
    .select('id')
    .single()
  
  setDraftVersionId(newDraft.data.id)
}
```

**Selection Management:**
```javascript
// Mouse drag selection
const selectionRef = useRef({ active: false, start: null, end: null })

function beginSelection(row, col) {
  selectionRef.current = { active: true, start: {row, col}, end: {row, col} }
}

function updateSelection(row, col) {
  if (!selectionRef.current.active) return
  selectionRef.current.end = {row, col}
  // Clamp to rectangle
  setSelection(clampSelection(selectionRef.current.start, selectionRef.current.end))
}

function endSelection() {
  selectionRef.current.active = false
}
```

### 3. Settings Page (User Management)

**Page:** `src/pages/Settings.jsx`

**RPC Function:**
```sql
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (id UUID, email TEXT, is_admin BOOLEAN, ...)
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can view all users';
  END IF;
  
  RETURN QUERY SELECT * FROM users ORDER BY created_at DESC;
END;
$$;
```

**Frontend:**
```javascript
const { data, error } = await supabase.rpc('get_all_users')

// Toggle admin (prevents self-toggle)
const canToggle = user.id !== currentUserId
```

---

## 🛣️ Routing Architecture

**File:** `src/App.tsx`

The app uses an `AdminGuard` wrapper, then a nested `/app/*` layout via `AppShell`.

```tsx
<Routes>
  <Route path="/login" element={<Login />} />

  <Route element={<AdminGuard><Outlet /></AdminGuard>}>
    <Route index element={<Navigate to="/app/overview" replace />} />

    <Route path="/app" element={<AppShell />}>
      <Route index element={<Navigate to="/app/overview" replace />} />
      <Route path="overview" element={<Overview />} />
      <Route path="subjects" element={<Subjects />} />
      <Route path="faculty" element={<FacultyImproved />} />
      <Route path="rooms" element={<Rooms />} />
      <Route path="period-templates" element={<PeriodTemplates />} />
      <Route path="assignments" element={<OfferingsNew embedded={true} />} />
      <Route path="timetable" element={<TimetableNew />} />
    </Route>

    {/* Back-compat */}
    <Route path="/period-templates" element={<Navigate to="/app/period-templates" replace />} />

    <Route path="/settings" element={<Settings />} />
  </Route>

  <Route path="*" element={<Navigate to="/app/overview" replace />} />
</Routes>
```

---

## 🎯 Design Patterns & Best Practices

### 1. Consistent Error Handling
```javascript
try {
  const { data, error } = await supabase.from('table').select('*')
  if (error) throw error
  setData(data)
} catch (e) {
  setError(e.message)
} finally {
  setLoading(false)
}
```

### 2. Loading States
```javascript
const [loading, setLoading] = useState(true)
const [busy, setBusy] = useState(false) // For mutations

if (loading) return <div>Loading...</div>
```

### 3. Optimistic UI Updates
```javascript
// Update local state immediately
setData(prev => [...prev, newItem])

// Then sync with DB
const { error } = await supabase.from('table').insert([newItem])

// Revert on error
if (error) {
  setData(prev => prev.filter(item => item.id !== newItem.id))
  setError(error.message)
}
```

### 4. Cleanup on Unmount
```javascript
useEffect(() => {
  const subscription = supabase
    .channel('changes')
    .on('postgres_changes', { ... }, handler)
    .subscribe()
  
  return () => subscription.unsubscribe()
}, [])
```

---

## 🔒 Security Architecture

### Defense Layers
1. **Supabase Auth** - JWT tokens, Google OAuth
2. **RLS Policies** - Database-level access control
3. **AdminGuard** - UI-level route protection
4. **RPC Security Definer** - Privileged operations with checks

### RLS Policy Examples

**Admin full access:**
```sql
CREATE POLICY "Admins full access" ON course_offerings FOR ALL TO authenticated
  USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
```

**Students read published:**
```sql
CREATE POLICY "Students read published" ON timetable_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timetable_versions v
      WHERE v.id = timetable_events.version_id AND v.status = 'published'
    )
  );
```

**Prevent self-admin toggle:**
```sql
CREATE POLICY "Admins update others" ON users FOR UPDATE TO authenticated
  USING (
    auth.uid() != users.id
    AND (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );
```

---

## 📊 Performance Considerations

### Database
- **Indexes:** Foreign keys, day_of_week, batch_id, version_id
- **Triggers:** `updated_at` auto-update (efficient)
- **RLS:** Inline subqueries (Postgres optimizes well)

### Frontend
- **Code Splitting:** React Router lazy loading (future)
- **Memoization:** `useMemo` for filtered lists
- **Debouncing:** Search inputs (future)
- **Pagination:** Large tables (future)

### Current Bottlenecks (Known)
- No pagination on Settings/Students pages
- No lazy loading of routes
- Full table scans on search (small datasets OK for now)

---

## 🐛 Debugging & Development

### Supabase Client Logging
```javascript
// In development, log all queries
if (import.meta.env.DEV) {
  console.log('Query:', { from, select, filters })
}
```

### React DevTools
- Inspect component tree
- Profile renders
- Track state changes

### Vite HMR
- Fast refresh on save
- Preserves component state

### Browser Console
```javascript
// Check auth state
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)

// Check RLS
const { data, error } = await supabase.from('users').select('*')
console.log('RLS check:', { data, error })
```

---

## 🚀 Build & Deployment

### Development
```powershell
cd hajri-admin
npm install
npm run dev  # Starts Vite dev server on port 5173
```

### Production Build
```powershell
npm run build  # Output to dist/
npm run preview  # Test production build locally
```

### Environment Variables
```dotenv
# .env.local (not in repo)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Deployment Targets (Future)
- **Vercel** - Recommended (auto-detects Vite)
- **Netlify** - Also supports Vite
- **Supabase Storage** - Static hosting
- **Custom VPS** - Nginx + Node serve

---

## 📦 Dependencies

### Core
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.x",
  "@supabase/supabase-js": "^2.x"
}
```

### UI & Styling
```json
{
  "tailwindcss": "^3.x",
  "lucide-react": "^0.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x"
}
```

### State & Utils
```json
{
  "zustand": "^4.x"
}
```

### Build Tools
```json
{
  "vite": "^5.x",
  "@vitejs/plugin-react": "^4.x"
}
```

---

## 🔄 Future Architecture Considerations

### Scalability
- **Realtime:** Subscribe to timetable changes for collaborative editing
- **Caching:** React Query for server state management
- **Offline:** Service workers + local Supabase cache

### Features
- **Multi-tenant:** Support multiple institutions (org_id column)
- **Audit Logs:** Track all admin changes
- **Notifications:** Email alerts on timetable publish
- **API:** Public API for mobile app consumption

### DevOps
- **CI/CD:** GitHub Actions for automated tests/deploy
- **E2E Tests:** Playwright or Cypress
- **Monitoring:** Sentry for error tracking
- **Analytics:** Posthog or Plausible

---

**Related Docs:**
- [Schema V2 Details](/hajri-admin/SCHEMA_V2)
- [Workflows & User Journeys](/hajri-admin/WORKFLOWS)
- [Remaining Roadmap](/hajri-admin/ROADMAP)
