# Refine.dev Integration Guide

This guide explains how to fully integrate Refine.dev into the Hajri Admin system for a modern, production-ready admin panel.

## Current Status

✅ **Completed:**
- Refine packages installed
- Configuration file created (`src/lib/refineConfig.js`)
- New UI pages created (OfferingsGlobal, FacultyImproved)
- Navigation updated

⏳ **Pending:**
- Wrap App with Refine provider
- Migrate existing pages to use Refine hooks
- Integrate Ant Design components

## Step-by-Step Integration

### Step 1: Update App.jsx with Refine Provider

Replace the current App.jsx content with:

```jsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Refine } from "@refinedev/core"
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar"
import routerBindings from "@refinedev/react-router-v6"
import { supabase, supabaseConfigError } from './lib/supabase'
import { supabaseDataProvider, resources } from './lib/refineConfig'
import { useAuthStore } from './lib/store'
import Login from './pages/Login'
import OfferingsGlobal from './pages/OfferingsGlobal'
import FacultyImproved from './pages/FacultyImproved'
import Settings from './pages/Settings'
import PeriodTemplates from './pages/PeriodTemplates'
import StructureExplorer from './pages/StructureExplorer'
import AdminGuard from './components/AdminGuard'

function App() {
  const { setUser, setSession, setLoading } = useAuthStore()

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setLoading])

  if (supabaseConfigError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-4">
            <h3 className="text-sm font-semibold text-destructive">Configuration Error</h3>
            <p className="mt-2 text-sm text-muted-foreground">{supabaseConfigError}</p>
          </div>
          <div className="space-y-2 rounded-md bg-muted/50 p-4 font-mono text-xs">
            <p className="text-muted-foreground">Create .env.local in hajri-admin/:</p>
            <div className="mt-2 space-y-1 text-foreground">
              <div>VITE_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co</div>
              <div>VITE_SUPABASE_ANON_KEY=&lt;your-anon-key&gt;</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <Refine
          dataProvider={supabaseDataProvider}
          routerProvider={routerBindings}
          resources={resources}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
            disableTelemetry: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AdminGuard><StructureExplorer /></AdminGuard>} />
            <Route path="/structure" element={<AdminGuard><StructureExplorer /></AdminGuard>} />
            <Route path="/offerings" element={<AdminGuard><OfferingsGlobal /></AdminGuard>} />
            <Route path="/faculty" element={<AdminGuard><FacultyImproved /></AdminGuard>} />
            <Route path="/settings" element={<AdminGuard><Settings /></AdminGuard>} />
            <Route path="/settings/periods" element={<AdminGuard><PeriodTemplates /></AdminGuard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <RefineKbar />
        </Refine>
      </RefineKbarProvider>
    </BrowserRouter>
  )
}

export default App
```

### Step 2: Migrate a Component to Use Refine Hooks

Example: Convert FacultyImproved to use Refine's useTable hook

**Before:**
```jsx
const [faculty, setFaculty] = useState([])
const [loading, setLoading] = useState(true)

async function loadData() {
  setLoading(true)
  const { data } = await supabase.from('faculty').select('*')
  setFaculty(data || [])
  setLoading(false)
}

useEffect(() => {
  loadData()
}, [])
```

**After:**
```jsx
import { useTable } from "@refinedev/core"

const { tableQueryResult } = useTable({
  resource: "faculty",
  filters: {
    permanent: [
      {
        field: "department_id",
        operator: "eq",
        value: filterDepartment
      }
    ]
  }
})

const faculty = tableQueryResult.data?.data || []
const loading = tableQueryResult.isLoading
```

### Step 3: Use Refine's Form Hook

Example: Convert form submission to use useForm

**Before:**
```jsx
async function handleSubmit(e) {
  e.preventDefault()
  const { error } = await supabase
    .from('faculty')
    .insert([formData])
  if (!error) loadData()
}
```

**After:**
```jsx
import { useForm } from "@refinedev/core"

const { onFinish, formLoading } = useForm({
  resource: "faculty",
  action: "create",
  redirect: "list",
})

async function handleSubmit(e) {
  e.preventDefault()
  await onFinish(formData)
}
```

### Step 4: Add Ant Design Components

Install additional Ant Design icons:
```bash
npm install @ant-design/icons
```

Example: Use Ant Design Table instead of custom cards

