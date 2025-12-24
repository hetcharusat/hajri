import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function ChildrenGrid({ title, children, onAddChild, emptyMessage }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        {onAddChild && (
          <Button onClick={onAddChild} size="sm" className="shadow-md hover:shadow-lg transition-all">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        )}
      </div>

      {children.length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed border-muted-foreground/30 bg-muted/20">
          <p className="text-muted-foreground text-sm font-medium">{emptyMessage}</p>
          {onAddChild && (
            <Button onClick={onAddChild} variant="outline" size="sm" className="mt-4 shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Add First Item
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {children.map((child) => (
            <Card
              key={child.id}
              className="p-5 hover:border-primary hover:shadow-lg cursor-pointer transition-all hover:scale-105 border-2 group"
              onClick={() => child.onClick?.()}
            >
              <div className="font-semibold text-sm group-hover:text-primary transition-colors">{child.name}</div>
              {child.meta && (
                <div className="text-xs text-muted-foreground mt-2 font-medium">{child.meta}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
