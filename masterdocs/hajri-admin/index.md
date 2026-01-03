---
title: HAJRI Admin Portal
---

# HAJRI Admin Portal

> **Production:** https://hajriadmin.vercel.app  
> **Last Updated:** January 4, 2026

A React + Supabase admin panel for managing academic data and building timetables.

## Core Documentation

### Schema & Data
- [**Schema Reference**](/hajri-admin/SCHEMA) - Complete database schema (40+ tables)
- [Schema V2](/hajri-admin/SCHEMA_V2) - Original V2 design notes

### Architecture & Design
- [Architecture](/hajri-admin/ARCHITECTURE) - System design and component structure
- [Workflows](/hajri-admin/WORKFLOWS) - Admin workflows and user journeys

### Deployment & Operations
- [Deployment Guide](/hajri-admin/DEPLOYMENT) - Complete Vercel/Netlify deployment guide
- [OAuth & Authentication](/hajri-admin/OAUTH) - Google OAuth setup and troubleshooting
- [Performance Optimization](/hajri-admin/PERFORMANCE) - Caching, memoization, and build optimization

### Planning
- [Roadmap](/hajri-admin/ROADMAP) - Upcoming features and improvements

- **Offerings model (V2):** schedulable unit = subject + batch + faculty (+ default room). Now includes advanced search and filtering.
- **Timetable versioning (V2):** per batch draft/published/archived. Supports automatic Lab merging (2-hour slots) and conflict detection.
- **Academic Calendar:** Integrated CHARUSAT 2025-26 calendar with local timezone support.

## Typical Admin Flow

1. Ensure at least one department exists
2. Use `/app/overview` + Tree Explorer to create branch → semester → class → batch
3. With semester selected: create subjects (`/app/subjects`)
4. Create faculty (`/app/faculty`) and rooms (`/app/rooms`)
5. With class selected: create assignments (`/app/assignments`)
6. With batch selected: build + publish timetable (`/app/timetable`)

- **Data Fetching:** TanStack Query v4
- **Routing:** React Router v6
- **Icons:** Lucide React

### Backend
- **Database:** Supabase (PostgreSQL)

### Deployment
- **Hosting:** Netlify (CDN + auto-deploy)
- **CI/CD:** GitHub Actions → Netlify
- **Domain:** hajriadmin.netlify.app
- **SSL:** Let's Encrypt (automatic)

## Performance Features

- **React Query Caching:** 5-minute staleTime, 10-minute cacheTime
- **Code Splitting:** Vendor chunks for optimal caching
- **Memoization:** useMemo and React.memo for expensive operations
- **Build Optimization:** Minimized bundles, no source maps in production

## Quick Links

### Production
- **App:** https://hajriadmin.netlify.app
- **Supabase:** https://etmlimraemfdpvrsgdpk.supabase.co
- **GitHub:** https://github.com/hetcharusat/hajri

### Development
```powershell
cd hajri-admin
npm install
npm run dev
```

## Key Source Files

- `hajri-admin/CLEAN-SCHEMA.sql` - Database schema
- `hajri-admin/src/pages/OfferingsNew.jsx` - Course assignments
- `hajri-admin/src/pages/TimetableNew.jsx` - Timetable editor
- `hajri-admin/src/components/AdminGuard.jsx` - Permission checking
- `hajri-admin/vite.config.js` - Build configuration
- `hajri-admin/netlify.toml` - Deployment configuration
