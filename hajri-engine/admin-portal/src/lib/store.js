import { create } from 'zustand'

// Auth store for user state
export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, session: null })
}))

export const useAppStore = create((set, get) => ({
  // Health status
  health: null,
  setHealth: (health) => set({ health }),

  // Current tab
  currentTab: 'dashboard',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  // Sidebar collapsed state
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Global stats cache
  stats: { batches: 0, loading: true },
  setStats: (stats) => set({ stats }),

  // Batches cache
  batches: [],
  batchesLoading: true,
  setBatches: (batches) => set({ batches, batchesLoading: false }),
}))
