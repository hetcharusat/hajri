import * as React from 'react'
import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

/**
 * Enhanced Time Input - allows manual time entry with validation
 * Accepts formats: HH:MM, HH:MM:SS, H:MM AM/PM
 */
export function TimeInput({
  value,
  onChange,
  className,
  disabled,
  placeholder = '00:00',
  showIcon = true,
  error,
  ...props
}) {
  const [inputValue, setInputValue] = React.useState('')
  const [isFocused, setIsFocused] = React.useState(false)

  // Convert database time (HH:MM:SS) to display format (HH:MM AM/PM)
  React.useEffect(() => {
    if (value && !isFocused) {
      setInputValue(formatTimeForDisplay(value))
    }
  }, [value, isFocused])

  function formatTimeForDisplay(time) {
    if (!time) return ''
    
    // Handle HH:MM:SS format
    const parts = time.split(':')
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10)
      const minutes = parts[1].padStart(2, '0')
      const period = hours >= 12 ? 'PM' : 'AM'
      
      if (hours === 0) hours = 12
      else if (hours > 12) hours -= 12
      
      return `${hours}:${minutes} ${period}`
    }
    return time
  }

  function parseTimeToDatabase(input) {
    if (!input) return null
    
    const cleaned = input.trim().toUpperCase()
    
    // Try parsing HH:MM AM/PM format
    const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10)
      const minutes = parseInt(ampmMatch[2], 10)
      const period = ampmMatch[3]?.toUpperCase()
      
      if (minutes > 59) return null
      
      if (period === 'PM' && hours !== 12) hours += 12
      else if (period === 'AM' && hours === 12) hours = 0
      
      if (hours > 23) return null
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
    }
    
    // Try parsing HH:MM:SS format
    const fullMatch = cleaned.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
    if (fullMatch) {
      const hours = parseInt(fullMatch[1], 10)
      const minutes = parseInt(fullMatch[2], 10)
      const seconds = parseInt(fullMatch[3], 10)
      
      if (hours > 23 || minutes > 59 || seconds > 59) return null
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    
    // Try parsing just HH:MM
    const simpleMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/)
    if (simpleMatch) {
      const hours = parseInt(simpleMatch[1], 10)
      const minutes = parseInt(simpleMatch[2], 10)
      
      if (hours > 23 || minutes > 59) return null
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
    }
    
    return null
  }

  function handleChange(e) {
    setInputValue(e.target.value)
  }

  function handleBlur() {
    setIsFocused(false)
    const parsed = parseTimeToDatabase(inputValue)
    if (parsed) {
      onChange?.(parsed)
      setInputValue(formatTimeForDisplay(parsed))
    } else if (inputValue && inputValue.trim()) {
      // Invalid input - reset to previous value
      setInputValue(formatTimeForDisplay(value))
    }
  }

  function handleFocus() {
    setIsFocused(true)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  return (
    <div className={cn('relative', className)}>
      {showIcon && (
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      )}
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'flex h-11 w-full rounded-lg border-2 bg-card text-sm font-medium transition-all',
          'ring-offset-background',
          'placeholder:text-muted-foreground/60 placeholder:font-normal',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:border-primary',
          'hover:border-primary/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          showIcon ? 'pl-10 pr-4' : 'px-4',
          error ? 'border-destructive' : 'border-border',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

export default TimeInput
