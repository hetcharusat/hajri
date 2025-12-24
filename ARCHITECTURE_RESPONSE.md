# Architecture Responses (Tree + Scope + Overview + Dark Mode + Timetable + Performance)

This document implements the requirements in [prompt.txt](prompt.txt) as a behavioral/architecture spec.

## 1) Tree Explorer behavior (Discord / VS Code sidebar)

### Component responsibilities

- **`AppShell` (layout owner)**
  - Owns the overall 2-column layout: left Tree Explorer rail + right workspace.
  - Owns sidebar sizing/collapse state and persistence.
  - Ensures main content flexes smoothly with no layout jump and no opacity animation.
  - Applies the transition timing for width changes: **120–150ms ease-out**.

- **`TreeExplorerSidebar` (behavior wrapper around the existing Tree Explorer)**
  - Renders the Tree Explorer as the **ONLY sidebar**.
  - Contains:
    - Sidebar container with resizable right edge.
    - Collapsed/expanded UI state.
    - Icon-only rail mode.
  - Does **not** manage scope itself (scope is set by Tree clicks via the Tree store → scope store integration).
  - Does **not** appear in page content; it only exists in `AppShell`.

- **Existing Tree component (data + selection)**
  - Continues to own:
    - Node rendering/indentation/expand-collapse of tree nodes.
    - Selected node state (in the structure/tree store).
  - On node click:
    - Updates selected node in the structure store.
    - Triggers scope sync (see section 2 lifecycle).  

### Layout behavior (sizes, resize, collapse)

- **Default width**: 260px
- **Min width**: 200px
- **Max width**: 360px
- **Resizable by dragging right edge**
  - Resize handle is a thin vertical strip at the sidebar’s right boundary.
  - Hover and drag cursor: `col-resize`.
  - Drag updates width continuously, clamped to min/max.

- **Double-click resize handle resets width**
  - Double-click on handle resets width to **260px**.
  - Reset must also update persisted value.

- **Collapsible into icon-only rail (48–56px)**
  - When collapsed:
    - Sidebar width becomes a fixed rail size (choose a single value in **48–56px**, e.g. 52px) and keep it consistent.
    - Sidebar content switches to icon-only presentation (no text labels).
    - Tree can still be interacted with (icon-only nodes or minimal affordances), but the Tree remains the same component logically.
  - When expanded:
    - Sidebar uses the last persisted full width (clamped to min/max).

- **Persistence (localStorage)**
  - Persist two keys:
    - `treeSidebar.width` → number (px) for expanded width.
    - `treeSidebar.collapsed` → boolean.
  - Rules:
    - Collapse state persists across refresh.
    - Width persists across refresh.
    - When collapsed, do not overwrite the saved expanded width.
    - On restore:
      - If collapsed: apply rail width.
      - If expanded: apply saved width, clamped to min/max.

### Smooth content behavior

- Main content uses flex layout so width changes do not reflow as “jump cuts”.
- Only the sidebar width (or flex-basis) transitions.
- **No opacity animation** on main content.
- The transition must not affect height or introduce layout shifts in the workspace header.

### Hard constraints (enforced by structure)

- No additional navigation sidebar.
- No duplicate Tree Explorer anywhere.
- No scope selectors outside the Tree.

---

## 2) Global scope architecture (single source of truth)

### Stores (Zustand)

- **Structure store** (Tree concerns)
  - Owns: `selectedNode`, `expandedNodes`, `treeData`.
  - Emits: selection changes (via state updates).

- **Scope store** (single source of truth)
  - Owns exactly:
    - `departmentId`, `branchId`, `semesterId`, `classId`, `batchId`, `level`.
  - Exposes exactly one write API for scope:
    - **`setScopeFromNode(node)`** (or equivalent) as the *only* way to set scope.
  - Pages must not import/consume any “setX” scope setters.

### 1) Scope lifecycle (tree click → UI update)

1. User clicks a node in the Tree.
2. Structure store updates `selectedNode`.
3. `AppShell` (or the Tree sidebar wrapper) observes `selectedNode` change.
4. It calls `scopeStore.setScopeFromNode(selectedNode)`.
5. Scope store computes:
   - Which IDs exist based on node type/level.
   - Clears any invalidated lower levels.
   - Sets `level` accordingly.
6. TanStack Query reacts:
   - All queries that include scope keys get new query keys.
   - Old scoped caches are naturally separated; new scope triggers new fetches.
7. Pages re-render based on scope (read-only).

