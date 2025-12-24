import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { supabase, supabaseConfigError } from "./lib/supabase";
import { useAuthStore } from "./lib/store";

import AdminGuard from "./components/AdminGuard";
import { AppShell } from "./components/AppShell";

// Pages
import Login from "./pages/Login.jsx";
import Subjects from "./pages/Subjects.jsx";
import FacultyImproved from "./pages/FacultyImproved.jsx";
import Rooms from "./pages/Rooms.jsx";
import OfferingsNew from "./pages/OfferingsNew.jsx";
import TimetableNew from "./pages/TimetableNew.jsx";
import PeriodTemplates from "./pages/PeriodTemplates.jsx";
import Settings from "./pages/Settings.jsx";
import Overview from "./pages/Overview.jsx";

function App() {
  const { loading, setUser, setSession, setLoading } = useAuthStore();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession, setLoading]);

  if (supabaseConfigError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
            <div className="text-sm font-semibold text-destructive">Configuration Error</div>
            <div className="mt-2 text-sm text-muted-foreground">{supabaseConfigError}</div>
          </div>
          <div className="mt-4 rounded-md border border-border bg-muted/20 p-4 font-mono text-xs text-muted-foreground">
            <div>Create .env.local in hajri-admin/:</div>
            <div className="mt-2 text-foreground">
              <div>VITE_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co</div>
              <div>VITE_SUPABASE_ANON_KEY=&lt;your-anon-key&gt;</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="mt-2 text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <AdminGuard>
              <Outlet />
            </AdminGuard>
          }
        >
          <Route index element={<Navigate to="/app/overview" replace />} />

          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="faculty" element={<FacultyImproved />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="period-templates" element={<PeriodTemplates />} />
            <Route path="assignments" element={<OfferingsNew embedded={true} />} />
            <Route path="timetable" element={<TimetableNew />} />
          </Route>

            {/* Back-compat */}
            <Route path="/period-templates" element={<Navigate to="/app/period-templates" replace />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/app/overview" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
