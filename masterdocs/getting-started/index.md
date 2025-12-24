---
title: Getting Started
---

# Getting Started

This docs site is powered by **VitePress** and contains documentation for:
- **Hajri Admin Portal** (React + Supabase)
- **Hajri OCR** (FastAPI + PaddleOCR)

## Quick Links

- [Quick Start](/QUICK_START)
- [Admin Portal Overview](/hajri-admin/)
- [OCR Overview](/hajri-ocr/)
- [Full Chat Context](/CHAT_CONTEXT)

## Run The Docs Site

From the workspace root:

```powershell
npm --prefix b:\hajri\masterdocs run docs:dev
```

Then open the URL printed by the terminal (usually `http://127.0.0.1:5180/`).

## Run Hajri Admin Portal (Dev)

```powershell
cd b:\hajri\hajri-admin
npm install
npm run dev
```

### Required env
Create `hajri-admin/.env.local`:

```dotenv
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Deploy Database Schema (Supabase)

- Open Supabase → **SQL Editor**
- Run: `hajri-admin/CLEAN-SCHEMA.sql`

This is destructive (drops + recreates tables).

## Run Hajri OCR (Dev)

```powershell
cd b:\hajri\hajri-ocr
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
