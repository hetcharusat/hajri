# Hajri OCR - Project Overview

**Purpose:** OCR-based system for extracting attendance data from university dashboard screenshots  
**Stack:** Python + FastAPI + PaddleOCR (hosted API)  
**Status:** Stable/Production (separate from hajri-admin)

---

## 🎯 Project Purpose

Hajri OCR is a backend service that processes images of university attendance dashboards and extracts structured attendance records. It uses a hosted PaddleOCR PP-Structure (layout-parsing) API to perform OCR and table extraction.

**Key Use Case:**
1. Student captures screenshot of attendance dashboard
2. Uploads to Hajri OCR API
3. System extracts table data (date, subject, status)
4. Returns structured JSON
5. Mobile app displays or stores attendance records

---

## 🏗️ Architecture

```
┌─────────────────┐
│  Mobile App     │
│  (Student)      │
└────────┬────────┘
         │ Upload Image
         │ (POST /extract)
         ▼
┌─────────────────┐
│  Hajri OCR API  │
│  (FastAPI)      │
└────────┬────────┘
         │ Call OCR
         │
         ▼
┌─────────────────┐
│ PaddleOCR API   │
│ (Hosted)        │
└─────────────────┘
```

---

## 📂 Project Structure

```
hajri-ocr/
├── main.py                      # FastAPI app + routes
├── models.py                    # Pydantic models
├── config.py                    # Configuration loader
├── image_preprocessor.py        # Image preprocessing logic
├── table_extractor.py           # Table parsing + extraction
├── course_config.json           # Course name mappings
├── requirements.txt             # Python dependencies
├── runtime.txt                  # Python version (for Render)
├── render.yaml                  # Render deployment config
├── debug.html                   # Debug UI (if ENABLE_DEBUG_UI=true)
└── README.md                    # Project readme
```

---

## 🔧 Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation
- **Pillow (PIL)** - Image preprocessing

### OCR Service
- **PaddleOCR PP-Structure** - Layout parsing + table detection
- **Hosted API** - External service (not self-hosted)

### Deployment
- **Render** - Platform (configured via render.yaml)
- **Python 3.11** - Runtime

---

## 🚀 Getting Started

### Local Development

**Prerequisites:**
- Python 3.11+
- PaddleOCR API credentials

**Setup:**
```bash
cd hajri-ocr
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Environment Variables:**
```bash
cp .env.example .env
```

Edit `.env`:
```dotenv
# Required - PaddleOCR API
PADDLEOCR_VL_API_URL=https://your-paddleocr-api.com/layout-parsing
PADDLEOCR_VL_API_TOKEN=your-api-token

# Optional - Supabase Sync (for importing subjects from database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Optional (development)
ENV=development
ENABLE_DEBUG_UI=true
ENABLE_DOCS=true

# Optional (production)
APP_API_KEY=your-api-key
ADMIN_COOKIE_SECRET=your-secret
ADMIN_USERS_JSON={"admin":"password"}
DEBUG_ADMIN_KEY=your-admin-key
```

**Run:**
```bash
uvicorn main:app --reload
```

**URLs:**
- API: http://localhost:8000
- Health: http://localhost:8000/health
- Ping: http://localhost:8000/ping.html
- Docs: http://localhost:8000/docs (if ENABLE_DOCS=true)
- Debug UI: http://localhost:8000/debug.html (if ENABLE_DEBUG_UI=true)

---

## 📡 API Endpoints

### 1. `POST /extract`
**Purpose:** Extract attendance data from image

**Request:**
```bash
curl -X POST http://localhost:8000/extract \
  -H "X-API-Key: your-app-api-key" \
  -F "file=@attendance_screenshot.jpg"
```

**Response:**
```json
{
  "status": "success",
  "records": [
    {
      "date": "2025-01-15",
      "subject": "Data Structures",
      "status": "Present",
      "faculty": "Dr. Smith"
    },
    {
      "date": "2025-01-16",
      "subject": "Algorithms",
      "status": "Absent",
      "faculty": "Dr. Johnson"
    }
  ],
  "raw_ocr": "..." // (if requested)
}
```

### 2. `GET /health`
**Purpose:** Health check

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-22T10:30:00Z"
}
```

### 3. `GET /ping.html`
**Purpose:** Simple ping endpoint (HTML)

---

## 🎨 Features

### Image Preprocessing
**File:** `image_preprocessor.py`

