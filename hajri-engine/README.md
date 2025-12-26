# HAJRI Engine

Headless, deterministic computation engine for the Hajri attendance system.

## Overview

HAJRI Engine is a FastAPI backend that:
- Enforces attendance rules
- Reconciles OCR snapshots with manual entries
- Computes attendance summaries and predictions
- Exposes JSON APIs for the mobile app

## Tech Stack

- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** Supabase (PostgreSQL)
- **Validation:** Pydantic
- **Date/Time:** pendulum

## Project Structure

```
hajri-engine/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry
│   ├── config.py            # Settings from env
│   ├── core/
│   │   ├── __init__.py
│   │   ├── auth.py          # Supabase JWT validation
│   │   ├── database.py      # DB connection
│   │   └── exceptions.py    # Policy violation errors
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py       # Pydantic models
│   │   └── enums.py         # Enums for status, types
│   ├── services/
│   │   ├── __init__.py
│   │   ├── attendance.py    # Core computation logic
│   │   ├── predictions.py   # Prediction calculations
│   │   └── snapshots.py     # Snapshot processing
│   └── routers/
│       ├── __init__.py
│       ├── snapshots.py     # POST /snapshots/confirm
│       ├── attendance.py    # GET/POST /attendance/*
│       ├── predictions.py   # GET /predictions
│       └── engine.py        # POST /engine/recompute
├── tests/
│   ├── __init__.py
│   ├── test_logic.py        # Pure logic tests
│   ├── test_snapshots.py    # Snapshot scenarios
│   └── test_predictions.py  # Prediction math
├── requirements.txt
├── render.yaml              # Render deployment
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/snapshots/confirm` | Save confirmed OCR snapshot, trigger recompute |
| POST | `/attendance/manual` | Add manual attendance entry |
| GET | `/attendance/summary` | Get pre-computed attendance summary |
| GET | `/predictions` | Get can_bunk/must_attend predictions |
| POST | `/engine/recompute` | Force full recomputation (internal) |

## Truth Hierarchy

1. **OCR Snapshot** (highest) - Confirmed cumulative totals
2. **Manual Attendance** - Incremental entries after snapshot
3. **Timetable** - Future expectation only

## Snapshot Lock Rule

```
T_snap = timestamp of latest confirmed OCR snapshot

✅ Allowed: Manual entries where event_date > T_snap
❌ Forbidden: Manual entries where event_date ≤ T_snap
```

## Running Locally

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run server
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
DEBUG=true
```

## Deployment

Configured for Render.com free tier. See `render.yaml`.
