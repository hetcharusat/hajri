import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BreadcrumbTrail({ node }) {
  if (!node) return null

  const path = [...node.parentPath, node]

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 px-1">
      <div className="p-1.5 rounded-md bg-primary/10">
        <Home className="h-4 w-4 text-primary" />
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className={cn(
            "transition-colors hover:text-primary cursor-pointer px-2 py-1 rounded-md hover:bg-primary/5",
            index === path.length - 1 && 'text-foreground font-semibold bg-primary/10'
          )}>
            {item.name}
          </span>
          {index < path.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
        </div>
      ))}
    </div>
  )
}