**Steps:**
1. Load image
2. Convert to grayscale
3. Apply contrast enhancement
4. Resize if needed (optimize for OCR)
5. Return preprocessed image bytes

**Purpose:** Improve OCR accuracy on low-quality screenshots

---

### Table Extraction
**File:** `table_extractor.py`

**Steps:**
1. Send preprocessed image to PaddleOCR API
2. Receive layout-parsed result (bounding boxes + text)
3. Detect table regions
4. Extract rows and columns
5. Parse attendance records (date, subject, status)
6. Map subject codes to full names (via course_config.json)
7. Return structured data

**Challenges:**
- Dashboard layouts vary by university
- Need robust table detection
- Subject name normalization

---

### Course Mapping
**File:** `course_config.json`

**Purpose:** Map abbreviated course codes to full names for OCR matching

**Example:**
```json
{
  "courses": {
    "CEUC101": {
      "name": "COMPUTER CONCEPTS AND PROGRAMMING",
      "abbr": "CCP"
    },
    "MSUD101": {
      "name": "ENGINEERING MATHEMATICS I",
      "abbr": "EM-I"
    }
  },
  "validation": {
    "fuzzy_match_threshold": 0.75
  }
}
```

### Database Sync (NEW!)

**Purpose:** Automatically sync course mappings from Supabase database instead of manually editing JSON

**Prerequisites:**
1. Run migration: `15-subject-abbreviations.sql` (adds `abbreviation` column to subjects table)
2. Set environment variables in `.env`:
   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

**Admin Panel Setup:**
1. Go to hajriadmin.vercel.app → Subjects
2. Add/edit subjects with **Abbreviation** field (e.g., "CCP", "EM-I", "DAA")
3. Only subjects with abbreviations will be synced

**Sync Methods:**

**1. Debug UI (Recommended):**
1. Go to hajri.onrender.com/debug.html
2. Find "Sync from Database" section
3. Select semester (or "All Semesters")
4. Click "Sync Now"

**2. API Endpoint:**
```bash
# Sync all subjects with abbreviations
curl -X POST https://hajri.onrender.com/supabase/sync \
  -H "X-Admin-Key: your-admin-key"

# Sync specific semester
curl -X POST "https://hajri.onrender.com/supabase/sync?semester_id=uuid" \
  -H "X-Admin-Key: your-admin-key"
```

**Response:**
```json
{
  "ok": true,
  "synced": 15,
  "courses": {
    "CEUC101": {"name": "COMPUTER CONCEPTS AND PROGRAMMING", "abbr": "CCP"},
    "MSUD101": {"name": "ENGINEERING MATHEMATICS I", "abbr": "EM-I"}
  },
  "message": "Successfully synced 15 subjects from database"
}
```

**Sync Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/supabase/status` | GET | Check if Supabase is configured and connected |
| `/supabase/subjects` | GET | List all subjects from database |
| `/supabase/semesters` | GET | List all semesters (for filtering) |
| `/supabase/sync` | POST | Sync subjects to course_config.json |

---

## 🔐 Security

### API Key Authentication
**Production:** Requires `X-API-Key` header (set via `APP_API_KEY` env var)

**Request:**
```bash
curl -H "X-API-Key: your-api-key" http://api.example.com/extract
```

### Admin Access (Debug UI)
**Cookie-Based:** Requires login via `/admin/login`

**Config:**
```dotenv
ADMIN_COOKIE_SECRET=random-secret-string
ADMIN_USERS_JSON={"admin":"secure-password"}
```

**Header-Based (Postman/curl):**
```bash
curl -H "X-Admin-Key: your-debug-admin-key" http://api.example.com/debug.html
```

### Environment Modes
- **Development:** `ENV=development` (docs/debug UI enabled by default)
- **Production:** `ENV=production` (docs/debug UI disabled, API key required)

---

## 📦 Dependencies

**Core:**
```
fastapi
uvicorn[standard]
python-multipart
pydantic
pillow
requests
```

**Optional:**
```
python-jose  # JWT (if auth added)
passlib      # Password hashing (if auth added)
```

---

## 🚀 Deployment (Render)

**File:** `render.yaml`

**Configuration:**
```yaml
services:
  - type: web
    name: hajri-ocr
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: ENV
        value: production
      - key: ENABLE_DEBUG_UI
        value: false
      - key: ENABLE_DOCS
        value: false
      - key: PADDLEOCR_VL_API_URL
        sync: false  # Set in Render dashboard (secret)
      - key: PADDLEOCR_VL_API_TOKEN
        sync: false  # Set in Render dashboard (secret)
      - key: APP_API_KEY
        sync: false  # Set in Render dashboard (secret)
