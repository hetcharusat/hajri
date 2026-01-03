---
layout: home

title: HAJRI Documentation

description: Complete documentation for HAJRI - Attendance Tracking & Prediction System

hero:
  name: "HAJRI Documentation"
  text: "Attendance Tracking & Prediction System"
  tagline: "Admin Portal • Engine API • Mobile Integration • Schema Reference"
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started/
    - theme: alt
      text: API Reference
      link: /hajri-engine/API

features:
  - title: 📱 Mobile App Ready
    details: Complete API documentation and integration guides for building mobile apps with HAJRI Engine.
  - title: 🗄️ Complete Schema
    details: 40+ tables documented with relationships, constraints, and example queries.
  - title: 🚀 Production Deployed
    details: All services live on Render and Vercel with OAuth authentication.
---

## Production URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Hub** | [hajri.onrender.com](https://hajri.onrender.com) | Landing page with all links |
| **Documentation** | [hajridocs.vercel.app](https://hajridocs.vercel.app) | This documentation |
| **Database Admin** | [hajriadmin.vercel.app](https://hajriadmin.vercel.app) | Manage departments, classes, timetables |
| **Engine Admin** | [hajriengine.vercel.app](https://hajriengine.vercel.app) | Test portal for engine |
| **Engine API** | [hajri-x8ag.onrender.com/engine](https://hajri-x8ag.onrender.com/engine) | REST API |
| **OCR API** | [hajri.onrender.com](https://hajri.onrender.com) | OCR service |

## Quick Start for Mobile App Development

```javascript
// 1. Initialize Supabase
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Get predictions
const { data: { session } } = await supabase.auth.getSession();
const predictions = await fetch(
  'https://hajri-x8ag.onrender.com/engine/predictions',
  { headers: { 'Authorization': `Bearer ${session.access_token}` } }
).then(r => r.json());
```

📖 **Full Guide:** [Mobile App Integration](/hajri-engine/MOBILE_APP)

## Documentation Map

### For Mobile App Developers
- [**API Reference**](/hajri-engine/API) - All 32 endpoints with examples
- [**Mobile App Guide**](/hajri-engine/MOBILE_APP) - React Native / Flutter integration
- [**Schema Reference**](/hajri-admin/SCHEMA) - Complete database schema

### For Admin Portal
- [**Admin Overview**](/hajri-admin/) - Portal features and architecture
- [**Deployment**](/hajri-admin/DEPLOYMENT) - Vercel/Netlify deployment
- [**OAuth Setup**](/hajri-admin/OAUTH) - Google OAuth configuration

### For Engine Development
- [**Engine Overview**](/hajri-engine/) - Architecture and data flow
- [**Test Portal**](/hajri-engine/TEST_PORTAL) - Testing guide
- [**Data Flow**](/hajri-engine/DATAFLOW) - How data moves

## Recent Updates (January 4, 2026)

**📱 Mobile App Documentation**
- New [Mobile App Guide](/hajri-engine/MOBILE_APP) with complete integration examples
- Updated [API Reference](/hajri-engine/API) with all 32 endpoints
- New [Schema Reference](/hajri-admin/SCHEMA) with 40+ tables

**🚀 Production Deployment**
- All services deployed and running
- OAuth authentication working
- CORS configured for all origins

**🗄️ Schema Updates**
- Complete documentation of all tables
- Example queries for common operations
- Known issues and limitations documented
