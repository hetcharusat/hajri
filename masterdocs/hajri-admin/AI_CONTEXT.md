# AI Context - Quick Reference for Code Changes

> **Purpose**: Provide AI assistants with accurate context to avoid editing wrong files.
> **Last Updated**: December 2025

---

## 🎯 BEFORE MAKING ANY CHANGES

Ask yourself:
1. **Which PAGE shows this UI?** → Check route in App.tsx
2. **Is there an INLINE form or SLIPANEL form?** → Check the page file
3. **Are there MULTIPLE implementations?** → Check this document

---

## 📍 Key File Locations

### Faculty (Most Confusing!)

```
MAIN FACULTY PAGE (with popup modal):
  → src/pages/FacultyImproved.jsx
  → Has INLINE modal (Card component), NOT SlidePanel

TREE VIEW FACULTY FORM:
  → src/components/Forms/FacultyForm.jsx  
  → Uses SlidePanel, only shows in StructureExplorer
```

### Class & Batch Auto-Naming

Auto-naming pattern: `{semester}{branch}{class}` → `3CE1`, `{semester}{branch}{class}-{batch}` → `3CE1-A`

```
STANDALONE PAGES (most common usage):
  → src/pages/Classes.jsx          - handleAdd() generates name
  → src/pages/Batches.jsx          - handleAdd() generates name

TREE VIEW FORM:
  → src/components/EntityForm/EntityForm.jsx - handleCreate()
```

### Styling Components

```
SLIDE PANEL (side drawer):
  → src/components/SlidePanel/SlidePanel.jsx

INPUT STYLING:
  → src/components/ui/input.jsx

BUTTON STYLING:
  → src/components/ui/button.jsx
```

---

## 🗺️ Route → File Mapping

| URL Path | Component File | Notes |
|----------|----------------|-------|
| `/login` | `pages/Login.jsx` | |
| `/app/overview` | `pages/Overview.jsx` | |
| `/app/subjects` | `pages/Subjects.jsx` | |
| `/app/faculty` | `pages/FacultyImproved.jsx` | ⚠️ Has inline modal |
| `/app/rooms` | `pages/Rooms.jsx` | |
| `/app/assignments` | `pages/OfferingsNew.jsx` | |
| `/app/timetable` | `pages/TimetableNew.jsx` | |
| `/app/period-templates` | `pages/PeriodTemplates.jsx` | |
| `/settings` | `pages/Settings.jsx` | |

---

## 🔧 Database Schema Notes

### Classes Table
```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY,
  semester_id UUID NOT NULL REFERENCES semesters(id),
  class_number INTEGER NOT NULL,
  name TEXT,  -- Added via migration: '3CE1' format
  created_at TIMESTAMPTZ
);
```

### Batches Table
```sql
CREATE TABLE batches (
  id UUID PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id),
  batch_letter TEXT NOT NULL,
  name TEXT,  -- Added via migration: '3CE1-A' format
  created_at TIMESTAMPTZ
);
```

### Hierarchy
```
Department
  └── Branch (has abbreviation like 'CE', 'CSE', 'IT')
        └── Semester (has semester_number: 1-8)
              └── Class (has class_number: 1, 2, 3...)
                    └── Batch (has batch_letter: A, B, C...)
```

---

## ⚠️ Common Pitfalls

1. **"Changes not appearing"** 
   - Dev server might not be running (check terminal)
   - Browser cache (Ctrl+Shift+R or clear cache)
   - Editing wrong file (check this document!)

2. **"Faculty popup not changing"**
   - Edit `pages/FacultyImproved.jsx`, NOT `Forms/FacultyForm.jsx`

3. **"Auto-naming not working"**
   - Must edit ALL locations: Classes.jsx, Batches.jsx, EntityForm.jsx

4. **"SlidePanel changes not visible"**
   - Some pages use inline modals, not SlidePanel
   - Check if the page has `<Card>` with `fixed inset-0` (inline modal)
   - vs `<SlidePanel>` component

---

## 📁 Key Files Summary

```
src/
├── App.tsx                           # Router config
├── pages/
│   ├── FacultyImproved.jsx           # ⭐ MAIN faculty (inline modal)
│   ├── Classes.jsx                   # ⭐ Class CRUD with auto-naming
│   ├── Batches.jsx                   # ⭐ Batch CRUD with auto-naming
│   ├── TimetableNew.jsx              # Timetable DND
│   └── ...other pages
│
├── components/
│   ├── SlidePanel/SlidePanel.jsx     # ⭐ Reusable drawer
│   ├── EntityForm/EntityForm.jsx     # Tree view entity form
│   ├── Forms/
│   │   ├── FacultyForm.jsx           # Tree view faculty form
│   │   ├── SubjectForm.jsx
│   │   ├── RoomForm.jsx
│   │   └── StudentForm.jsx
│   └── ui/
│       ├── input.jsx                 # ⭐ Input styling
│       ├── button.jsx                # ⭐ Button styling
│       └── card.jsx
```

---

## 💡 Tips for AI Assistants

1. **Always search first**: Before editing, search for the text visible in UI
2. **Check multiple files**: Same feature may exist in multiple places
3. **Verify dev server**: Changes only appear if server is running
4. **Read error messages**: They often point to the correct file
5. **Check imports**: Follow import paths to find actual components
