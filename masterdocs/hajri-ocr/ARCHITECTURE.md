# Hajri OCR - Technical Architecture

**Technology:** Python + FastAPI + PaddleOCR API  
**Deployment:** Render (cloud platform)

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Mobile App (Student)                    │
│  - Capture attendance screenshot                           │
│  - Upload to Hajri OCR API                                 │
│  - Display extracted records                               │
└───────────────────────┬────────────────────────────────────┘
                        │
                        │ HTTPS POST /extract
                        │ (multipart/form-data)
                        ▼
┌────────────────────────────────────────────────────────────┐
│                   Hajri OCR API (FastAPI)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  main.py     │  │ preprocessor │  │  extractor   │    │
│  │  (Routes)    │──▶│  (Enhance)   │──▶│  (Parse)     │    │
│  └──────────────┘  └──────────────┘  └──────┬───────┘    │
│                                               │             │
│                                               │ API Call    │
└───────────────────────────────────────────────┼────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────┐
│              PaddleOCR PP-Structure API                     │
│  - Layout parsing                                          │
│  - Table detection                                         │
│  - Text recognition                                        │
│  - Return structured data                                  │
└────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### 1. `main.py` - FastAPI Application

**Responsibilities:**
- Define routes (`/extract`, `/health`, `/ping.html`)
- Handle file uploads
- Authentication (API key middleware)
- Response formatting

**Key Routes:**

```python
@app.post("/extract")
async def extract_attendance(
    file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key)
):
    # 1. Read uploaded file
    image_bytes = await file.read()
    
    # 2. Preprocess image
    preprocessed = preprocess_image(image_bytes)
    
    # 3. Extract table
    records = extract_table(preprocessed)
    
    # 4. Map course codes
    mapped_records = map_courses(records)
    
    # 5. Return JSON
    return {"status": "success", "records": mapped_records}
```

**Middleware:**
- CORS (allow mobile app origins)
- API key validation (production only)
- Request logging

---

### 2. `image_preprocessor.py` - Image Enhancement

**Purpose:** Improve OCR accuracy by preprocessing images

**Pipeline:**
```python
def preprocess_image(image_bytes):
    # 1. Load image
    img = Image.open(BytesIO(image_bytes))
    
    # 2. Convert to grayscale
    img = img.convert('L')
    
    # 3. Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    
    # 4. Resize (if too large)
    max_size = (1920, 1080)
    img.thumbnail(max_size, Image.LANCZOS)
    
    # 5. Return as bytes
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()
```

**Techniques Used:**
- **Grayscale Conversion:** Reduce color complexity, focus on text
- **Contrast Enhancement:** Improve text visibility
- **Resize:** Optimize for OCR API (faster processing)
- **Format Normalization:** Convert to PNG (lossless)

**Future Enhancements:**
- Adaptive thresholding (binarization)
- Noise removal (Gaussian blur)
- Skew correction (deskew)
- Border detection and cropping

---

### 3. `table_extractor.py` - OCR & Parsing

**Purpose:** Call PaddleOCR API and parse table structure

**Workflow:**

```python
def extract_table(image_bytes):
    # 1. Call PaddleOCR API
    response = requests.post(
        PADDLEOCR_VL_API_URL,
        headers={"Authorization": f"Bearer {PADDLEOCR_VL_API_TOKEN}"},
        files={"image": image_bytes}
    )
    ocr_result = response.json()
    
    # 2. Parse layout
    tables = find_table_regions(ocr_result['layout'])
    
    # 3. Extract rows and columns
    rows = []
    for table in tables:
        for cell in table['cells']:
            row_idx = cell['row_index']
            col_idx = cell['col_index']
            text = cell['text']
            rows.append((row_idx, col_idx, text))
    
    # 4. Group by rows
    grouped = group_by_row(rows)
    
    # 5. Parse attendance records
    records = []
    for row in grouped:
        if len(row) >= 3:  # [Date, Subject, Status]
            records.append({
                "date": parse_date(row[0]),
                "subject": row[1],
                "status": row[2]
            })
    
    return records
```

