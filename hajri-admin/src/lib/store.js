import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, session: null })
}))

export const useDepartmentStore = create((set) => ({
  departments: [],
  loading: false,
  setDepartments: (departments) => set({ departments }),
  setLoading: (loading) => set({ loading }),
  addDepartment: (dept) => set((state) => ({ 
    departments: [...state.departments, dept] 
  })),
  updateDepartment: (id, updates) => set((state) => ({
    departments: state.departments.map(d => d.id === id ? { ...d, ...updates } : d)
  })),
  deleteDepartment: (id) => set((state) => ({
    departments: state.departments.filter(d => d.id !== id)
  }))
}))

export const useScopeStore = create(
  persist(
    (set) => ({
      departmentId: '',
      branchId: '',
      semesterId: '',
      classId: '',
      batchId: '',
      level: '', // department | branch | semester | class | batch

      setScopeFromNode: (node) =>
        set(() => {
          if (!node) {
            return {
              departmentId: '',
              branchId: '',
              semesterId: '',
              classId: '',
              batchId: '',
              level: '',
            }
          }

          const chain = Array.isArray(node.parentPath) ? [...node.parentPath, node] : [node]
          const findId = (type) => {
            const found = [...chain].reverse().find((n) => n?.type === type)
            return found?.id || ''
          }

          const departmentId = findId('department')
          const branchId = findId('branch')
          const semesterId = node.type === 'subject' ? (node.semester_id || findId('semester')) : findId('semester')
          const classId = findId('class')
          const batchId = findId('batch')

          const normalizedType =
            node.type === 'subject'
              ? 'semester'
              : node.type === 'student'
                ? 'batch'
                : node.type
          const levelOrder = ['department', 'branch', 'semester', 'class', 'batch']
          const level = levelOrder.includes(normalizedType) ? normalizedType : ''

          return {
            departmentId,
            branchId: levelOrder.indexOf(level) >= 1 ? branchId : '',
            semesterId: levelOrder.indexOf(level) >= 2 ? semesterId : '',
            classId: levelOrder.indexOf(level) >= 3 ? classId : '',
            batchId: levelOrder.indexOf(level) >= 4 ? batchId : '',
            level,
          }
        }),

      clear: () =>
        set(() => ({
          departmentId: '',
          branchId: '',
          semesterId: '',
          classId: '',
          batchId: '',
          level: '',
        })),
    }),
    {
      name: 'hajri-admin-scope',
      version: 2,
    }
  )
)

// Structure Explorer selection store (no persistence to avoid stale state)
export const useStructureStore = create((set) => ({
  selectedNode: null, // { type, id, name, parentPath }
  expandedNodes: new Set(), // Always starts empty - tree collapsed by default
  searchQuery: '',
  recentNodes: [], // last 5 visited

  setSelectedNode: (node) =>
    set((state) => {
      const recent = [node, ...state.recentNodes.filter((n) => n?.id !== node?.id)].slice(0, 5)
      return { selectedNode: node, recentNodes: recent }
    }),

  selectNodeAndReveal: (node) =>
    set((state) => {
      const expanded = new Set(state.expandedNodes)
      const chain = Array.isArray(node?.parentPath) ? node.parentPath : []
      for (const ancestor of chain) {
        if (ancestor?.id) expanded.add(ancestor.id)
      }

      const recent = [node, ...state.recentNodes.filter((n) => n?.id !== node?.id)].slice(0, 5)
      return { selectedNode: node, expandedNodes: expanded, recentNodes: recent }
    }),

  toggleExpanded: (nodeId) =>
    set((state) => {
      const expanded = new Set(state.expandedNodes)
      if (expanded.has(nodeId)) {
        expanded.delete(nodeId)
      } else {
        expanded.add(nodeId)
      }
      return { expandedNodes: expanded }
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  clearSelection: () => set({ selectedNode: null }),
}))
