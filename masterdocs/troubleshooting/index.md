---
title: Troubleshooting
---

# Troubleshooting

This page covers the common issues you’ll hit when running the docs site, the admin portal, or deploying the schema.

## Docs Site (VitePress)

### Site won’t start / runs from the wrong folder
Run VitePress with `--prefix` so it always uses `masterdocs/package.json`:

```powershell
npm --prefix b:\hajri\masterdocs run docs:dev
```

### Port already in use
VitePress will auto-pick a different port and print it:

- Example: `http://127.0.0.1:5180/`

If you need a fixed port, stop the process using that port first.

### “The language 'env' is not loaded” spam
That’s only syntax highlighting. Fix by using `dotenv` fences instead of `env`:

```dotenv
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Hajri Admin Portal

### `npm run dev` exits with code 1
1. Install deps:

```powershell
cd b:\hajri\hajri-admin
npm install
```

2. Ensure env exists:

```dotenv
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

3. Re-run:

```powershell
npm run dev
```

If it still fails, copy the **full terminal error output** (first stack trace) into the issue.

### Login works but page shows “Access Denied”
Your user exists in `users` but `is_admin` is false.

In Supabase SQL Editor:

```sql
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

Then refresh.

## Supabase Schema (CLEAN-SCHEMA.sql)

### “cannot drop function handle_new_user() because other objects depend on it”
The drop order must be:
1. Drop trigger on `auth.users`
2. Drop function

The current `CLEAN-SCHEMA.sql` already includes the correct order.

### RLS “permission denied” errors
Usually one of these:
- You are not logged in (no Supabase auth session)
- You are logged in but not admin (`users.is_admin = false`)
- The schema wasn’t deployed or is partially deployed

Checklist:
- Confirm `users` row exists for your `auth.users.id`
- Confirm `is_admin = true`
- Confirm the V2 tables exist (`course_offerings`, `timetable_versions`, `timetable_events`)

## Timetable V2 Gotchas

- You must create **Offerings** first; timetable cells reference offerings.
- Draft vs Published: editing happens on Draft; Published is read-only.
