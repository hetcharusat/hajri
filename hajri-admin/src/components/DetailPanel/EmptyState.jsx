import { Inbox } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-muted/20 to-background">
      <div className="text-center max-w-md px-8 py-12 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-background/50 backdrop-blur-sm shadow-xl">
        <div className="inline-flex p-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 mb-6 shadow-inner">
          <Inbox className="h-16 w-16 text-primary/60" />
        </div>
        <h3 className="text-2xl font-bold mb-3">No Selection</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Select an item from the tree on the left to view and manage its details
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 bg-muted/30 px-4 py-2 rounded-lg">
          <span>Quick tip:</span>
          <kbd className="px-2 py-1 bg-background rounded text-xs font-mono shadow-sm border">Ctrl+K</kbd>
          <span>to search</span>
        </div>
      </div>
    </div>
  )
}
