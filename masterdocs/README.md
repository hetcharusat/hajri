# Hajri Project Master Documentation

**Last Updated:** December 25, 2025

This directory contains comprehensive documentation for the Hajri project ecosystem, including architecture, workflows, schemas, and development roadmap.

## 📁 Directory Structure

```
masterdocs/
├── README.md                    # This file
├── CHAT_CONTEXT.md             # Full conversation summary & context
├── hajri-admin/                # Admin Portal documentation
│   ├── ARCHITECTURE.md         # Technical architecture & stack
│   ├── SCHEMA_V2.md           # Database schema (V2 with offerings)
│   ├── WORKFLOWS.md           # User workflows & features
│   └── ROADMAP.md             # Remaining todos & future work
└── hajri-ocr/                  # OCR Project documentation
    ├── OVERVIEW.md            # Project overview & purpose
    └── ARCHITECTURE.md        # Technical details
```

## 🎯 Projects Overview

### 1. **Hajri Admin Portal** (`hajri-admin/`)
A full-featured admin panel for managing academic timetables, departments, faculty, students, and course offerings. Built with React + Supabase.

**Status:** Active development - V3 structure tree + timetable editor  
**Key Features:**
- Google Calendar-like timetable editor
- Scope-aware schedule management (tree-selected batch)
- Course offerings mapping (subject → batch → faculty)
- Draft/Published versioning workflow
- Complete CRUD for all academic entities

### 2. **Hajri OCR** (`hajri-ocr/`)
OCR-based system for processing and extracting data from academic documents.

**Status:** Existing/Stable  
**Purpose:** Document processing and data extraction (details in /hajri-ocr/OVERVIEW)

## 🔑 Key Context for New Sessions

### Current State (December 25, 2025)
- ✅ Admin portal routes under `/app/*` (React Router)
- ✅ Structure tree sidebar drives scope (department → branch → semester → class → batch)
- ✅ Timetable editor is `TimetableNew.jsx`
- ✅ Assignments/offerings page is `OfferingsNew.jsx`
- ✅ Auto-naming implemented for classes/batches (`3CE1`, `3CE1-A`)
- ⚠️ Ensure DB migration for `classes.name` / `batches.name` is applied (see schema docs)

### Immediate Next Steps
1. **Deploy schema** - Run `hajri-admin/CLEAN-SCHEMA.sql` in Supabase SQL Editor
2. **Apply migrations (if needed)** - Especially name columns for class/batch
3. **Smoke test workflow** - Subjects → Assignments → Timetable → Publish
4. **Keep docs current** - Use `masterdocs/hajri-admin/AI_CONTEXT.md` + `FILE_MAPPING.md`

### Critical Files
- `hajri-admin/CLEAN-SCHEMA.sql` - Authoritative database schema
- `hajri-admin/src/pages/TimetableNew.jsx` - Timetable editor
- `hajri-admin/src/pages/OfferingsNew.jsx` - Assignments (offerings)
- `hajri-admin/src/App.tsx` - Routes
- `hajri-admin/.env.local` - Supabase credentials (not in repo)

## 📖 How to Use This Documentation

1. **Starting Fresh?** → Read `CHAT_CONTEXT.md` first
2. **Need Architecture?** → See `hajri-admin/ARCHITECTURE.md`
3. **Schema Questions?** → Check `hajri-admin/SCHEMA_V2.md`
4. **What's Next?** → Review `hajri-admin/ROADMAP.md`
5. **OCR Context?** → Start with `hajri-ocr/OVERVIEW.md`

## 🚀 Quick Start Commands

```powershell
# Admin Portal (hajri-admin/)
cd b:\hajri\hajri-admin
npm install
npm run dev

# OCR Project (hajri-ocr/)
cd b:\hajri\hajri-ocr
# (See hajri-ocr/OVERVIEW.md for setup)
```
## Run locally

- Dev server (live reload): `npm run docs:dev`

## Render static HTML (for hosting)

In this environment, VitePress static build can fail under newer system Node versions.
Use the included PowerShell helper to build using a Node 20 executable (via `nvm-windows`):

- Build: `./build-static.ps1`
- Serve the built output: `./serve-static.ps1` (then open `http://127.0.0.1:8090/`)

## 🔗 External Dependencies

- **Supabase**: Database + Auth + RLS
- **React + Vite**: Frontend framework
- **Tailwind + shadcn/ui**: Styling system
- **Zustand**: State management

---

**For detailed context and conversation history, see [Chat Context](/CHAT_CONTEXT)**
