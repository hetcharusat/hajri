# Quick Start Guide - New Account Handoff

**For:** Continuing development with a fresh AI chat session  
**Context:** Hajri project (admin portal + OCR backend)  
**Last Session:** December 22, 2025

---

## 🎯 First Actions (Copy-Paste to New Chat)

### 1. Load Context
```
I'm taking over development of the Hajri project. Please read:
- b:/hajri/masterdocs/CHAT_CONTEXT.md (full conversation history)
- b:/hajri/masterdocs/hajri-admin/ROADMAP.md (immediate todos)

Current blockers:
1. Dev server failing (npm run dev exits code 1)
2. Schema needs deployment (CLEAN-SCHEMA.sql → Supabase)

First action: Help me fix the dev server error.
```

---

## 🔥 Critical Files to Know

### Schema (Database)
- **`b:/hajri/hajri-admin/CLEAN-SCHEMA.sql`**  
  Authoritative database schema (V2 with offerings + versioned timetables)  
  Status: Updated, needs deployment to Supabase

### Frontend (React)
- **`b:/hajri/hajri-admin/src/pages/Timetable.jsx`**  
  V2 timetable editor (paint-to-grid workflow)  
  Status: Rebuilt cleanly, should compile
  
- **`b:/hajri/hajri-admin/src/pages/Offerings.jsx`**  
  Course offerings CRUD page  
  Status: Complete, working

- **`b:/hajri/hajri-admin/src/App.jsx`**  
  Main routes + AdminGuard wrapper  
  Status: Updated with offerings route

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
1. **Fix Dev Server**  
   - Run: `cd b:\hajri\hajri-admin; npm run dev`
   - Capture full error output
   - Fix import/build issues
   - Target: Dev server starts successfully

2. **Deploy Schema**  
   - Open Supabase SQL Editor
   - Run: `b:/hajri/hajri-admin/CLEAN-SCHEMA.sql`
   - Verify all V2 tables created
   - Verify seed data inserted

### P1 - Testing (Do Second)
3. **Smoke Test Workflow**  
   - Login as admin
   - Create offering (Offerings page)
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
   - Reference: Departments.jsx, Offerings.jsx

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
│   │   ├── WORKFLOWS.md
│   │   └── ROADMAP.md
│   └── hajri-ocr/          # OCR backend docs
│       ├── OVERVIEW.md
│       └── ARCHITECTURE.md
│
├── hajri-admin/            # 🎨 React Admin Portal
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Timetable.jsx   ✅ V2 (rebuilt)
│   │   │   ├── Offerings.jsx   ✅ New
│   │   │   ├── Departments.jsx ✅ shadcn-style
│   │   │   ├── Students.jsx    ⚠️ Legacy Tailwind
│   │   │   ├── Semesters.jsx   ⚠️ Legacy Tailwind
│   │   │   ├── Faculty.jsx     ⚠️ Legacy Tailwind
│   │   │   └── Rooms.jsx       ⚠️ Legacy Tailwind
│   │   ├── components/
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── AdminGuard.jsx
│   │   │   └── ui/         # shadcn components
│   │   └── lib/
│   │       ├── supabase.js
│   │       └── store.js
│   ├── CLEAN-SCHEMA.sql    ⚠️ Needs deployment
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

### Build Error
- `npm run dev` failing (code 1)
- Error output not captured yet
- Likely import/module issue

### Schema Mismatch
- CLEAN-SCHEMA.sql updated locally
- Not yet run in Supabase
- Frontend expects V2 tables

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
3. Read `masterdocs/hajri-admin/SCHEMA_V2.md` (understand data model)
4. Review `masterdocs/hajri-admin/ROADMAP.md` (know what's next)

### If Diving Into Code:
1. Read `hajri-admin/src/pages/Departments.jsx` (simple CRUD example)
2. Read `hajri-admin/src/pages/Offerings.jsx` (V2 CRUD with joins)
3. Read `hajri-admin/src/pages/Timetable.jsx` (complex V2 editor)
4. Trace a user action: Click Apply → Supabase upsert → RLS check

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
- [ ] Dev server runs without errors
- [ ] Schema deployed to Supabase
- [ ] Can login as admin
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