**Parsing Challenges:**
- **Layout Variations:** Different universities use different table structures
- **Multi-line Cells:** Cell text spans multiple lines
- **Merged Cells:** Headers or empty cells
- **Noise:** Logos, borders, background patterns

**Solutions:**
- Heuristics: Detect table headers (bold, top position)
- Confidence Filtering: Ignore low-confidence OCR results
- Column Mapping: Dynamically detect which column is date/subject/status
- Fallback: If table detection fails, use line-by-line parsing

---

### 4. `config.py` - Configuration Management

**Purpose:** Load environment variables and course mappings

```python
import os
import json
from dotenv import load_dotenv

load_dotenv()

# Environment
ENV = os.getenv("ENV", "development")
ENABLE_DEBUG_UI = os.getenv("ENABLE_DEBUG_UI", "false").lower() == "true"
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "false").lower() == "true"

# PaddleOCR API
PADDLEOCR_VL_API_URL = os.getenv("PADDLEOCR_VL_API_URL")
PADDLEOCR_VL_API_TOKEN = os.getenv("PADDLEOCR_VL_API_TOKEN")

# Authentication
APP_API_KEY = os.getenv("APP_API_KEY")
ADMIN_COOKIE_SECRET = os.getenv("ADMIN_COOKIE_SECRET")

# Load course config
with open("course_config.json") as f:
    course_config = json.load(f)
```

**Environment Variables:**
- `ENV`: `development` or `production`
- `PADDLEOCR_VL_API_URL`: OCR API endpoint
- `PADDLEOCR_VL_API_TOKEN`: OCR API token
- `APP_API_KEY`: API key for /extract endpoint
- `ENABLE_DEBUG_UI`: Enable debug.html
- `ENABLE_DOCS`: Enable /docs (Swagger UI)
- `ADMIN_COOKIE_SECRET`: Secret for admin cookie
- `ADMIN_USERS_JSON`: JSON map of admin users
- `DEBUG_ADMIN_KEY`: Header-based admin access key

---

### 5. `models.py` - Pydantic Models

**Purpose:** Define request/response schemas

```python
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class AttendanceRecord(BaseModel):
    date: date
    subject: str
    status: str  # "Present", "Absent", "Leave"
    faculty: Optional[str] = None

class ExtractResponse(BaseModel):
    status: str  # "success" or "error"
    records: List[AttendanceRecord]
    raw_ocr: Optional[dict] = None
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    status: str = "error"
    message: str
```

**Benefits:**
- Automatic validation
- JSON serialization
- API documentation (Swagger)

---

## 🔐 Security Architecture

### Authentication Flow

**Production Mode (`ENV=production`):**
```
Client → [X-API-Key: secret] → API → Validate → Process
                                  ↓
                                Reject if invalid
```

**Development Mode:**
- API key not required
- Debug UI accessible
- Docs enabled

### Admin Access (Debug UI)

**Cookie-Based:**
```
1. User → /admin/login → Enter username/password
2. Server → Verify against ADMIN_USERS_JSON
3. Server → Set secure cookie (ADMIN_COOKIE_SECRET)
4. User → /debug.html → Cookie validated → Access granted
```

**Header-Based (Postman/curl):**
```
Client → [X-Admin-Key: secret] → API → Validate → Access granted
```

### Secrets Management
- **Local:** `.env` file (not in repo, use `.env.example`)
- **Render:** Environment variables dashboard (encrypted at rest)

---

## 📊 Data Flow

### End-to-End Request

```
1. Mobile App
   └── Take screenshot → image.jpg

2. Upload
   └── POST /extract (multipart/form-data)
       ├── Header: X-API-Key: abc123
       └── Body: file=image.jpg

3. API Gateway (main.py)
   └── Verify API key → ✓

4. Image Preprocessor
   ├── Load image
   ├── Grayscale
   ├── Enhance contrast
   └── Return preprocessed bytes

5. Table Extractor
   ├── Call PaddleOCR API
   ├── Parse layout
   ├── Detect tables
   ├── Extract rows
   └── Parse records

6. Course Mapper (config.py)
   └── Map "CS101" → "Data Structures"

7. Response Formatter
   └── JSON: {status: "success", records: [...]}

8. Mobile App
   └── Display attendance records
```

---

