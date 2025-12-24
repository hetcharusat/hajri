# Quick Start Guide - New Account Handoff

**For:** Continuing development with a fresh AI chat session  
**Context:** Hajri project (admin portal + OCR backend)  
**Last Session:** December 25, 2025

---

## 🎯 First Actions (Copy-Paste to New Chat)

### 1. Load Context
```
I'm taking over development of the Hajri project. Please read:
- b:/hajri/masterdocs/CHAT_CONTEXT.md (full conversation history)
- b:/hajri/masterdocs/hajri-admin/AI_CONTEXT.md (avoid wrong-file edits)
- b:/hajri/masterdocs/hajri-admin/FILE_MAPPING.md (route/component map)
- b:/hajri/masterdocs/hajri-admin/ROADMAP.md (immediate todos)

Current priorities:
1. Confirm schema deployed (CLEAN-SCHEMA.sql → Supabase)
2. Confirm migrations applied (class/batch name columns)

First action: Help me verify schema + migrations, then smoke test the UI.
```

---

## 🔥 Critical Files to Know

### Schema (Database)
- **`b:/hajri/hajri-admin/CLEAN-SCHEMA.sql`**  
  Authoritative database schema (V3 hierarchy + offerings + versioned timetables)  
  Status: Must be deployed to Supabase for a fresh environment

- **`b:/hajri/hajri-admin/migrations/add_name_columns_to_classes_and_batches.sql`**
  Adds `classes.name` and `batches.name` used by auto-naming (`3CE1`, `3CE1-A`)

### Frontend (React)
- **`b:/hajri/hajri-admin/src/pages/TimetableNew.jsx`**  
  Timetable editor (paint-to-grid workflow)
  
- **`b:/hajri/hajri-admin/src/pages/OfferingsNew.jsx`**  
  Assignments (course offerings) page

- **`b:/hajri/hajri-admin/src/App.tsx`**  
  Main routes + AdminGuard wrapper

- **`b:/hajri/hajri-admin/.env.local`**  
  Supabase credentials (not in repo)  
  Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### OCR Backend (Python)
- **`b:/hajri/hajri-ocr/main.py`**  
  FastAPI app for attendance OCR  
  Status: Stable, separate from admin portal

---

## 📋 Immediate TODOs (Priority Order)

### P0 - Blockers (Do First)
1. **Deploy Schema**  
   - Open Supabase SQL Editor
   - Run: `b:/hajri/hajri-admin/CLEAN-SCHEMA.sql`
  - Verify all core tables created

2. **Apply Migration (if needed)**
  - Run: `b:/hajri/hajri-admin/migrations/add_name_columns_to_classes_and_batches.sql`
  - Verify `classes.name` and `batches.name` exist

### P1 - Testing (Do Second)
3. **Smoke Test Workflow**  
   - Login as admin
  - Create assignment/offering (Assignments page)
   - Build timetable (Timetable page)
   - Publish draft
   - Verify published view

### P2 - Polish (Do Third)
4. **UX Consistency**  
   - Convert legacy pages to shadcn-style:
     - Students.jsx
     - Semesters.jsx
     - Faculty.jsx
     - Rooms.jsx
  - Reference: newer `/app/*` pages (Subjects/Faculty/Rooms/Assignments/Timetable)

5. **Missing Features**  
   - Room override in timetable
   - Copy/paste timetable blocks
   - Conflict detection (faculty/room double-booking)

---

## 🗺️ Project Structure Quick Map

```
b:/hajri/
├── masterdocs/              # 📚 All documentation (you are here)
│   ├── README.md           # Overview
│   ├── CHAT_CONTEXT.md     # Full chat history & context
│   ├── hajri-admin/        # Admin portal docs
│   │   ├── ARCHITECTURE.md
│   │   ├── SCHEMA_V2.md
│   │   ├── AI_CONTEXT.md
│   │   ├── FILE_MAPPING.md
│   │   ├── WORKFLOWS.md
│   │   └── ROADMAP.md
│   └── hajri-ocr/          # OCR backend docs
│       ├── OVERVIEW.md
│       └── ARCHITECTURE.md
│
├── hajri-admin/            # 🎨 React Admin Portal
│   ├── src/
│   │   ├── pages/
│   │   │   ├── TimetableNew.jsx    ✅ Timetable editor
│   │   │   ├── OfferingsNew.jsx    ✅ Assignments
│   │   │   ├── Subjects.jsx        ✅ Subjects
│   │   │   ├── FacultyImproved.jsx ✅ Faculty (inline modal)
│   │   │   ├── Students.jsx    ⚠️ Legacy Tailwind
│   │   │   ├── Semesters.jsx   ⚠️ Legacy Tailwind
│   │   │   ├── Faculty.jsx     ⚠️ Legacy Tailwind
│   │   │   └── Rooms.jsx       ⚠️ Legacy Tailwind
│   │   ├── components/
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── AdminGuard.jsx
│   │   │   ├── AppShell.jsx
│   │   │   └── ui/         # shadcn components
│   │   └── lib/
│   │       ├── supabase.js
│   │       └── store.js
│   ├── CLEAN-SCHEMA.sql    ⚠️ Needs deployment
│   ├── migrations/         # DB migrations (run as needed)
│   ├── .env.local          🔐 Secrets (not in repo)
│   └── package.json
│
└── hajri-ocr/              # 🔍 Python OCR Backend
    ├── main.py             ✅ Stable
    ├── table_extractor.py
    └── requirements.txt
```

