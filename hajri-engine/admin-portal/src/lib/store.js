import { create } from 'zustand'

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