## 🚀 Deployment Architecture (Render)

### Build Process
```yaml
buildCommand: pip install -r requirements.txt
```

**Steps:**
1. Clone repo from GitHub
2. Install dependencies (requirements.txt)
3. Start Uvicorn server

### Runtime
```yaml
startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Port:** Dynamic (assigned by Render via `$PORT` env var)

### Health Checks
- **Endpoint:** `/health`
- **Interval:** 60 seconds
- **Timeout:** 5 seconds
- **Failures:** 3 consecutive failures → restart

### Scaling
- **Free Tier:** 1 instance (spins down after inactivity)
- **Paid Tier:** Multiple instances, auto-scaling

### Logs
- **Stdout:** Captured by Render dashboard
- **Level:** INFO (default)
- **Retention:** 7 days (free), longer (paid)

---

## 🔄 PaddleOCR API Integration

### Request Format
```bash
curl -X POST https://paddleocr-api.example.com/layout-parsing \
  -H "Authorization: Bearer your-token" \
  -F "image=@attendance.jpg"
```

### Response Format (Simplified)
```json
{
  "layout": [
    {
      "type": "table",
      "bbox": [100, 200, 800, 600],
      "cells": [
        {"row": 0, "col": 0, "text": "Date", "confidence": 0.99},
        {"row": 0, "col": 1, "text": "Subject", "confidence": 0.98},
        {"row": 1, "col": 0, "text": "2025-01-15", "confidence": 0.95},
        {"row": 1, "col": 1, "text": "Data Structures", "confidence": 0.97}
      ]
    }
  ]
}
```

### Error Handling
```python
try:
    response = requests.post(PADDLEOCR_VL_API_URL, ...)
    response.raise_for_status()
    return response.json()
except requests.exceptions.HTTPError as e:
    raise Exception(f"OCR API error: {e}")
except requests.exceptions.Timeout:
    raise Exception("OCR API timeout")
```

---

## 📈 Performance Considerations

### Bottlenecks
1. **Image Upload:** Large screenshots (5-10 MB)
2. **OCR API Call:** Network latency (2-5 seconds)
3. **Image Preprocessing:** CPU-intensive (0.5-1 second)

### Optimizations
- **Image Compression:** Resize before upload (mobile app)
- **Caching:** Cache OCR results (future: Redis)
- **Async Processing:** Background jobs (future: Celery)
- **CDN:** Serve static assets (debug.html, etc.)

---

## 🐛 Error Handling & Logging

### Error Categories
1. **Client Errors (4xx):**
   - 400: Invalid file format
   - 401: Missing/invalid API key
   - 413: File too large

2. **Server Errors (5xx):**
   - 500: OCR API failure
   - 503: Service unavailable

### Logging Strategy
```python
import logging

logger = logging.getLogger(__name__)

logger.info("Processing image: size=%d bytes", len(image_bytes))
logger.error("OCR API failed", exc_info=True)
logger.warning("Low confidence OCR result: %f", confidence)
```

**Log Levels:**
- **INFO:** Normal operations
- **WARNING:** Degraded performance (low confidence)
- **ERROR:** Failures (OCR API down)
- **DEBUG:** Detailed traces (development only)

---

## 🔮 Future Architecture Improvements

### 1. Microservices
- **Preprocessor Service:** Dedicated image enhancement
- **OCR Service:** Self-hosted PaddleOCR (avoid external API)
- **Parser Service:** Table extraction logic
- **Gateway:** FastAPI main app (orchestrator)

### 2. Message Queue
- **Upload:** Submit job to queue (RabbitMQ/Redis)
- **Worker:** Process jobs asynchronously
- **Webhook:** Notify mobile app when done

### 3. Caching Layer
- **Redis:** Cache OCR results (same image = same result)
- **TTL:** 24 hours
- **Key:** Image hash (SHA256)

### 4. Database Integration
- **Store:** Extracted attendance records
- **Link:** With hajri-admin timetable data
- **Analytics:** Attendance trends, reports

---

**Related Docs:**
- [Project Overview](/hajri-ocr/OVERVIEW)
- [Hajri Admin Architecture](/hajri-admin/ARCHITECTURE)
