---
title: Hajri Admin Portal
---

# Hajri Admin Portal

A React + Supabase admin panel for managing academic data and building timetables.

## Core Documentation

### Architecture & Design
- [Architecture](/hajri-admin/ARCHITECTURE) - System design and component structure
- [Schema V2](/hajri-admin/SCHEMA_V2) - Database schema and relationships
- [Workflows](/hajri-admin/WORKFLOWS) - Admin workflows and user journeys

### Deployment & Operations
- [Deployment Guide](/hajri-admin/DEPLOYMENT) - Complete Netlify deployment guide
- [OAuth & Authentication](/hajri-admin/OAUTH) - Google OAuth setup and troubleshooting
- [Performance Optimization](/hajri-admin/PERFORMANCE) - Caching, memoization, and build optimization

### Planning
- [Roadmap](/hajri-admin/ROADMAP) - Upcoming features and improvements

## What This App Does

- CRUD for departments, semesters, subjects, faculty, rooms, batches, students
- **Offerings model (V2):** schedulable unit = subject + batch + faculty (+ default room)
- **Timetable versioning (V2):** per batch draft/published/archived

## Typical Admin Flow

1. Create departments/semesters/subjects/faculty/rooms/batches
2. Create **course offerings** for each batch
3. Build timetable in **Draft** using the editor
4. Publish to make it live (previous published becomes archived)

## Tech Stack

### Frontend
- **Framework:** React 18 with Vite
- **UI Library:** Radix UI + Tailwind CSS
- **State Management:** Zustand
- **Data Fetching:** TanStack Query v4
- **Routing:** React Router v6
- **Icons:** Lucide React

### Backend
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (Google OAuth)
- **Real-time:** Supabase Realtime (future)
- **Storage:** Supabase Storage (future)

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
