# HAJRI OCR Service

OCR (Optical Character Recognition) service for extracting attendance data from college attendance screenshots.

## Overview

This service uses PaddleOCR to:
- Extract text from attendance screenshots
- Parse tabular attendance data
- Return structured JSON with subject-wise attendance (present/total/percentage)

## Quick Start

### Prerequisites

- Python 3.10+
- PaddleOCR dependencies

### Installation

```bash
cd hajri-ocr

# Create virtual environment (optional)
python -m venv venv
.\venv\Scripts\Activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `APP_API_KEY` - API key for authentication (optional in dev)
- `ADMIN_USERS_JSON` - Admin credentials for debug UI
- `ENABLE_DEBUG_UI` - Enable/disable debug interface
- `ENABLE_DOCS` - Enable/disable Swagger docs

### Running the Service

**Development (with auto-reload):**
```bash
uvicorn main:app --reload --port 8001
```

**Production:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

The service will be available at:
- API: http://localhost:8001
- Health Check: http://localhost:8001/health
- Docs (if enabled): http://localhost:8001/docs
- Debug UI (if enabled): http://localhost:8001/debug

## API Endpoints

### Health Check
```
GET /health
```
Returns service status and metrics.

### OCR Extract
```
POST /ocr/extract
Content-Type: multipart/form-data

file: <image file>
```

**Headers:**
- `X-API-Key`: Your API key (if configured)

**Response:**
```json
{
  "success": true,
  "message": "Extracted N subjects",
  "entries": [
    {
      "subject_code": "CS101",
      "subject_name": "Data Structures",
      "present": 42,
      "total": 50,
      "percentage": 84.0
    }
  ]
}
```

## Architecture

```
hajri-ocr/
├── main.py              # FastAPI application
├── config.py            # Configuration settings
├── models.py            # Pydantic models
├── table_extractor.py   # OCR & table extraction logic
├── image_preprocessor.py # Image preprocessing
├── requirements.txt     # Python dependencies
└── render.yaml          # Render deployment config
```

## Deployment

### Render

The service is configured for Render deployment via `render.yaml`.

```bash
# Uses render.yaml configuration
# Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

## Integration

This service is used by:
- **HAJRI Engine Test Portal** - For testing OCR flow
- **HAJRI Android App** - For production attendance capture

The test portal expects this service at `http://localhost:8001` during development.

## Notes

- The OCR service is **stateless** - it doesn't store any data
- All persistence happens through HAJRI Engine after user confirmation
- Image preprocessing improves accuracy on low-quality screenshots