```jsx
import { Table } from 'antd'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'

const columns = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    sorter: true,
  },
  {
    title: 'Email',
    dataIndex: 'email',
    key: 'email',
  },
  {
    title: 'Department',
    dataIndex: ['departments', 'name'],
    key: 'department',
  },
  {
    title: 'Actions',
    key: 'actions',
    render: (_, record) => (
      <Space>
        <Button 
          icon={<EditOutlined />} 
          onClick={() => handleEdit(record)}
        />
        <Button 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleDelete(record.id)}
        />
      </Space>
    ),
  },
]

<Table 
  columns={columns} 
  dataSource={faculty} 
  loading={loading}
  rowKey="id"
/>
```

### Step 5: Add Command Palette (Cmd+K)

The `RefineKbar` component is already included. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows) to:
- Quick navigate to any page
- Search resources
- Execute actions

## Refine Features You Can Use

### 1. **useTable** - Automatic data fetching with filtering, sorting, pagination

```jsx
const { tableQueryResult, sorter, filters, pageSize } = useTable({
  resource: "faculty",
  initialSorter: [{ field: "name", order: "asc" }],
  initialFilter: [{ field: "department_id", operator: "eq", value: deptId }],
  initialPageSize: 10,
})
```

### 2. **useForm** - Form state management and submission

```jsx
const { 
  onFinish, 
  formLoading, 
  mutationResult,
  queryResult, // For edit mode
} = useForm({
  resource: "faculty",
  action: "create", // or "edit"
  id: facultyId, // For edit mode
  redirect: "list",
  onMutationSuccess: () => {
    console.log("Faculty created!")
  }
})
```

### 3. **useList** - Fetch list of resources

```jsx
const { data, isLoading } = useList({
  resource: "departments",
  filters: [{ field: "active", operator: "eq", value: true }]
})
```

### 4. **useOne** - Fetch single resource

```jsx
const { data, isLoading } = useOne({
  resource: "faculty",
  id: facultyId,
})
```

### 5. **useCreate** - Create resource

```jsx
const { mutate, isLoading } = useCreate()

mutate({
  resource: "faculty",
  values: { name: "Dr. Smith", email: "smith@edu" }
})
```

### 6. **useUpdate** - Update resource

```jsx
const { mutate, isLoading } = useUpdate()

mutate({
  resource: "faculty",
  id: facultyId,
  values: { name: "Dr. John Smith" }
})
```

### 7. **useDelete** - Delete resource

```jsx
const { mutate, isLoading } = useDelete()

mutate({
  resource: "faculty",
  id: facultyId,
})
```

## Benefits After Full Integration

1. **Less Code:** Automatic CRUD eliminates boilerplate
2. **Better UX:** Built-in loading states and error handling
3. **Consistent:** Same patterns everywhere
4. **Professional:** Ant Design components out of the box
5. **Fast:** Automatic caching and optimization
6. **Accessible:** Keyboard navigation with Cmd+K
7. **Type-Safe:** Better TypeScript support
8. **Scalable:** Easy to add new resources

## Migration Checklist

- [ ] Step 1: Update App.jsx with Refine provider
- [ ] Step 2: Test that app still loads
- [ ] Step 3: Migrate FacultyImproved to use useTable
- [ ] Step 4: Migrate OfferingsGlobal to use useTable
- [ ] Step 5: Convert forms to use useForm
- [ ] Step 6: Add Ant Design Table components
- [ ] Step 7: Add Ant Design Form components
- [ ] Step 8: Test all CRUD operations
- [ ] Step 9: Add loading skeletons
- [ ] Step 10: Test keyboard navigation

## Troubleshooting

### Issue: "Cannot read property 'data' of undefined"
**Solution:** Check that Refine provider wraps your components and dataProvider is configured.

### Issue: "Resource not found"
**Solution:** Ensure resource name in hook matches name in resources array in refineConfig.js

### Issue: Filters not working
**Solution:** Check filter operator syntax. Use "eq", "ne", "contains", etc.

### Issue: Ant Design styles not loading
**Solution:** Import Ant Design CSS in main.jsx: `import 'antd/dist/reset.css'`

## Resources

- [Refine Documentation](https://refine.dev/docs/)
- [Refine Examples](https://refine.dev/examples/)
- [Ant Design Components](https://ant.design/components/overview/)
- [Supabase Data Provider](https://refine.dev/docs/packages/documentation/data-providers/supabase/)

---

**Last Updated:** December 23, 2025