```

**Steps:**
1. Push code to GitHub
2. Connect Render to repo
3. Set environment variables in Render dashboard
4. Deploy
5. API live at: `https://hajri-ocr.onrender.com`

---

## 🐛 Debugging

### Enable Debug UI
```dotenv
ENABLE_DEBUG_UI=true
```

**Access:** http://localhost:8000/debug.html

**Features:**
- Upload image
- View extracted records
- See raw OCR output
- Test different preprocessing settings

### Enable API Docs
```dotenv
ENABLE_DOCS=true
```

**Access:** http://localhost:8000/docs (Swagger UI)

### Logs
```bash
# Uvicorn logs (stdout)
INFO:     Started server process [12345]
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     POST /extract - 200 OK
```

---

## 🔄 Workflow Example

### Student App Integration

**Step 1: Capture Screenshot**
- Student opens university portal
- Views attendance page
- Takes screenshot (mobile app)

**Step 2: Upload to API**
```javascript
const formData = new FormData()
formData.append('file', imageBlob, 'attendance.jpg')

const response = await fetch('https://hajri-ocr.onrender.com/extract', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key'
  },
  body: formData
})

const data = await response.json()
```

**Step 3: Display Records**
```javascript
data.records.forEach(record => {
  console.log(`${record.date}: ${record.subject} - ${record.status}`)
})
```

**Step 4: Store in Local DB (Mobile)**
- Save records to SQLite/Realm
- Sync with Supabase (future integration with hajri-admin)

---

## 🎯 Known Limitations

### OCR Accuracy
- Depends on image quality (lighting, resolution, blur)
- Dashboard layout variations affect parsing
- Non-standard fonts may reduce accuracy

### Table Detection
- Assumes tabular layout (rows × columns)
- May fail on non-standard layouts
- Requires fine-tuning per university dashboard

### Course Mapping
- Manual configuration (course_config.json)
- Needs to be updated per university/semester
- No auto-detection of course names

---

## 🔮 Future Enhancements

### 1. Multi-University Support
- Detect university from image (logo/watermark)
- Load university-specific config
- Different parsing rules per university

### 2. ML-Based Table Parsing
- Train custom model on university dashboards
- Improve accuracy for non-standard layouts
- Auto-detect table regions

### 3. Integration with Hajri Admin
- Link OCR-extracted attendance with timetable data
- Cross-validate (expected vs actual classes)
- Generate attendance reports

### 4. Batch Processing
- Upload multiple screenshots
- Process in background (Celery/Redis)
- Return job ID, poll for results

### 5. Attendance Analytics
- Calculate attendance percentage
- Predict risk of shortage (< 75% required)
- Alert students before critical threshold

---

## 🛠️ Development Tips

### Testing OCR Locally
```python
from image_preprocessor import preprocess_image
from table_extractor import extract_table

# Preprocess
preprocessed = preprocess_image('test.jpg')

# Extract
records = extract_table(preprocessed)
print(records)
```

### Adding New Course Mappings
Edit `course_config.json`:
```json
{
  "NEW101": {
    "name": "New Subject Name",
    "code": "NEW101"
  }
}
```

### Custom Preprocessing
Edit `image_preprocessor.py`:
```python
def preprocess_image(image_path):
    # Add custom preprocessing steps
    # Example: denoise, sharpen, rotate
    ...
```

---

## 📞 Support

### Common Issues

**Issue:** "OCR API not responding"  
**Solution:** Check `PADDLEOCR_VL_API_URL` and `PADDLEOCR_VL_API_TOKEN` env vars

**Issue:** "Table not detected"  
**Solution:** Try different image preprocessing settings, check image quality

**Issue:** "Subject name not mapped"  
**Solution:** Add course mapping to `course_config.json`

**Issue:** "API key invalid"  
**Solution:** Verify `X-API-Key` header matches `APP_API_KEY` env var

---

## 🔗 Related Projects

- **Hajri Admin Portal** - Admin panel for timetable management (separate project)
- **Hajri Mobile App** - Student-facing app for attendance tracking (future)

---

**For admin portal documentation, see [masterdocs/hajri-admin/](../hajri-admin/)**
