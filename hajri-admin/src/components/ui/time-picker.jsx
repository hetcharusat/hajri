import React, { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TimePicker({
  value,
  onChange,
  className,
  error,
  disabled,
  placeholder = 'Select time',
  showTimeSelectOnly = true,
  showTimeSelect = true,
  timeIntervals = 15,
  timeCaption = 'Time',
  dateFormat = 'h:mm aa',
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false)

  const handleChange = (date) => {
    onChange?.(date)
  }

  const formatTimeForInput = (date) => {
    if (!date) return null
    if (typeof date === 'string') {
      // If it's already a time string like "09:00:00" or "09:00"
      const timeStr = date.includes(':') ? date.split(' ')[0] : date
      const [hours, minutes] = timeStr.split(':').map(Number)
      if (!isNaN(hours) && !isNaN(minutes)) {
        const d = new Date()
        d.setHours(hours, minutes || 0, 0, 0)
        return d
      }
      return null
    }
    return date instanceof Date ? date : null
  }

  const inputValue = formatTimeForInput(value)

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        <DatePicker
          selected={inputValue}
          onChange={handleChange}
          showTimeSelectOnly={showTimeSelectOnly}
          showTimeSelect={showTimeSelect}
          timeIntervals={timeIntervals}
          timeCaption={timeCaption}
          dateFormat={dateFormat}
          placeholderText={placeholder}
          disabled={disabled}
          open={isOpen}
          onInputClick={() => setIsOpen(true)}
          onClickOutside={() => setIsOpen(false)}
          className={cn(
            'flex h-11 w-full rounded-lg border-2 bg-background px-4 py-2.5 pl-10 text-sm font-medium shadow-sm transition-all',
            'ring-offset-background',
            'placeholder:text-muted-foreground/70 placeholder:font-normal',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-md',
            'hover:border-primary/50 hover:shadow-md',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:shadow-sm',
            error
              ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive'
              : 'border-border',
            className
          )}
          wrapperClassName="w-full"
          {...props}
        />
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  )
}