### 2) Rules for partial scope

- **No guessing**
  - If a level is not selected, it remains `null`/`undefined`.
  - Do not “infer” missing levels from available data beyond the clicked node’s ancestry.

- **Lower levels imply higher levels**
  - If `batchId` exists, then `classId`, `semesterId`, `branchId`, `departmentId` must also be set.
  - If `classId` exists, then `semesterId`, `branchId`, `departmentId` must also be set.
  - …etc.

- **Selecting a higher level invalidates lower levels**
  - Example: selecting a different `semesterId` clears `classId` and `batchId`.
  - Example: selecting `departmentId` clears `branchId`, `semesterId`, `classId`, `batchId`.

- **Allowed partial states**
  - Department selected: only `departmentId` set, others null.
  - Branch selected: `departmentId` + `branchId` set.
  - Semester selected: `departmentId` + `branchId` + `semesterId` set.
  - Class selected: up to `classId` set.
  - Batch selected: all set.

### 3) How pages should guard against missing scope

- Every page declares a required scope level.
  - Examples:
    - Timetable requires `level === 'batch'`.
    - Subjects might require `level >= 'semester'` and `semesterId` present.

- Guard pattern (behavioral)
  - If required scope is missing:
    - Render a simple empty state message:
      - “Select a node from the tree” or “Batch scope required”.
    - Do not trigger scoped queries.
    - Do not show forms.

- TanStack Query rule
  - Scoped queries must use `enabled: false` unless required IDs exist.

- Scope change invalidates data
  - All query keys must include the minimal required IDs.
  - Never keep “global” queries for scoped entities.

---

## 3) Overview page (dynamic, scope-driven)

### Overview is read-only and conditional on `scope.level`

- **No scope selected** (`level` missing or all IDs null)
  - Show: “Select a node from the tree”.
  - No queries run.

- **Department level** (`level === 'department'`)
  - Show only department-relevant summaries:
    - Count of branches under the department.
    - Count of semesters (total) under the department.
  - Avoid global metrics (no app-wide totals).

- **Branch level** (`level === 'branch'`)
  - Show:
    - Count of semesters under the branch.
    - Count of active semesters (define “active” by your existing semester status field).

- **Semester level** (`level === 'semester'`)
  - Show:
    - Count of classes in the semester.
    - Count of subjects in the semester.

- **Class level** (`level === 'class'`)
  - Show:
    - Count of batches in the class.
    - Assignment coverage summary (e.g., how many subjects have offerings configured) scoped to that class’s batches.

- **Batch level** (`level === 'batch'`)
  - Show:
    - Timetable status for the batch: draft/published.
    - Optionally, last updated time (if tracked), but still scoped to the batch.

### Conditional rendering logic (behavior)

- The Overview decides which queries to run based on `scope.level`.
- It renders exactly one “panel set” per level.
- Scope IDs are never chosen inside Overview; it only consumes.

---

## 4) Dark-mode audit (normalize colors, remove accidental light surfaces)

### 1) Surface hierarchy rules (based on the locked palette)

- **App background**: `#0B0F1A`
  - Used for the root viewport.

- **Sidebar background**: `#0F172A`
  - Always darker than content surfaces.

- **Surface**: `#111827`
  - Used for general content areas/panels.

- **Card**: `#0F172A`
  - Cards slightly distinct from surface; consistent with sidebar tone.

- **Text**
  - Primary: `#E5E7EB`
  - Muted: `#9CA3AF`

- **Semantic colors**
  - Primary: `#3B82F6`
  - Success: `#22C55E`
  - Warning: `#F59E0B`
  - Error: `#EF4444`

- **Tabs**
  - Active tab must read as active via:
    - Stronger text color
    - Clear active indicator (border/underline/background change)
  - Do not use low-contrast active states that resemble “disabled”.

### 2) Common mistakes to remove

- Any direct `bg-white`, `text-black`, `border-gray-200` style choices.
- Using `bg-background` tokens that map to light mode when variables are misconfigured.
- Using shadcn defaults without confirming CSS variables are set for dark.
- Mixing multiple “nearly black” hard-coded colors (contrast noise).

### 3) Prevent contrast noise (system rules)

- Use a single set of CSS variables as the source of truth, mapped to the palette.
- Never hardcode new grays for surfaces; only use the defined tokens.
- Prefer subtle borders over heavy shadows.
- Limit “special case” background colors to semantic states only (error/warning/success).

---

## 5) Timetable redesign (canvas-first, @dnd-kit)

