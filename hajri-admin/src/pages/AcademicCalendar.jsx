import { useState, useEffect, useMemo } from 'react'
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronLeft, 
  ChevronRight,
  Sun,
  BookOpen,
  GraduationCap,
  PartyPopper,
  Plane,
  FileText,
  Check,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Event type configurations - Higher contrast colors
const EVENT_TYPES = {
  holiday: { label: 'Holiday', color: 'bg-red-600/30 text-red-300 border-red-500/50', icon: Sun },
  academic: { label: 'Academic', color: 'bg-blue-600/30 text-blue-300 border-blue-500/50', icon: BookOpen },
  college_event: { label: 'College Event', color: 'bg-purple-600/30 text-purple-300 border-purple-500/50', icon: PartyPopper },
  exam: { label: 'Exam', color: 'bg-amber-600/30 text-amber-300 border-amber-500/50', icon: FileText },
  vacation: { label: 'Vacation', color: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50', icon: Plane },
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AcademicCalendar() {
  // State
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [events, setEvents] = useState([])
  const [vacations, setVacations] = useState([])
  const [examPeriods, setExamPeriods] = useState([])
  const [teachingPeriods, setTeachingPeriods] = useState([])
  const [weeklyOffDays, setWeeklyOffDays] = useState([])
  
  const [currentMonth, setCurrentMonth] = useState(new Date()) // Always starts with today's month
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('calendar') // calendar, events, periods, settings
  const [eventSearch, setEventSearch] = useState('') // Search filter for events
  
  // Modal state
  const [showEventModal, setShowEventModal] = useState(false)
  const [showYearModal, setShowYearModal] = useState(false)
  const [showVacationModal, setShowVacationModal] = useState(false)
  const [showExamModal, setShowExamModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // Fetch academic years
  useEffect(() => {
    fetchAcademicYears()
  }, [])

  // Fetch data when year changes
  useEffect(() => {
    if (selectedYear) {
      fetchCalendarData()
    }
  }, [selectedYear])

  async function fetchAcademicYears() {
    setLoading(true)
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .order('start_date', { ascending: false })
    
    if (!error && data) {
      setAcademicYears(data)
      const current = data.find(y => y.is_current) || data[0]
      if (current) {
        setSelectedYear(current)
        // Keep calendar at current real month (already set in useState)
      }
    }
    setLoading(false)
  }

  async function fetchCalendarData() {
    if (!selectedYear) return

    const [eventsRes, vacationsRes, examsRes, teachingRes, weeklyRes] = await Promise.all([
      supabase.from('calendar_events').select('*').eq('academic_year_id', selectedYear.id),
      supabase.from('vacation_periods').select('*').eq('academic_year_id', selectedYear.id),
      supabase.from('exam_periods').select('*').eq('academic_year_id', selectedYear.id),
      supabase.from('teaching_periods').select('*').eq('academic_year_id', selectedYear.id),
      supabase.from('weekly_off_days').select('*').eq('academic_year_id', selectedYear.id),
    ])

    if (eventsRes.data) setEvents(eventsRes.data)
    if (vacationsRes.data) setVacations(vacationsRes.data)
    if (examsRes.data) setExamPeriods(examsRes.data)
    if (teachingRes.data) setTeachingPeriods(teachingRes.data)
    if (weeklyRes.data) setWeeklyOffDays(weeklyRes.data)
  }

  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()
    
    const days = []
    
    // Padding days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      })
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      })
    }
    
    // Padding days for next month
    const remaining = 42 - days.length // 6 rows × 7 days
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      })
    }
    
    return days
  }, [currentMonth])

  // Get events for a specific date
  function getEventsForDate(date) {
    const dateStr = date.toISOString().split('T')[0]
    const dayEvents = []
    
    // Single-day events
    events.forEach(e => {
      if (e.event_date === dateStr) {
        dayEvents.push({ ...e, type: 'event' })
      }
      // Multi-day events
      if (e.end_date && dateStr >= e.event_date && dateStr <= e.end_date) {
        if (e.event_date !== dateStr) {
          dayEvents.push({ ...e, type: 'event', continuation: true })
        }
      }
    })
    
    // Vacations
    vacations.forEach(v => {
      if (dateStr >= v.start_date && dateStr <= v.end_date) {
        dayEvents.push({ 
          ...v, 
          type: 'period',
          event_type: 'vacation',
          title: v.name,
          isStart: dateStr === v.start_date,
          isEnd: dateStr === v.end_date,
        })
      }
    })
    
    // Exam periods
    examPeriods.forEach(e => {
      if (dateStr >= e.start_date && dateStr <= e.end_date) {
        dayEvents.push({ 
          ...e, 
          type: 'period',
          event_type: 'exam',
          title: e.name,
          isStart: dateStr === e.start_date,
          isEnd: dateStr === e.end_date,
        })
      }
    })
    
    return dayEvents
  }

  // Check if date is non-teaching
  function isNonTeachingDay(date) {
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]
    
    // Sunday is always off
    if (dayOfWeek === 0) return true
    
    // Check weekly off days
    if (weeklyOffDays.some(w => w.day_of_week === dayOfWeek && w.is_off)) return true
    
    // Check holidays
    if (events.some(e => e.event_date === dateStr && e.is_non_teaching)) return true
    
    // Check vacations
    if (vacations.some(v => dateStr >= v.start_date && dateStr <= v.end_date)) return true
    
    // Check exam periods
    if (examPeriods.some(e => dateStr >= e.start_date && dateStr <= e.end_date)) return true
    
    return false
  }

  // Navigate months
  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  // CRUD operations
  async function saveAcademicYear(data) {
    let error
    if (editingItem) {
      const result = await supabase.from('academic_years').update(data).eq('id', editingItem.id)
      error = result.error
    } else {
      const result = await supabase.from('academic_years').insert(data)
      error = result.error
    }
    if (error) {
      console.error('Save academic year error:', error)
      alert('Failed to save: ' + error.message)
      return
    }
    setShowYearModal(false)
    setEditingItem(null)
    fetchAcademicYears()
  }

  async function saveEvent(data) {
    // Convert empty strings to null for optional date fields
    const payload = { 
      ...data, 
      academic_year_id: selectedYear.id,
      end_date: data.end_date || null,
      description: data.description || null,
    }
    let error
    if (editingItem) {
      const result = await supabase.from('calendar_events').update(payload).eq('id', editingItem.id)
      error = result.error
    } else {
      const result = await supabase.from('calendar_events').insert(payload)
      error = result.error
    }
    if (error) {
      console.error('Save event error:', error)
      alert('Failed to save: ' + error.message)
      return
    }
    setShowEventModal(false)
    setEditingItem(null)
    fetchCalendarData()
  }

  async function saveVacation(data) {
    const payload = { ...data, academic_year_id: selectedYear.id }
    let error
    if (editingItem) {
      const result = await supabase.from('vacation_periods').update(payload).eq('id', editingItem.id)
      error = result.error
    } else {
      const result = await supabase.from('vacation_periods').insert(payload)
      error = result.error
    }
    if (error) {
      console.error('Save vacation error:', error)
      alert('Failed to save: ' + error.message)
      return
    }
    setShowVacationModal(false)
    setEditingItem(null)
    fetchCalendarData()
  }

  async function saveExamPeriod(data) {
    const payload = { ...data, academic_year_id: selectedYear.id }
    let error
    if (editingItem) {
      const result = await supabase.from('exam_periods').update(payload).eq('id', editingItem.id)
      error = result.error
    } else {
      const result = await supabase.from('exam_periods').insert(payload)
      error = result.error
    }
    if (error) {
      console.error('Save exam period error:', error)
      alert('Failed to save: ' + error.message)
      return
    }
    setShowExamModal(false)
    setEditingItem(null)
    fetchCalendarData()
  }

  async function deleteItem(table, id) {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      console.error('Delete error:', error)
      alert('Failed to delete: ' + error.message)
      return
    }
    fetchCalendarData()
  }

  async function setCurrentYear(yearId) {
    // Unset all, then set the selected one
    await supabase.from('academic_years').update({ is_current: false }).neq('id', 'none')
    await supabase.from('academic_years').update({ is_current: true }).eq('id', yearId)
    fetchAcademicYears()
  }

  // Import from JSON
  async function importFromJSON() {
    const input = prompt('Paste the JSON calendar data:')
    if (!input) return
    
    try {
      const data = JSON.parse(input)
      // TODO: Parse and insert data
      alert('Import functionality - implement based on your JSON structure')
    } catch (e) {
      alert('Invalid JSON: ' + e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Academic Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Manage holidays, vacations, and exam periods for attendance tracking
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <select
            value={selectedYear?.id || ''}
            onChange={(e) => {
              const year = academicYears.find(y => y.id === e.target.value)
              setSelectedYear(year)
            }}
            className="h-9 px-3 rounded-md border border-border bg-background text-sm"
          >
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>
                {y.name} {y.is_current && '(Current)'}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => { setEditingItem(null); setShowYearModal(true) }}
            className="h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Year
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {[
          { id: 'calendar', label: 'Calendar View' },
          { id: 'events', label: 'Events & Holidays' },
          { id: 'periods', label: 'Periods' },
          { id: 'settings', label: 'Settings' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === tab.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar View */}
      {activeTab === 'calendar' && selectedYear && (
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-lg">
          {/* Calendar header */}
          <div className="calendar-month-header flex items-center justify-between p-5 border-b border-border">
            <button 
              onClick={prevMonth} 
              className="p-2.5 hover:bg-white/10 rounded-lg transition-all hover:scale-110 active:scale-95"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight">
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedYear.name} Academic Year
              </p>
            </div>
            <button 
              onClick={nextMonth} 
              className="p-2.5 hover:bg-white/10 rounded-lg transition-all hover:scale-110 active:scale-95"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-muted/30">
            {DAYS.map((day, i) => (
              <div 
                key={day} 
                className={cn(
                  "py-3 text-center text-xs font-semibold uppercase tracking-wider",
                  i === 0 ? "text-red-400" : "text-muted-foreground"
                )}
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="calendar-grid grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDate(day.date)
              const isNonTeaching = isNonTeachingDay(day.date)
              const isToday = day.date.toDateString() === new Date().toDateString()
              const isSunday = day.date.getDay() === 0
              
              return (
                <div
                  key={idx}
                  className={cn(
                    'calendar-day min-h-[110px] p-2 border-b border-r border-border relative group',
                    !day.isCurrentMonth && 'bg-muted/20',
                    day.isCurrentMonth && 'bg-card',
                    isNonTeaching && day.isCurrentMonth && 'bg-gradient-to-br from-red-500/5 to-red-500/10',
                    isSunday && day.isCurrentMonth && 'bg-gradient-to-br from-red-500/5 to-transparent',
                    idx % 7 === 6 && 'border-r-0',
                    isToday && 'ring-2 ring-primary ring-inset'
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    'calendar-day-number text-sm font-semibold mb-1.5 w-7 h-7 flex items-center justify-center rounded-full',
                    !day.isCurrentMonth && 'text-muted-foreground/40',
                    day.isCurrentMonth && 'text-foreground',
                    isToday && 'calendar-day-today bg-primary text-primary-foreground shadow-lg',
                    isSunday && day.isCurrentMonth && !isToday && 'text-red-400'
                  )}>
                    {day.date.getDate()}
                  </div>
                  
                  {/* Events */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event, i) => {
                      const config = EVENT_TYPES[event.event_type] || EVENT_TYPES.academic
                      return (
                        <div
                          key={`${event.id}-${i}`}
                          className={cn(
                            'calendar-event text-[11px] leading-tight px-2 py-1 rounded-md truncate font-medium border shadow-sm',
                            config.color,
                            event.continuation && 'opacity-70 border-dashed'
                          )}
                          title={`${event.title}${event.end_date ? ` (until ${event.end_date})` : ''}`}
                        >
                          {event.title}
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted/50 rounded-md text-center font-medium">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                  
                  {/* Hover indicator for empty days */}
                  {dayEvents.length === 0 && day.isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="text-[10px] text-muted-foreground/50">No events</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Legend */}
          <div className="p-4 border-t border-border bg-muted/20">
            <div className="flex flex-wrap gap-4 justify-center">
              {Object.entries(EVENT_TYPES).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <div key={key} className="calendar-legend-item flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-card border border-border">
                    <div className={cn('w-3 h-3 rounded-full border-2', config.color)} />
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{config.label}</span>
                  </div>
                )
              })}
              <div className="calendar-legend-item flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-card border border-border">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500/30 to-red-500/50 border-2 border-red-500/50" />
                <span className="font-medium">Non-teaching</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events & Holidays Tab */}
      {activeTab === 'events' && selectedYear && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold text-lg">Events & Holidays</h3>
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search events..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground"
              />
              <button
                onClick={() => { setEditingItem(null); setShowEventModal(true) }}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-2 hover:bg-primary/90 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Event
              </button>
            </div>
          </div>
          
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/70 border-b border-border">
                  <th className="text-left p-3 font-semibold text-foreground">Date</th>
                  <th className="text-left p-3 font-semibold text-foreground">Title</th>
                  <th className="text-left p-3 font-semibold text-foreground">Type</th>
                  <th className="text-left p-3 font-semibold text-foreground">Non-Teaching</th>
                  <th className="text-right p-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No events added yet
                    </td>
                  </tr>
                ) : (
                  events
                    .filter(e => {
                      if (!eventSearch.trim()) return true
                      const q = eventSearch.toLowerCase()
                      return e.title.toLowerCase().includes(q) ||
                        e.event_type.toLowerCase().includes(q) ||
                        e.event_date.includes(q)
                    })
                    .sort((a, b) => a.event_date.localeCompare(b.event_date))
                    .map(event => {
                      const config = EVENT_TYPES[event.event_type]
                      return (
                        <tr key={event.id} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">
                            {event.event_date}
                            {event.end_date && ` → ${event.end_date}`}
                          </td>
                          <td className="p-3">{event.title}</td>
                          <td className="p-3">
                            <span className={cn('px-2 py-1 rounded-md text-xs border', config?.color)}>
                              {config?.label || event.event_type}
                            </span>
                          </td>
                          <td className="p-3">
                            {event.is_non_teaching ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => { setEditingItem(event); setShowEventModal(true) }}
                              className="p-1.5 hover:bg-muted rounded-md"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteItem('calendar_events', event.id)}
                              className="p-1.5 hover:bg-muted rounded-md text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Periods Tab */}
      {activeTab === 'periods' && selectedYear && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vacations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Vacation Periods
              </h3>
              <button
                onClick={() => { setEditingItem(null); setShowVacationModal(true) }}
                className="h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            
            <div className="border border-border rounded-lg divide-y divide-border">
              {vacations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No vacation periods added
                </div>
              ) : (
                vacations.map(v => (
                  <div key={v.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{v.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {v.start_date} → {v.end_date}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Applies to: {v.applies_to}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingItem(v); setShowVacationModal(true) }}
                        className="p-1.5 hover:bg-muted rounded-md"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem('vacation_periods', v.id)}
                        className="p-1.5 hover:bg-muted rounded-md text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Exam Periods */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Exam Periods
              </h3>
              <button
                onClick={() => { setEditingItem(null); setShowExamModal(true) }}
                className="h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            
            <div className="border border-border rounded-lg divide-y divide-border">
              {examPeriods.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No exam periods added
                </div>
              ) : (
                examPeriods.map(e => (
                  <div key={e.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{e.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {e.start_date} → {e.end_date}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.semester_type} semester • {e.exam_type}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingItem(e); setShowExamModal(true) }}
                        className="p-1.5 hover:bg-muted rounded-md"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem('exam_periods', e.id)}
                        className="p-1.5 hover:bg-muted rounded-md text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Teaching Periods */}
          <div className="space-y-4 lg:col-span-2">
            <h3 className="font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Teaching Periods
            </h3>
            
            <div className="border border-border rounded-lg divide-y divide-border">
              {teachingPeriods.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No teaching periods added
                </div>
              ) : (
                teachingPeriods.map(t => (
                  <div key={t.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {t.start_date} → {t.end_date}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.semester_type} semester
                      </div>
                    </div>
                    <button
                      onClick={() => deleteItem('teaching_periods', t.id)}
                      className="p-1.5 hover:bg-muted rounded-md text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && selectedYear && (
        <div className="space-y-6 max-w-2xl">
          {/* Academic Year Info */}
          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Academic Year: {selectedYear.name}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Start Date</div>
                <div className="font-mono">{selectedYear.start_date}</div>
              </div>
              <div>
                <div className="text-muted-foreground">End Date</div>
                <div className="font-mono">{selectedYear.end_date}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Institution</div>
                <div>{selectedYear.institution}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div>
                  {selectedYear.is_current ? (
                    <span className="text-green-500">Current Year</span>
                  ) : (
                    <button
                      onClick={() => setCurrentYear(selectedYear.id)}
                      className="text-primary hover:underline"
                    >
                      Set as Current
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Weekly Off Days */}
          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Weekly Off Days</h3>
            <p className="text-sm text-muted-foreground">
              Configure which days of the week are non-teaching by default.
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, idx) => {
                const isOff = idx === 0 || weeklyOffDays.some(w => w.day_of_week === idx && w.is_off)
                return (
                  <button
                    key={day}
                    disabled={idx === 0} // Sunday always off
                    onClick={async () => {
                      const existing = weeklyOffDays.find(w => w.day_of_week === idx)
                      if (existing) {
                        await supabase.from('weekly_off_days').update({ is_off: !isOff }).eq('id', existing.id)
                      } else {
                        await supabase.from('weekly_off_days').insert({
                          academic_year_id: selectedYear.id,
                          day_of_week: idx,
                          is_off: true,
                        })
                      }
                      fetchCalendarData()
                    }}
                    className={cn(
                      'px-4 py-2 rounded-md border text-sm font-medium transition-colors',
                      isOff
                        ? 'bg-red-500/20 border-red-500/30 text-red-400'
                        : 'bg-muted/50 border-border text-foreground hover:bg-muted',
                      idx === 0 && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Import/Export */}
          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Import / Export</h3>
            <div className="flex gap-3">
              <button
                onClick={importFromJSON}
                className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted text-sm"
              >
                Import from JSON
              </button>
              <button
                onClick={() => {
                  const data = {
                    academic_year: selectedYear,
                    events,
                    vacations,
                    examPeriods,
                    teachingPeriods,
                    weeklyOffDays,
                  }
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                  alert('Copied to clipboard!')
                }}
                className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted text-sm"
              >
                Export to JSON
              </button>
            </div>
          </div>
          
          {/* Statistics */}
          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{events.filter(e => e.event_type === 'holiday').length}</div>
                <div className="text-xs text-muted-foreground">Holidays</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{vacations.length}</div>
                <div className="text-xs text-muted-foreground">Vacation Periods</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{examPeriods.length}</div>
                <div className="text-xs text-muted-foreground">Exam Periods</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{events.filter(e => e.event_type === 'academic').length}</div>
                <div className="text-xs text-muted-foreground">Academic Events</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showEventModal && (
        <EventModal
          event={editingItem}
          onSave={saveEvent}
          onClose={() => { setShowEventModal(false); setEditingItem(null) }}
        />
      )}
      
      {showYearModal && (
        <YearModal
          year={editingItem}
          onSave={saveAcademicYear}
          onClose={() => { setShowYearModal(false); setEditingItem(null) }}
        />
      )}
      
      {showVacationModal && (
        <VacationModal
          vacation={editingItem}
          onSave={saveVacation}
          onClose={() => { setShowVacationModal(false); setEditingItem(null) }}
        />
      )}
      
      {showExamModal && (
        <ExamModal
          exam={editingItem}
          onSave={saveExamPeriod}
          onClose={() => { setShowExamModal(false); setEditingItem(null) }}
        />
      )}
    </div>
  )
}

// Modal Components
function EventModal({ event, onSave, onClose }) {
  const [form, setForm] = useState({
    event_date: event?.event_date || '',
    end_date: event?.end_date || '',
    event_type: event?.event_type || 'holiday',
    title: event?.title || '',
    description: event?.description || '',
    is_non_teaching: event?.is_non_teaching ?? true,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title || !form.event_date) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{event ? 'Edit Event' : 'Add New Event'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Republic Day"
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Start Date *</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Event Type</label>
            <select
              value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            >
              {Object.entries(EVENT_TYPES).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional notes about this event..."
              className="w-full h-24 px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
            />
          </div>
          
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={form.is_non_teaching}
              onChange={(e) => setForm({ ...form, is_non_teaching: e.target.checked })}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <div className="text-sm font-medium">Non-teaching day</div>
              <div className="text-xs text-muted-foreground">Excludes from attendance calculation</div>
            </div>
          </label>
        </div>
        
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg border border-border hover:bg-muted font-medium transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.title || !form.event_date}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {event ? 'Update Event' : 'Add Event'}
          </button>
        </div>
      </form>
    </div>
  )
}

function YearModal({ year, onSave, onClose }) {
  const [form, setForm] = useState({
    name: year?.name || '',
    start_date: year?.start_date || '',
    end_date: year?.end_date || '',
    institution: year?.institution || 'CHARUSAT',
    is_current: year?.is_current ?? false,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.start_date || !form.end_date) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{year ? 'Edit Academic Year' : 'Add Academic Year'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="2025-26"
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Start Date *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">End Date *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Institution</label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={form.is_current}
              onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <div className="text-sm font-medium">Set as current</div>
              <div className="text-xs text-muted-foreground">This will be the active academic year</div>
            </div>
          </label>
        </div>
        
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg border border-border hover:bg-muted font-medium transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.name || !form.start_date || !form.end_date}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {year ? 'Update' : 'Add Year'}
          </button>
        </div>
      </form>
    </div>
  )
}

function VacationModal({ vacation, onSave, onClose }) {
  const [form, setForm] = useState({
    name: vacation?.name || '',
    start_date: vacation?.start_date || '',
    end_date: vacation?.end_date || '',
    applies_to: vacation?.applies_to || 'all',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.start_date || !form.end_date) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{vacation ? 'Edit Vacation' : 'Add Vacation Period'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Diwali Vacation"
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Start Date *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">End Date *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Applies To</label>
            <select
              value={form.applies_to}
              onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            >
              <option value="all">Everyone</option>
              <option value="students">Students Only</option>
              <option value="employees">Employees Only</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg border border-border hover:bg-muted font-medium transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.name || !form.start_date || !form.end_date}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {vacation ? 'Update' : 'Add Vacation'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ExamModal({ exam, onSave, onClose }) {
  const [form, setForm] = useState({
    name: exam?.name || '',
    start_date: exam?.start_date || '',
    end_date: exam?.end_date || '',
    exam_type: exam?.exam_type || 'regular',
    semester_type: exam?.semester_type || 'odd',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.start_date || !form.end_date) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{exam ? 'Edit Exam Period' : 'Add Exam Period'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Odd Semester Regular Exam"
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Start Date *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">End Date *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Semester</label>
              <select
                value={form.semester_type}
                onChange={(e) => setForm({ ...form, semester_type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              >
                <option value="odd">Odd Semester</option>
                <option value="even">Even Semester</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Exam Type</label>
              <select
                value={form.exam_type}
                onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              >
                <option value="regular">Regular</option>
                <option value="remedial">Remedial</option>
                <option value="supplementary">Supplementary</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg border border-border hover:bg-muted font-medium transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.name || !form.start_date || !form.end_date}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {exam ? 'Update' : 'Add Exam'}
          </button>
        </div>
      </form>
    </div>
  )
}
