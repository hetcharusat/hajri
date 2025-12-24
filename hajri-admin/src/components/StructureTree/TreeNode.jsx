import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Building2, GraduationCap, Calendar, Grid3x3, Target, User, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useStructureStore } from '@/lib/store'

const NODE_ICONS = {
  department: Building2,
  branch: GraduationCap,
  semester: Calendar,
  class: Grid3x3,
  batch: Target,
  student: User,
  subject: BookOpen,
}

const NODE_COLORS = {
  department: 'text-blue-500',
  branch: 'text-purple-500',
  semester: 'text-green-500',
  class: 'text-orange-500',
  batch: 'text-pink-500',
  student: 'text-cyan-500',
  subject: 'text-indigo-500',
}

export function TreeNode({ node, level = 0, collapsed = false }) {
  const { selectedNode, setSelectedNode, expandedNodes, toggleExpanded } = useStructureStore()
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(false)
  const [childCount, setChildCount] = useState(0)

  const isExpanded = expandedNodes.has(node.id)
  const isSelected = selectedNode?.id === node.id && selectedNode?.type === node.type
  const Icon = NODE_ICONS[node.type]
  const hasChildren = !['student', 'subject', 'batch'].includes(node.type) // batches, students and subjects are leaf nodes

  useEffect(() => {
    if (isExpanded && children.length === 0 && hasChildren) {
      loadChildren()
    }
  }, [isExpanded])

  useEffect(() => {
    if (hasChildren) {
      loadChildCount()
    }
  }, [])

  const loadChildren = async () => {
    setLoading(true)
    try {
      let data = []
      
      switch (node.type) {
        case 'department':
          const { data: branches } = await supabase
            .from('branches')
            .select('id, name, abbreviation')
            .eq('department_id', node.id)
            .order('name')
          data = branches?.map((b) => ({
            id: b.id,
            type: 'branch',
            name: b.name,
            meta: b.abbreviation,
            parentPath: [...node.parentPath, node],
          })) || []
          break

        case 'branch':
          const { data: semesters } = await supabase
            .from('semesters')
            .select('id, semester_number, start_date, end_date')
            .eq('branch_id', node.id)
            .order('semester_number')
          
          data = semesters?.map((s) => ({
            id: s.id,
            type: 'semester',
            name: `Semester ${s.semester_number}`,
            meta: s.start_date && s.end_date 
              ? `${new Date(s.start_date).toLocaleDateString('en-US', { month: 'short' })} - ${new Date(s.end_date).toLocaleDateString('en-US', { month: 'short' })}`
              : null,
            parentPath: [...node.parentPath, node],
          })) || []
          break

        case 'semester':
          // Try to query classes with name column first
          let classesData = []
          try {
            const classesRes = await supabase
              .from('classes')
              .select('id, class_number, name')
              .eq('semester_id', node.id)
              .order('class_number')
            
            if (classesRes.error) throw classesRes.error
            classesData = classesRes.data || []
          } catch (err) {
            // If name column doesn't exist, query without it
            const classesRes = await supabase
              .from('classes')
              .select('id, class_number')
              .eq('semester_id', node.id)
              .order('class_number')
            
            if (classesRes.error) throw classesRes.error
            classesData = classesRes.data || []
          }
          
          const [subjectsRes] = await Promise.all([
            supabase
              .from('subjects')
              .select('id, code, name, credits, type')
              .eq('semester_id', node.id)
              .order('code')
          ])
          
          const classData = classesData.map((c) => ({
            id: c.id,
            type: 'class',
            name: c.name || `Class ${c.class_number}`,
            meta: null,
            parentPath: [...node.parentPath, node],
          }))
          
          const subjectData = subjectsRes.data?.map((s) => ({
            id: s.id,
            type: 'subject',
            name: s.name,
            code: s.code,
            credits: s.credits,
            subject_type: s.type,
            semester_id: node.id,
            meta: `${s.code} • ${s.credits} cr`,
            parentPath: [...node.parentPath, node],
          })) || []
          
          data = [...classData, ...subjectData]
          break

        case 'class':
          // Try to query batches with name column first
          let batchesData = []
          try {
            const batchesRes = await supabase
              .from('batches')
              .select('id, batch_letter, name')
              .eq('class_id', node.id)
              .order('batch_letter')
            
            if (batchesRes.error) throw batchesRes.error
            batchesData = batchesRes.data || []
          } catch (err) {
            // If name column doesn't exist, query without it
            const batchesRes = await supabase
              .from('batches')
              .select('id, batch_letter')
              .eq('class_id', node.id)
              .order('batch_letter')
            
            if (batchesRes.error) throw batchesRes.error
            batchesData = batchesRes.data || []
          }
          
          data = batchesData.map((b) => ({
            id: b.id,
            type: 'batch',
            name: b.name || `Batch ${b.batch_letter}`,
            meta: null,
            parentPath: [...node.parentPath, node],
          }))
          break

      }

      setChildren(data)
    } catch (error) {
      console.error('Failed to load children:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadChildCount = async () => {
    try {
      let count = 0
      
      switch (node.type) {
        case 'department':
          const { count: branchCount } = await supabase
            .from('branches')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', node.id)
          count = branchCount || 0
          break

        case 'branch':
          const { count: semCount } = await supabase
            .from('semesters')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', node.id)
          count = semCount || 0
          break

        case 'semester':
          const [{ count: classCount }, { count: subjectCount }] = await Promise.all([
            supabase
              .from('classes')
              .select('*', { count: 'exact', head: true })
              .eq('semester_id', node.id),
            supabase
              .from('subjects')
              .select('*', { count: 'exact', head: true })
              .eq('semester_id', node.id)
          ])
          count = (classCount || 0) + (subjectCount || 0)
          break

        case 'class':
          const { count: batchCount } = await supabase
            .from('batches')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', node.id)
          count = batchCount || 0
          break

      }

      setChildCount(count)
    } catch (error) {
      console.error('Failed to load child count:', error)
    }
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    toggleExpanded(node.id)
  }

  const handleSelect = () => {
    setSelectedNode(node)
  }

  return (
    <div>
      <button
        onClick={handleSelect}
        className={cn(
          'w-full flex items-center transition-all duration-200 group',
          'hover:bg-secondary/80 hover:shadow-sm rounded-lg',
          collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5',
          isSelected && 'bg-primary/10 shadow-md',
          !collapsed && isSelected && 'border-l-4 border-primary',
          collapsed && isSelected && 'bg-primary/20',
          level > 0 && 'text-sm',
          level > 2 && 'text-xs'
        )}
        style={{ paddingLeft: collapsed ? undefined : `${level * 20 + 12}px` }}
        title={collapsed ? node.name : undefined}
      >
        {!collapsed && hasChildren && (
          <div
            onClick={handleToggle}
            className="p-1 hover:bg-secondary rounded transition-colors flex-shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
        
        {!collapsed && !hasChildren && <div className="w-6" />}

        <div className={cn(
          'flex items-center justify-center flex-shrink-0 transition-all duration-200',
          collapsed ? 'w-7 h-7' : (node.type === 'student' || node.type === 'subject') ? 'w-4 h-4' : 'w-5 h-5',
          isSelected && !collapsed && 'scale-110'
        )}>
          <Icon
            className={cn(
              'w-full h-full transition-all duration-200',
              NODE_COLORS[node.type],
              isSelected && 'opacity-100 drop-shadow-sm',
              !isSelected && 'opacity-70 group-hover:opacity-100'
            )}
          />
        </div>
        
        {!collapsed && (
          <>
            <span className={cn(
              'flex-1 text-left truncate transition-all',
              isSelected ? 'font-semibold' : 'font-medium',
              (node.type === 'student' || node.type === 'subject') && 'text-sm'
            )}>
              {node.name}
            </span>

            {node.meta && (
              <span className={cn(
                'text-xs font-mono truncate',
                isSelected ? 'text-muted-foreground font-medium' : 'text-muted-foreground/70'
              )}>
                {node.meta}
              </span>
            )}

            {hasChildren && childCount > 0 && (
              <span className={cn(
                'ml-auto text-xs font-semibold px-2 py-0.5 rounded-full transition-all',
                isSelected
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary text-muted-foreground group-hover:bg-secondary/80 group-hover:text-foreground'
              )}>
                {childCount}
              </span>
            )}
          </>
        )}
      </button>

      {isExpanded && (
        <div className="relative">
          {loading ? (
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
              style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}
            >
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading...
            </div>
          ) : children.length === 0 ? (
            <div
              className="px-3 py-2 text-xs text-muted-foreground italic"
              style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}
            >
              No items
            </div>
          ) : (
            children.map((child) => (
              <TreeNode key={child.id} node={child} level={level + 1} collapsed={collapsed} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