### 1) Interaction flow (drag → drop → edit)

- **Scope**
  - Timetable is **Batch-scoped only** (batch selected from Tree).
  - If batch scope is missing: show “Batch scope required” empty state.

- **Canvas model**
  - The timetable is a grid: `days × time slots`.
  - Offerings exist as draggable blocks (representing a subject assignment instance).

- **Drag start**
  - User drags an offering block.
  - Valid drop targets (grid cells) highlight.

- **Drag over**
  - As the cursor moves over cells:
    - Highlight the target cell.
    - Also highlight conflicting cells (if conflict detection is possible pre-drop).

- **Drop**
  - On drop into a cell:
    - Prompt/choose **room at drop time** (room is part of the placement, not the offering).
    - Placement persists immediately.
    - No “Apply” button for basic placement.

- **Click block → edit**
  - Clicking an existing placed block opens inline edit behavior for:
    - Room
    - Faculty
  - Edits save immediately.

### Room handling (immediate validation)

- Room is chosen during drop, not stored on offering.
- On drop/room selection:
  - Validate room conflicts immediately.
  - If conflict:
    - Block the placement or require immediate resolution.
    - Never silently accept a conflict.

### 2) Why this UX works for admins

- Admins think in slots first (calendar-like), not in forms.
- Immediate placement reduces multi-step friction.
- Visual conflict indicators prevent hidden mistakes.

### 3) Rules that prevent silent conflicts

- Conflicts must surface at the moment of drop/edit, not later.
- No deferred “Apply all changes” flow.
- Every placement mutation runs validation before persisting.

---

## 6) Scalability rules (filtering, virtualization, performance)

### 1) Data loading rules per page

- **Tree scope is the first filter**
  - Never load global lists of scoped entities.

- **All queries must be scoped**
  - Query keys include the relevant scope IDs.
  - Use `enabled` so queries don’t fire when scope is incomplete.

- **Caching strategy (TanStack Query)**
  - Cache per-scope key.
  - Invalidate on mutations within the same scope.

- **Search is always scoped**
  - Search inputs operate only within the current scope.
  - No global search across departments unless the selected scope is department-level.

### 2) Prevent scroll explosion

- Use TanStack Table for large lists.
- Virtualize long tables/lists (row virtualization) when item count is large.
- Do not render nested lists for “all branches/classes/batches” at higher levels; show counts/summaries instead.

### 3) UX indicators for incomplete setup

- If a page requires a deeper scope:
  - Show a clear “Scope required” empty state.
  - Show what to do: “Select a Batch in the Tree Explorer”.

- If scoped data is missing:
  - Show “No X found for this scope” message.
  - Offer creation actions only when scope is valid.
---

## Implementation Status

✅ **Task 1**: Tree Explorer with resizable/collapsible behavior + localStorage persistence is implemented in `AppShell.jsx`  
✅ **Task 2**: Single-source scope architecture is enforced; only `setScopeFromNode` can mutate global scope  
✅ **Task 3**: Overview page is fully scope-driven with conditional rendering per level  
✅ **Task 4**: Dark-mode audit complete; all `bg-white`, `border-gray-200` replaced with dark tokens  
✅ **Task 5**: Canvas-first Timetable with @dnd-kit is implemented in `TimetableNew.jsx` (drag → room-on-drop → immediate conflict validation)  
⚠️ **Task 6**: Performance architecture rules documented; TanStack Query/Table integration ready to implement

### Next Steps for Task 6 (Performance)

1. **Install TanStack Query**:
   ```bash
   npm install @tanstack/react-query
   ```

2. **Wrap app with QueryClientProvider** in `App.tsx`:
   ```tsx
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
   
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         refetchOnWindowFocus: false,
         staleTime: 5 * 60 * 1000,
       },
     },
   })
   
   // Wrap <BrowserRouter> with <QueryClientProvider client={queryClient}>
   ```

3. **Convert data fetching to React Query** (example for scoped queries):
   ```tsx
   import { useQuery } from '@tanstack/react-query'
   
   const { data: subjects } = useQuery({
     queryKey: ['subjects', semesterId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('subjects')
         .select('*')
         .eq('semester_id', semesterId)
       if (error) throw error
       return data
     },
     enabled: Boolean(semesterId),
   })
   ```

4. **Install TanStack Table** for large lists:
   ```bash
   npm install @tanstack/react-table
   ```

5. **Add virtualization** for very long lists:
   ```bash
   npm install @tanstack/react-virtual
   ```
