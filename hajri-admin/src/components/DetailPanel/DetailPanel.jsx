import { useState, useEffect } from 'react'
import { BreadcrumbTrail } from './BreadcrumbTrail'
import { EntityCard } from './EntityCard'
import { ChildrenGrid } from './ChildrenGrid'
import { EmptyState } from './EmptyState'
import { useStructureStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export function DetailPanel({ onEdit, onDelete, onAddChild }) {
  const { selectedNode, setSelectedNode } = useStructureStore()
  const [stats, setStats] = useState([])
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedNode) {
      loadNodeDetails()
    }
  }, [selectedNode])

  const loadNodeDetails = async () => {
    if (!selectedNode) return
    
    setLoading(true)
    try {
      const nodeStats = []
      let childData = []

      switch (selectedNode.type) {
        case 'department':
          const { count: branchCount } = await supabase
            .from('branches')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', selectedNode.id)
          
          nodeStats.push({ label: 'Branches', value: branchCount || 0 })

          const { data: branches } = await supabase
            .from('branches')
            .select('id, name, abbreviation')
            .eq('department_id', selectedNode.id)
            .order('name')
          
          childData = branches?.map((b) => ({
            id: b.id,
            name: b.name,
            meta: b.abbreviation,
            onClick: () => setSelectedNode({
              id: b.id,
              type: 'branch',
              name: b.name,
              meta: b.abbreviation,
              parentPath: [...selectedNode.parentPath, selectedNode],
            })
          })) || []
          break

        case 'branch':
          const { count: semesterCount } = await supabase
            .from('semesters')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', selectedNode.id)
          
          nodeStats.push({ label: 'Semesters', value: semesterCount || 0 })

          const { data: semesters } = await supabase
            .from('semesters')
            .select('id, semester_number, start_date, end_date')
            .eq('branch_id', selectedNode.id)
            .order('semester_number')
          
          childData = semesters?.map((s) => ({
            id: s.id,
            name: `Semester ${s.semester_number}`,
            meta: s.start_date ? new Date(s.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null,
            onClick: () => setSelectedNode({
              id: s.id,
              type: 'semester',
              name: `Semester ${s.semester_number}`,
              meta: null,
              parentPath: [...selectedNode.parentPath, selectedNode],
            })
          })) || []
          break

        case 'semester':
          const { count: classCount } = await supabase
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('semester_id', selectedNode.id)
          
          const { count: semSubjectCount } = await supabase
            .from('subjects')
            .select('*', { count: 'exact', head: true })
            .eq('semester_id', selectedNode.id)
          
          nodeStats.push(
            { label: 'Classes', value: classCount || 0 },
            { label: 'Subjects', value: semSubjectCount || 0 }
          )

          const { data: classes } = await supabase
            .from('classes')
            .select('id, class_number')
            .eq('semester_id', selectedNode.id)
            .order('class_number')
          
          childData = classes?.map((c) => ({
            id: c.id,
            name: `Class ${c.class_number}`,
            meta: null,
            onClick: () => setSelectedNode({
              id: c.id,
              type: 'class',
              name: `Class ${c.class_number}`,
              meta: null,
              parentPath: [...selectedNode.parentPath, selectedNode],
            })
          })) || []
          break

        case 'class':
          const { count: batchCount } = await supabase
            .from('batches')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', selectedNode.id)
          
          nodeStats.push({ label: 'Batches', value: batchCount || 0 })

          const { data: batches } = await supabase
            .from('batches')
            .select('id, batch_letter')
            .eq('class_id', selectedNode.id)
            .order('batch_letter')
          
          childData = batches?.map((b) => ({
            id: b.id,
            name: `Batch ${b.batch_letter}`,
            meta: null,
            onClick: () => setSelectedNode({
              id: b.id,
              type: 'batch',
              name: `Batch ${b.batch_letter}`,
              meta: null,
              parentPath: [...selectedNode.parentPath, selectedNode],
            })
          })) || []
          break

        case 'batch':
          // Batches are leaf nodes - show student count when implemented
          nodeStats.push({ label: 'Students', value: 0 })
          break

        case 'subject':
          // Subject leaf node
          if (selectedNode.code) nodeStats.push({ label: 'Code', value: selectedNode.code })
          if (selectedNode.credits != null) nodeStats.push({ label: 'Credits', value: selectedNode.credits })
          break
      }

      setStats(nodeStats)
      setChildren(childData)
    } catch (error) {
      console.error('Failed to load node details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!selectedNode) {
    return <EmptyState />
  }

  const getChildTitle = () => {
    switch (selectedNode.type) {
      case 'department': return 'Branches'
      case 'branch': return 'Semesters'
      case 'semester': return 'Classes'
      case 'class': return 'Batches'
      default: return 'Items'
    }
  }

  const getEmptyMessage = () => {
    switch (selectedNode.type) {
      case 'department': return 'No branches yet. Add your first branch to get started.'
      case 'branch': return 'No semesters yet. Add semesters (1-8) to organize classes.'
      case 'semester': return 'No classes yet. Add classes and subjects for this semester.'
      case 'class': return 'No batches yet. Add batches (A, B, C...) for students.'
      case 'batch': return 'No students assigned yet.'
      default: return 'No items found.'
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <BreadcrumbTrail node={selectedNode} />
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <EntityCard
            node={selectedNode}
            stats={stats}
            onEdit={() => onEdit(selectedNode)}
            onDelete={() => onDelete(selectedNode)}
          />

          {!['batch', 'subject'].includes(selectedNode.type) && (
            <ChildrenGrid
              title={getChildTitle()}
              children={children}
              onAddChild={() => onAddChild(selectedNode)}
              emptyMessage={getEmptyMessage()}
            />
          )}
        </>
      )}
    </div>
  )
}
