# Hajri Project Master Documentation

**Last Updated:** December 22, 2025

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

**Status:** Active development - V2 timetable editor implemented  
**Key Features:**
- Google Calendar-like timetable editor
- Batch-wise schedule management
- Course offerings mapping (subject → batch → faculty)
- Draft/Published versioning workflow
- Complete CRUD for all academic entities

### 2. **Hajri OCR** (`hajri-ocr/`)
OCR-based system for processing and extracting data from academic documents.

**Status:** Existing/Stable  
**Purpose:** Document processing and data extraction (details in /hajri-ocr/OVERVIEW)

## 🔑 Key Context for New Sessions

### Current State (December 22, 2025)
- ✅ Schema V2 implemented (offerings + versioned timetables)
- ✅ Timetable V2 editor rebuilt (paint-to-grid workflow)
- ✅ Offerings CRUD page complete
- ⚠️ Dev server has build errors (needs fixing)
- ⏳ Schema needs to be deployed to Supabase
- ⏳ UX consistency pass pending

### Immediate Next Steps
1. **Fix build errors** - Run `npm run dev` in `hajri-admin` and resolve
2. **Deploy CLEAN-SCHEMA.sql** - Run in Supabase SQL Editor
3. **Test Offerings + Timetable** - Smoke test the V2 workflow
4. **UX consistency** - Convert remaining pages to shadcn-style components

### Critical Files
- `hajri-admin/CLEAN-SCHEMA.sql` - Authoritative database schema
- `hajri-admin/src/pages/Timetable.jsx` - V2 timetable editor
- `hajri-admin/src/pages/Offerings.jsx` - Course offerings CRUD
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
