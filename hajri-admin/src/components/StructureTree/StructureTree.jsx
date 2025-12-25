import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Search, Plus } from 'lucide-react'
import { TreeNode } from './TreeNode'
import { supabase } from '@/lib/supabase'
import { useStructureStore, useCommandPaletteStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function StructureTree({ onAddRoot, onAddChild, onEdit, onDelete, collapsed = false }) {
  const { refreshKey } = useStructureStore()
  const { open: openCommandPalette } = useCommandPaletteStore()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDepartments()
  }, [refreshKey])

  const loadDepartments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, created_at')
        .order('name')

      if (error) throw error

      setDepartments(
        data?.map((d) => ({
          id: d.id,
          type: 'department',
          name: d.name,
          meta: null,
          parentPath: [],
        })) || []
      )
    } catch (error) {
      console.error('Failed to load departments:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className={cn(
        "border-b-2 bg-gradient-to-br from-primary/5 to-background shadow-sm",
        collapsed ? "p-2" : "p-3"
      )}>
        {!collapsed && (
          <button
            type="button"
            onClick={openCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-border bg-background hover:bg-secondary hover:border-primary/30 transition-all text-left group"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">Search all...</span>
            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              Ctrl+K
            </kbd>
          </button>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-10 hover:bg-primary/10 transition-colors"
            onClick={openCommandPalette}
            title="Search (Ctrl+K)"
          >
            <Search className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Tree */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        collapsed ? "p-1" : "p-3"
      )}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            {!collapsed && <p className="text-sm text-muted-foreground font-medium">Loading structure...</p>}
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground mb-2">
              No departments yet
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by adding a department
            </p>
            <Button onClick={onAddRoot} size="default" className="shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {departments.map((dept) => (
              <TreeNode key={dept.id} node={dept} level={0} collapsed={collapsed} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!collapsed && !loading && departments.length > 0 && (
        <div className="p-3 border-t-2 bg-muted/20">
          <Button onClick={onAddRoot} variant="outline" size="default" className="w-full font-medium hover:bg-primary/5 hover:border-primary/50 transition-all">
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        </div>
      )}
    </div>
  )
}
