import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, RefreshCw } from 'lucide-react'
import { TreeNode } from './TreeNode'
import { supabase } from '@/lib/supabase'
import { useStructureStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function StructureTree({ onAddRoot, collapsed = false }) {
  const { searchQuery, setSearchQuery } = useStructureStore()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDepartments()
  }, [])

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

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className={cn(
        "border-b-2 bg-gradient-to-br from-primary/5 to-background shadow-sm",
        collapsed ? "p-2" : "p-4 space-y-3"
      )}>
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && <h2 className="font-bold text-lg tracking-tight">Structure Explorer</h2>}
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 hover:bg-primary/10 transition-colors"
              onClick={loadDepartments}
              title="Refresh Structure"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-primary/10 transition-colors"
              onClick={loadDepartments}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!collapsed && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search structure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 text-sm shadow-sm border-2 focus:border-primary transition-all"
            />
          </div>
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
        ) : filteredDepartments.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground mb-2">
              {searchQuery ? 'No results found' : 'No departments yet'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Get started by adding a department'}
            </p>
            {!searchQuery && (
              <Button onClick={onAddRoot} size="default" className="shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredDepartments.map((dept) => (
              <TreeNode key={dept.id} node={dept} level={0} collapsed={collapsed} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!collapsed && !loading && filteredDepartments.length > 0 && (
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
