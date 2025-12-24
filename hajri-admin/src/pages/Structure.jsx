import { useState } from 'react'
import { StructureTree } from '@/components/StructureTree/StructureTree'
import { DetailPanel } from '@/components/DetailPanel/DetailPanel'
import { EntityForm } from '@/components/EntityForm/EntityForm'
import { supabase } from '@/lib/supabase'

export default function Structure() {
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [formNode, setFormNode] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleAddRoot = () => {
    setFormNode({ type: 'root' })
    setFormMode('add')
    setFormOpen(true)
  }

  const handleAddChild = (parentNode) => {
    setFormNode(parentNode)
    setFormMode('add')
    setFormOpen(true)
  }

  const handleEdit = (node) => {
    setFormNode(node)
    setFormMode('edit')
    setFormOpen(true)
  }

  const getDeleteConfirmMessage = (node) => {
    const cascadeWarnings = {
      department:
        'This will delete all branches, semesters, classes, and batches under this department.',
      branch: 'This will delete all semesters, classes, and batches under this branch.',
      semester: 'This will delete all classes and batches under this semester.',
      class: 'This will delete all batches under this class.',
    }

    const warning = cascadeWarnings[node.type] || ''
    return `Are you sure you want to delete this ${node.type}?\n\n${warning}\n\nThis action cannot be undone.`
  }

  const handleDelete = async (node) => {
    const confirmMsg = getDeleteConfirmMessage(node)
    if (!confirm(confirmMsg)) return

    try {
      let table = `${node.type}s`
      if (node.type === 'class') table = 'classes'
      if (node.type === 'branch') table = 'branches'

      await supabase.from(table).delete().eq('id', node.id).throwOnError()

      setRefreshKey((k) => k + 1)
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const handleFormSuccess = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-7rem)]">
      <div className="col-span-4 border border-border rounded-lg overflow-hidden">
        <StructureTree key={refreshKey} onAddRoot={handleAddRoot} />
      </div>
      <div className="col-span-8 border border-border rounded-lg overflow-hidden bg-card">
        <DetailPanel
          key={refreshKey}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAddChild={handleAddChild}
        />
      </div>

      <EntityForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        node={formNode}
        mode={formMode}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}
