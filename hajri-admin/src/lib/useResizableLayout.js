import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Manages resizable content areas (used in pages that want custom layouts)
export const useResizableLayout = create(
  persist(
    (set) => ({
      // Store layout configs per page: { [pageKey]: { leftWidth: 300, rightWidth: 400 } }
      layouts: {},
      
      setLayout: (pageKey, config) =>
        set((state) => ({
          layouts: {
            ...state.layouts,
            [pageKey]: { ...(state.layouts[pageKey] || {}), ...config },
          },
        })),
      
      getLayout: (pageKey) => (state) => state.layouts[pageKey] || {},
      
      resetLayout: (pageKey) =>
        set((state) => {
          const { [pageKey]: _, ...rest } = state.layouts
          return { layouts: rest }
        }),
    }),
    {
      name: 'hajri-resizable-layout',
      version: 1,
    }
  )
)
