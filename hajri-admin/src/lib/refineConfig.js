import { Refine } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import routerBindings from "@refinedev/react-router-v6";
import dataProvider from "@refinedev/supabase";
import { supabase } from './supabase'

/**
 * Refine Data Provider Configuration for Supabase
 * 
 * This creates the data provider that Refine will use to interact with Supabase.
 * It automatically generates CRUD operations for all your tables.
 */
export const supabaseDataProvider = dataProvider(supabase);

/**
 * Refine Resources Configuration
 * 
 * Define all your database tables as "resources" that Refine will manage.
 * Each resource gets automatic CRUD pages and operations.
 */
export const resources = [
  {
    name: "departments",
    list: "/departments",
    create: "/departments/create",
    edit: "/departments/edit/:id",
    show: "/departments/show/:id",
    meta: {
      label: "Departments",
    },
  },
  {
    name: "branches",
    list: "/branches",
    create: "/branches/create",
    edit: "/branches/edit/:id",
    show: "/branches/show/:id",
    meta: {
      label: "Branches",
    },
  },
  {
    name: "semesters",
    list: "/semesters",
    create: "/semesters/create",
    edit: "/semesters/edit/:id",
    show: "/semesters/show/:id",
    meta: {
      label: "Semesters",
    },
  },
  {
    name: "classes",
    list: "/classes",
    create: "/classes/create",
    edit: "/classes/edit/:id",
    show: "/classes/show/:id",
    meta: {
      label: "Classes",
    },
  },
  {
    name: "batches",
    list: "/batches",
    create: "/batches/create",
    edit: "/batches/edit/:id",
    show: "/batches/show/:id",
    meta: {
      label: "Batches",
    },
  },
  {
    name: "subjects",
    list: "/subjects",
    create: "/subjects/create",
    edit: "/subjects/edit/:id",
    show: "/subjects/show/:id",
    meta: {
      label: "Subjects",
    },
  },
  {
    name: "faculty",
    list: "/faculty",
    create: "/faculty/create",
    edit: "/faculty/edit/:id",
    show: "/faculty/show/:id",
    meta: {
      label: "Faculty",
    },
  },
  {
    name: "rooms",
    list: "/rooms",
    create: "/rooms/create",
    edit: "/rooms/edit/:id",
    show: "/rooms/show/:id",
    meta: {
      label: "Rooms",
    },
  },
  {
    name: "course_offerings",
    list: "/offerings",
    create: "/offerings/create",
    edit: "/offerings/edit/:id",
    show: "/offerings/show/:id",
    meta: {
      label: "Course Offerings",
    },
  },
  {
    name: "timetable_events",
    list: "/timetable",
    create: "/timetable/create",
    edit: "/timetable/edit/:id",
    show: "/timetable/show/:id",
    meta: {
      label: "Timetable Events",
    },
  },
  {
    name: "period_templates",
    list: "/settings/periods",
    create: "/settings/periods/create",
    edit: "/settings/periods/edit/:id",
    meta: {
      label: "Period Templates",
    },
  },
];

/**
 * Example: How to wrap your App with Refine
 * 
 * In App.jsx, import this config and wrap your routes:
 * 
 * import { Refine } from "@refinedev/core";
 * import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
 * import routerBindings from "@refinedev/react-router-v6";
 * import { supabaseDataProvider, resources } from './lib/refineConfig';
 * import { BrowserRouter } from 'react-router-dom';
 * 
 * function App() {
 *   return (
 *     <BrowserRouter>
 *       <RefineKbarProvider>
 *         <Refine
 *           dataProvider={supabaseDataProvider}
 *           routerProvider={routerBindings}
 *           resources={resources}
 *           options={{
 *             syncWithLocation: true,
 *             warnWhenUnsavedChanges: true,
 *           }}
 *         >
 *           <Routes>
 *             {/* Your routes here *\/}
 *           </Routes>
 *           <RefineKbar />
 *         </Refine>
 *       </RefineKbarProvider>
 *     </BrowserRouter>
 *   );
 * }
 */

/**
 * Example: Using Refine Hooks in Components
 * 
 * // List page with automatic data fetching
 * import { useTable } from "@refinedev/core";
 * 
 * function FacultyList() {
 *   const { tableQueryResult } = useTable({
 *     resource: "faculty",
 *   });
 * 
 *   const faculty = tableQueryResult.data?.data || [];
 * 
 *   return (
 *     <div>
 *       {faculty.map(f => (
 *         <div key={f.id}>{f.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * 
 * // Form with automatic validation and submission
 * import { useForm } from "@refinedev/core";
 * 
 * function FacultyCreate() {
 *   const { onFinish, formLoading } = useForm({
 *     resource: "faculty",
 *     action: "create",
 *   });
 * 
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       const formData = new FormData(e.target);
 *       onFinish(Object.fromEntries(formData));
 *     }}>
 *       <input name="name" placeholder="Name" />
 *       <input name="email" placeholder="Email" />
 *       <button type="submit" disabled={formLoading}>
 *         {formLoading ? "Saving..." : "Save"}
 *       </button>
 *     </form>
 *   );
 * }
 */

/**
 * Benefits of using Refine:
 * 
 * 1. Automatic CRUD Operations - No need to write Supabase queries manually
 * 2. Built-in Loading States - Automatic loading indicators
 * 3. Error Handling - Consistent error handling across all pages
 * 4. Optimistic Updates - UI updates before server confirmation
 * 5. Caching - Automatic data caching and invalidation
 * 6. Search & Filters - Built-in support for complex queries
 * 7. Pagination - Automatic pagination handling
 * 8. Sorting - Built-in sorting support
 * 9. Command Palette (Kbar) - Quick navigation with Cmd+K
 * 10. Consistent API - Same hooks and patterns everywhere
 */
