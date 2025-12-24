---
layout: home

title: Hajri Documentation

description: Master documentation for Hajri Admin Portal + Hajri OCR

hero:
  name: "Hajri Documentation"
  text: "Everything about the Admin Portal and OCR system"
  tagline: "Architecture, schema, workflows, roadmap, and full chat context"
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started/
    - theme: alt
      text: Admin Portal
      link: /hajri-admin/

features:
  - title: Hajri Admin Portal
    details: Complete guide including deployment, OAuth setup, performance optimization, V2 schema, and timetable editor workflows.
  - title: Hajri OCR
    details: FastAPI OCR backend architecture, endpoints, and deployment notes.
  - title: Production Ready
    details: Live deployment guides, OAuth troubleshooting, performance optimization, and comprehensive documentation.
---

## Start Here

- If you’re switching accounts or onboarding: start in **Getting Started**.
- If you need every decision and issue history: open **Chat Context**.
- If you’re working on the timetable/editor/schema: start in **Admin Portal** docs.

### Quick Links

- [Getting Started](/getting-started/)
- [Quick Start](/QUICK_START)
- [Chat Context](/CHAT_CONTEXT)
- [Admin Portal Overview](/hajri-admin/)
- [🚀 Deployment Guide](/hajri-admin/DEPLOYMENT)
- [🔐 OAuth Setup](/hajri-admin/OAUTH)
- [⚡ Performance Guide](/hajri-admin/PERFORMANCE)
- [Admin Architecture](/hajri-admin/ARCHITECTURE)
- [Schema V2](/hajri-admin/SCHEMA_V2)
- [Roadmap](/hajri-admin/ROADMAP)
- [OCR Overview](/hajri-ocr/)

## Recent Updates (Dec 24, 2024)

**Production Deployment ✅**
- Live at: https://hajriadmin.netlify.app
- OAuth configured with Google Cloud Console
- Fixed OAuth redirect issues (localhost → production)
- Performance optimizations applied

**New Documentation 📚**
- [Deployment Guide](/hajri-admin/DEPLOYMENT) - Complete Netlify deployment walkthrough
- [OAuth & Authentication](/hajri-admin/OAUTH) - Google OAuth setup and troubleshooting
- [Performance Optimization](/hajri-admin/PERFORMANCE) - Caching, memoization, build optimization

**Code Optimizations ⚡**
- React Query caching: 5min staleTime, 10min cacheTime (~80% reduction in API calls)
- Component memoization with useMemo and React.memo
- Code splitting for optimal bundle sizes
- Removed debug logs for production
