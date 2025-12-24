import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function ResizablePanel({ 
  leftContent, 
  rightContent, 
  defaultLeftWidth = 320,
  minLeftWidth = 200,
  maxLeftWidth = 600,
  storageKey,
  className 
}) {
  const [leftWidth, setLeftWidth] = useState(() => {
    if (!storageKey) return defaultLeftWidth
    try {
      const stored = localStorage.getItem(`resizable-panel-${storageKey}`)
      if (stored) {
        const parsed = Number.parseInt(stored, 10)
        if (Number.isFinite(parsed)) {
          return Math.max(minLeftWidth, Math.min(maxLeftWidth, parsed))
        }
      }
    } catch {
      // ignore
    }
    return defaultLeftWidth
  })

  const [isResizing, setIsResizing] = useState(false)
  const dragStateRef = useRef({ active: false, startX: 0, startWidth: defaultLeftWidth })

  useEffect(() => {
    const onMove = (e) => {
      if (!dragStateRef.current.active) return
      const dx = e.clientX - dragStateRef.current.startX
      const next = dragStateRef.current.startWidth + dx
      const clamped = Math.max(minLeftWidth, Math.min(maxLeftWidth, next))
      setLeftWidth(clamped)
    }

    const onUp = () => {
      if (!dragStateRef.current.active) return
      dragStateRef.current.active = false
      setIsResizing(false)
      if (storageKey) {
        try {
          localStorage.setItem(`resizable-panel-${storageKey}`, String(leftWidth))
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [leftWidth, storageKey, minLeftWidth, maxLeftWidth])

  const startResize = (e) => {
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: leftWidth,
    }
    setIsResizing(true)
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Panel */}
      <div
        className={cn(
          'shrink-0 overflow-auto',
          isResizing ? 'transition-none' : 'transition-[width] duration-150 ease-out'
        )}
        style={{ width: `${leftWidth}px` }}
      >
        {leftContent}
      </div>

      {/* Resize Handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startResize}
        className={cn(
          'relative w-1 cursor-col-resize flex-shrink-0',
          'bg-border hover:bg-primary/50 transition-colors',
          isResizing && 'bg-primary/70'
        )}
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Right Panel */}
      <div className="min-w-0 flex-1 overflow-auto">
        {rightContent}
      </div>
    </div>
  )
}
