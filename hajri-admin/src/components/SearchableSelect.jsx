import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Minimal searchable select using existing Input + Tailwind tokens.
 * options: [{ value: string, label: string, meta?: string }]
 */
export function SearchableSelect({
  label,
  placeholder = 'Select...',
  value,
  onValueChange,
  options,
  disabled,
  className,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => {
      const hay = `${o.label} ${o.meta || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, query])

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const displayValue = open ? query : selected?.label || ''

  return (
    <div ref={containerRef} className={cn('space-y-1', className)}>
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}

      <div className="relative">
        <Input
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            if (disabled) return
            setOpen(true)
            setQuery('')
          }}
          onChange={(e) => {
            if (disabled) return
            setOpen(true)
            setQuery(e.target.value)
          }}
        />

        {open && !disabled && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-sm">
            <div className="max-h-56 overflow-auto py-1">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50"
                onClick={() => {
                  onValueChange('')
                  setOpen(false)
                  setQuery('')
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">None</span>
                </div>
              </button>

              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-secondary/50',
                      opt.value === value && 'bg-secondary'
                    )}
                    onClick={() => {
                      onValueChange(opt.value)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-foreground">{opt.label}</span>
                      {opt.meta ? (
                        <span className="flex-shrink-0 text-xs text-muted-foreground">{opt.meta}</span>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