---

## 💡 Key Concepts to Remember

### Offerings Model
> **Offering = Subject + Batch + Faculty + Default Room**

Why? Same subject taught by different faculty to different batches.

Example:
```
Data Structures → CS-A → Dr. Smith → Lab 101
Data Structures → CS-B → Dr. Johnson → Lab 102
```

### Timetable Versioning
> **Per-Batch: One Draft (editing) + One Published (live) + Many Archived (history)**

Workflow:
1. Admin edits Draft timetable
2. Admin clicks Publish
3. Old Published → Archived
4. Current Draft → Published
5. New empty Draft created

### Paint Workflow (Timetable Editor)
1. Click offering from palette (left)
2. Drag-select cells in grid (right)
3. Click "Apply" → Upserts events
4. Click "Clear" → Deletes events

---

## 🚨 Known Issues

### Schema / Migration Drift
- `CLEAN-SCHEMA.sql` is V3; ensure it is deployed.
- Auto-naming uses `classes.name` and `batches.name` (apply migration if missing).

### UX Inconsistency
- Some pages use shadcn-style (Departments, Offerings)
- Others use raw Tailwind (Students, Semesters, Faculty, Rooms)
- Need consistency pass

---

## 🔑 Credentials & Environment

### Supabase (hajri-admin)
```dotenv
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```
Location: `b:/hajri/hajri-admin/.env.local`

### PaddleOCR API (hajri-ocr)
```dotenv
PADDLEOCR_VL_API_URL=https://...
PADDLEOCR_VL_API_TOKEN=...
```
Location: `b:/hajri/hajri-ocr/.env`

---

## 🎓 Learning Path for New AI

### If Starting Fresh:
1. Read `masterdocs/CHAT_CONTEXT.md` (20 min read)
2. Skim `masterdocs/hajri-admin/ARCHITECTURE.md` (understand stack)
3. Read `masterdocs/hajri-admin/SCHEMA_V2.md` (current schema reference; includes V3)
4. Review `masterdocs/hajri-admin/ROADMAP.md` (know what's next)

### If Diving Into Code:
1. Read `hajri-admin/src/App.tsx` (routing)
2. Read `hajri-admin/src/components/AppShell.jsx` (tree sidebar + scope)
3. Read `hajri-admin/src/pages/OfferingsNew.jsx` (assignments / offerings)
4. Read `hajri-admin/src/pages/TimetableNew.jsx` (timetable editor)

### If Fixing Bugs:
1. Identify file from error message
2. Check ROADMAP.md (is it a known issue?)
3. Read relevant ARCHITECTURE.md section
4. Apply fix, test locally

---

## 📞 Quick Commands

### Dev Server
```powershell
cd b:\hajri\hajri-admin
npm install
npm run dev
```

### Schema Deployment
```sql
-- Copy contents of b:/hajri/hajri-admin/CLEAN-SCHEMA.sql
-- Paste into Supabase SQL Editor
-- Run (drops + recreates all tables)
```

### Check Errors
```powershell
cd b:\hajri\hajri-admin
npm run build  # See build errors
```

### OCR Backend (Separate)
```bash
cd b:/hajri/hajri-ocr
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 🎯 Success Criteria

### Session Goal: Get to Working State
- [ ] Dev server runs (`npm run dev`)
- [ ] Schema deployed (`CLEAN-SCHEMA.sql`)
- [ ] Migration applied if needed (`add_name_columns_to_classes_and_batches.sql`)
- [ ] Can login as admin and create an Assignment then publish a Timetable
- [ ] Can create offering
- [ ] Can build timetable
- [ ] Can publish timetable

### Next Session Goal: Polish
- [ ] UX consistency (convert legacy pages)
- [ ] Room override feature
- [ ] Copy/paste timetable
- [ ] Add loading states

---

## 💬 Helpful Phrases for New Chat

**To load context:**
> "Please read the masterdocs/ directory, especially CHAT_CONTEXT.md and hajri-admin/ROADMAP.md. I need to continue where the last session left off."

**To fix blocker:**
> "Dev server is failing. Run `npm run dev` in hajri-admin and capture the error, then fix it."

**To deploy schema:**
> "Help me deploy CLEAN-SCHEMA.sql to Supabase. Walk me through opening SQL Editor and running it."

**To test workflow:**
> "Guide me through the smoke test: login → create offering → build timetable → publish."

**To continue work:**
> "What's the next P1 task from ROADMAP.md? Let's work on that."

---

## 🚀 Good Luck!

You have all context needed to continue seamlessly. The masterdocs/ directory contains:
- Full chat history (CHAT_CONTEXT.md)
- Complete architecture (hajri-admin/ARCHITECTURE.md)
- Schema reference (hajri-admin/SCHEMA_V2.md)
- User workflows (hajri-admin/WORKFLOWS.md)
- Development roadmap (hajri-admin/ROADMAP.md)
- OCR project docs (hajri-ocr/)

**Start with ROADMAP.md P0 blockers and work your way down.**

---

*Generated: December 22, 2025*  
*Last Session: Schema V2 implementation + Timetable V2 rebuild*  
*Next Action: Fix dev server + deploy schema*

## VitePress Links

### Quick Links

- [Getting Started](/getting-started/)
- [Quick Start](/QUICK_START)
- [Chat Context](/CHAT_CONTEXT)
- [Admin Portal Overview](/hajri-admin/)
- [OCR Overview](/hajri-ocr/)
