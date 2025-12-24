# Component-File Mapping Guide

> **Purpose**: Quick reference for AI/developers to find the CORRECT file for any UI element.
> **Last Updated**: December 2025

---

## ⚠️ CRITICAL: Read This First

Many UI elements have MULTIPLE implementations in different files. This guide helps you find the RIGHT file.

---

## 🎯 Quick Lookup Table

### Faculty Management

| What You See | Location | Notes |
|-------------|----------|-------|
| Faculty page at `/app/faculty` | `src/pages/FacultyImproved.jsx` | **MAIN** faculty page |
| Faculty edit popup (modal card style) | `src/pages/FacultyImproved.jsx` | Inline modal, NOT SlidePanel |
| Faculty form in StructureExplorer tree | `src/components/Forms/FacultyForm.jsx` | Uses SlidePanel |
| OLD faculty page (deprecated) | `src/pages/faculty/` folder | DO NOT USE |

### Class/Batch Management

| What You See | Location | Notes |
|-------------|----------|-------|
| Classes page (standalone) | `src/pages/Classes.jsx` | With handleAdd() for auto-naming |
| Batches page (standalone) | `src/pages/Batches.jsx` | With handleAdd() for auto-naming |
| Class/Batch forms in tree view | `src/components/EntityForm/EntityForm.jsx` | Uses SlidePanel |
| Class/Batch display in sidebar | `src/components/StructureTree/TreeNode.jsx` | Shows names |
| Class/Batch breadcrumb display | `src/components/ScopeBar.jsx` | Top bar scope |

### Subject Management

| What You See | Location | Notes |
|-------------|----------|-------|
| Subjects page at `/app/subjects` | `src/pages/Subjects.jsx` | Main subjects view |
| Subject form in StructureExplorer | `src/components/Forms/SubjectForm.jsx` | SlidePanel form |

### Room Management

| What You See | Location | Notes |
|-------------|----------|-------|
| Rooms page at `/app/rooms` | `src/pages/Rooms.jsx` | Main rooms view |
| Room form in StructureExplorer | `src/components/Forms/RoomForm.jsx` | SlidePanel form |

### Timetable

| What You See | Location | Notes |
|-------------|----------|-------|
| Timetable page at `/app/timetable` | `src/pages/TimetableNew.jsx` | DND editor |
| OLD timetable (deprecated) | `src/pages/Timetable.jsx` | DO NOT USE |
| Timetable sub-panel | `src/components/Timetable/TimetablePanel.jsx` | Grid component |

### Period Templates

| What You See | Location | Notes |
|-------------|----------|-------|
| Period templates page | `src/pages/PeriodTemplates.jsx` | Main page |
| Period templates tab | `src/components/PeriodTemplatesTab.jsx` | Tab component |

---

## 📂 Directory Structure

```
src/
├── pages/                    # Route endpoint components
│   ├── FacultyImproved.jsx   # ⭐ /app/faculty (HAS INLINE MODAL)
│   ├── Subjects.jsx          # /app/subjects
│   ├── Rooms.jsx             # /app/rooms
│   ├── TimetableNew.jsx      # /app/timetable
│   ├── OfferingsNew.jsx      # /app/assignments
│   ├── PeriodTemplates.jsx   # /app/period-templates
│   ├── Overview.jsx          # /app/overview
│   ├── Settings.jsx          # /settings
│   ├── Login.jsx             # /login
│   │
│   ├── Classes.jsx           # Standalone (not in main nav)
│   ├── Batches.jsx           # Standalone (not in main nav)
│   ├── Branches.jsx          # Standalone (not in main nav)
│   ├── Semesters.jsx         # Standalone (not in main nav)
│   ├── Departments.jsx       # Standalone (not in main nav)
│   └── Students.jsx          # Standalone (not in main nav)
│
├── components/
│   ├── SlidePanel/
│   │   └── SlidePanel.jsx    # ⭐ Reusable slide panel + FormField
│   │
│   ├── EntityForm/
│   │   └── EntityForm.jsx    # Generic entity form (tree view)
│   │
│   ├── Forms/                # Entity-specific forms
│   │   ├── FacultyForm.jsx   # Faculty (for StructureExplorer)
│   │   ├── SubjectForm.jsx   # Subject
│   │   ├── RoomForm.jsx      # Room
│   │   └── StudentForm.jsx   # Student
│   │
│   ├── StructureTree/
│   │   └── TreeNode.jsx      # Sidebar tree nodes
│   │
│   ├── ui/                   # shadcn/ui components
│   │   ├── button.jsx
│   │   ├── input.jsx
│   │   ├── card.jsx
│   │   └── ...
│   │
│   ├── AppShell.jsx          # Main layout with sidebar
│   ├── DashboardLayout.jsx   # Alt layout wrapper
│   ├── AdminGuard.jsx        # Auth protection
│   └── ScopeBar.jsx          # Top breadcrumb bar
```

---

## 🔄 Auto-Naming Feature

The class/batch auto-naming (`3CE1`, `3CE1-A`) is implemented in THREE locations:

1. **`src/pages/Classes.jsx`** → `handleAdd()` function (line ~94)
2. **`src/pages/Batches.jsx`** → `handleAdd()` function (line ~129)
3. **`src/components/EntityForm/EntityForm.jsx`** → `handleCreate()` function

**Pattern:**
- Class: `{semester_number}{branch_abbreviation}{class_number}` → `3CE1`
- Batch: `{semester_number}{branch_abbreviation}{class_number}-{batch_letter}` → `3CE1-A`

---

## 🛣️ Route Configuration

Defined in `src/App.tsx`:

```tsx
/login                → Login.jsx
/app/overview         → Overview.jsx
/app/subjects         → Subjects.jsx
/app/faculty          → FacultyImproved.jsx  // NOT faculty/
/app/rooms            → Rooms.jsx
/app/assignments      → OfferingsNew.jsx
/app/timetable        → TimetableNew.jsx
/app/period-templates → PeriodTemplates.jsx
/settings             → Settings.jsx
```

---

## ⚡ Common Mistakes to Avoid

1. **Faculty forms**: There are TWO different faculty form implementations
   - `FacultyImproved.jsx` has an INLINE modal (the one at /app/faculty)
   - `Forms/FacultyForm.jsx` is only used by StructureExplorer tree

2. **SlidePanel not updating**: Check if the page uses SlidePanel or has inline modal

3. **Auto-naming not working**: Check ALL THREE locations listed above

4. **Timetable changes**: Use `TimetableNew.jsx`, NOT `Timetable.jsx`

5. **Style changes not appearing**: Verify the dev server is running and check browser cache
