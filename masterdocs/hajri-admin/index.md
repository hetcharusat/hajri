---
title: Hajri Admin Portal
---

# Hajri Admin Portal

A React + Supabase admin panel for managing academic data and building timetables.

## Core Docs

- [Architecture](/hajri-admin/ARCHITECTURE)
- [Schema V2](/hajri-admin/SCHEMA_V2)
- [Workflows](/hajri-admin/WORKFLOWS)
- [Roadmap](/hajri-admin/ROADMAP)

## What This App Does

- CRUD for departments, semesters, subjects, faculty, rooms, batches, students
- **Offerings model (V2):** schedulable unit = subject + batch + faculty (+ default room)
- **Timetable versioning (V2):** per batch draft/published/archived

## Typical Admin Flow

1. Create departments/semesters/subjects/faculty/rooms/batches
2. Create **course offerings** for each batch
3. Build timetable in **Draft** using the editor
4. Publish to make it live (previous published becomes archived)

## Key Source Files

- `hajri-admin/CLEAN-SCHEMA.sql`
- `hajri-admin/src/pages/Offerings.jsx`
- `hajri-admin/src/pages/Timetable.jsx`
- `hajri-admin/src/components/AdminGuard.jsx`
