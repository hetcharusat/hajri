# SQL Queries - HAJRI Database Setup

This folder contains all SQL scripts for setting up and managing the HAJRI database in Supabase.

## 📋 File Structure

### Core Schema Files

1. **01-CLEAN-SCHEMA.sql** - Complete fresh schema
   - Drops all tables (use with caution!)
   - Creates all tables from scratch
   - Sets up indexes and relationships
   - **Run First** if starting from scratch

2. **02-SUPABASE-SETUP.sql** - User authentication setup
   - Creates `users` table linked to `auth.users`
   - Sets up Row Level Security (RLS) policies
   - Creates admin user management functions
   - Run after CLEAN-SCHEMA

3. **03-SUPABASE-SCHEMA.sql** - Alternative schema
   - Simpler schema variation
   - Includes sample seed data
   - Has built-in RLS policies

4. **04-SUPABASE-ADMIN-POLICIES.sql** - Access control
   - Defines admin user table
   - Sets read/write permissions
   - Controls who can modify data

### Data & Testing

5. **05-SAMPLE-DATA.sql** - Test data
   - Departments, semesters, subjects
   - Sample faculty and rooms
   - Sample students and timetable entries
   - Run after schema setup for testing

### Database Migrations

**migrations/** folder contains incremental updates:

- **01-add_slots_to_period_templates.sql**
  - Adds JSONB slots column to period_templates
  - Migrates data from old periods table if it exists

- **02-add_name_columns_to_classes_and_batches.sql**
  - Adds `name` column to classes table (format: `3CE1`)
  - Adds `name` column to batches table (format: `3CE1-A`)
  - Enables auto-naming feature

### Debug & Utilities

- **DEBUG-USER.sql**
  - Checks user setup in auth.users
  - Verifies admin user creation
  - Helpful for troubleshooting auth issues

## 🚀 Usage Guide

### Fresh Installation

```sql
-- Run in order:
1. 01-CLEAN-SCHEMA.sql          -- Create all tables
2. 02-SUPABASE-SETUP.sql         -- Setup users & auth
3. 05-SAMPLE-DATA.sql            -- Load test data
4. migrations/02-*.sql           -- Apply migrations
```

### Existing Database

```sql
-- Only run migrations:
migrations/01-add_slots_to_period_templates.sql
migrations/02-add_name_columns_to_classes_and_batches.sql
```

### Troubleshooting

```sql
-- Check user is created:
DEBUG-USER.sql

-- Verify tables exist:
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check auto-naming works:
SELECT id, name FROM classes LIMIT 5;
```

## 📊 Database Hierarchy

```
Department
  └── Branch (abbreviation: CE, IT, ME, etc.)
        └── Semester (1-8)
              └── Subject (courses)
              └── Class (class_1, class_2, etc.)
                    └── Batch (A, B, C, D)
                          └── Students
                          └── Timetable Entries
```

## 🔒 Security

- All tables have Row Level Security (RLS) enabled
- Only admins can write to most tables
- Students can read published timetables
- Policies are defined in 02-SUPABASE-SETUP.sql

## ⚠️ Important Notes

- **sql-queries/** folder is in .gitignore
- Don't commit database backups or sensitive data
- Always backup production database before running migrations
- Test migrations on staging first

## 📝 Auto-Naming Feature

- Classes: `{semester_number}{branch_abbr}{class_number}` → `3CE1`
- Batches: `{semester_number}{branch_abbr}{class_number}-{batch_letter}` → `3CE1-A`
- Implemented via migration 02-add_name_columns_to_classes_and_batches.sql
