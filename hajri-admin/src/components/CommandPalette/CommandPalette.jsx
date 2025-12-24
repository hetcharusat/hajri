import { useEffect, useState } from 'react'
import { Command, Search, Building2, GraduationCap, Calendar, Grid3x3, Target, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useStructureStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const NODE_ICONS = {
  department: Building2,
  branch: GraduationCap,
  semester: Calendar,
  class: Grid3x3,
  batch: Target,
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const { setSelectedNode, recentNodes } = useStructureStore()

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (open && query.length > 1) {
      searchAll()
    } else {
      setResults([])
    }
  }, [query, open])

  const searchAll = async () => {
    setLoading(true)
    try {
      const q = query.toLowerCase()
      const allResults = []

      // Search departments
      const { data: depts } = await supabase
        .from('departments')
        .select('id, name')
        .ilike('name', `%${q}%`)
        .limit(5)
      
      depts?.forEach((d) => {
        allResults.push({
          id: d.id,
          type: 'department',
          name: d.name,
          parentPath: [],
        })
      })

      // Search branches
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name, abbreviation, department_id, departments(name)')
        .or(`name.ilike.%${q}%,abbreviation.ilike.%${q}%`)
        .limit(5)
      
      branches?.forEach((b) => {
        allResults.push({
          id: b.id,
          type: 'branch',
          name: b.name,
          meta: b.abbreviation,
          parentPath: b.departments ? [{
            id: b.department_id,
            type: 'department',
            name: b.departments.name,
            parentPath: [],
          }] : [],
        })
      })

      // Search semesters
      const { data: semesters } = await supabase
        .from('semesters')
        .select('id, semester_number, branch_id, branches(name, abbreviation, department_id, departments(name))')
        .limit(10)
      
      semesters?.forEach((s) => {
        const semName = `Semester ${s.semester_number}`
        if (semName.toLowerCase().includes(q) || s.branches?.name.toLowerCase().includes(q)) {
          allResults.push({
            id: s.id,
            type: 'semester',
            name: semName,
            meta: s.branches?.name,
            parentPath: s.branches ? [
              {
                id: s.branches.department_id,
                type: 'department',
                name: s.branches.departments?.name || '',
                parentPath: [],
              },
              {
                id: s.branch_id,
                type: 'branch',
                name: s.branches.name,
                meta: s.branches.abbreviation,
                parentPath: [],
              }
            ] : [],
          })
        }
      })

      setResults(allResults.slice(0, 10))
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (node) => {
    setSelectedNode(node)
    setOpen(false)
    setQuery('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="fixed left-1/2 top-20 -translate-x-1/2 w-full max-w-2xl px-4" onClick={(e) => e.stopPropagation()}>
        <div className="bg-card border-2 border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b-2 border-border px-4 py-3 bg-gradient-to-r from-primary/5 to-background">
            <Search className="h-5 w-5 text-muted-foreground mr-3" />
            <Input
              placeholder="Search departments, branches, semesters..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 shadow-none text-base"
              autoFocus
            />
            <kbd className="ml-auto pointer-events-none hidden sm:inline-flex h-6 select-none items-center gap-1 rounded-md border-2 bg-muted px-2 font-mono text-xs font-bold text-muted-foreground shadow-sm">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto p-2">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {query.length <= 1 && recentNodes.length > 0 && (
              <div>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
                  <Clock className="h-3.5 w-3.5" />
                  Recent
                </div>
                {recentNodes.slice(0, 5).map((node) => {
                  if (!node) return null
                  const Icon = NODE_ICONS[node.type]
                  return (
                    <button
                      key={`${node.type}-${node.id}`}
                      onClick={() => handleSelect(node)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary hover:shadow-sm text-left group transition-all border-2 border-transparent hover:border-primary/10"
                    >
                      <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 group-hover:scale-110 transition-transform">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate group-hover:text-primary transition-colors">{node.name}</div>
                        {node.meta && (
                          <div className="text-xs text-muted-foreground">{node.meta}</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">{node.type}</div>
                    </button>
                  )
                })}
              </div>
            )}

            {query.length > 1 && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="text-lg font-semibold text-muted-foreground mb-2">
                      No results found
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Try searching with different keywords
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {results.map((node) => {
                      const Icon = NODE_ICONS[node.type]
                      return (
                        <button
                          key={`${node.type}-${node.id}`}
                          onClick={() => handleSelect(node)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary hover:shadow-sm text-left group transition-all border-2 border-transparent hover:border-primary/10"
                        >
                          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 group-hover:scale-110 transition-transform">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate group-hover:text-primary transition-colors">{node.name}</div>
                            {node.meta && (
                              <div className="text-xs text-muted-foreground">{node.meta}</div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">{node.type}</div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t-2 border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border-2 bg-background px-2 font-mono font-bold shadow-sm">
                  ↵
                </kbd>
                <span className="font-medium">select</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border-2 bg-background px-2 font-mono font-bold shadow-sm">
                  ESC
                </kbd>
                <span className="font-medium">close</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Command className="h-3.5 w-3.5" />
              <span>Quick Search</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
