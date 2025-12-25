/**
 * Academic Calendar Utilities
 * Helper functions for attendance calculation and teaching day detection
 */

import { supabase } from './supabase'

// Cache for calendar data to avoid repeated fetches
let calendarCache = {
  yearId: null,
  events: [],
  vacations: [],
  examPeriods: [],
  weeklyOffDays: [],
  fetchedAt: null,
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get the current academic year
 */
export async function getCurrentAcademicYear() {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .single()
  
  if (error) {
    console.warn('No current academic year found:', error.message)
    return null
  }
  
  return data
}

/**
 * Fetch all calendar data for an academic year
 */
export async function fetchCalendarData(academicYearId) {
  // Check cache
  if (
    calendarCache.yearId === academicYearId &&
    calendarCache.fetchedAt &&
    Date.now() - calendarCache.fetchedAt < CACHE_TTL
  ) {
    return calendarCache
  }
  
  const [eventsRes, vacationsRes, examsRes, weeklyRes] = await Promise.all([
    supabase.from('calendar_events').select('*').eq('academic_year_id', academicYearId),
    supabase.from('vacation_periods').select('*').eq('academic_year_id', academicYearId),
    supabase.from('exam_periods').select('*').eq('academic_year_id', academicYearId),
    supabase.from('weekly_off_days').select('*').eq('academic_year_id', academicYearId),
  ])
  
  calendarCache = {
    yearId: academicYearId,
    events: eventsRes.data || [],
    vacations: vacationsRes.data || [],
    examPeriods: examsRes.data || [],
    weeklyOffDays: weeklyRes.data || [],
    fetchedAt: Date.now(),
  }
  
  return calendarCache
}

/**
 * Clear the calendar cache (call when calendar data is updated)
 */
export function clearCalendarCache() {
  calendarCache = {
    yearId: null,
    events: [],
    vacations: [],
    examPeriods: [],
    weeklyOffDays: [],
    fetchedAt: null,
  }
}

/**
 * Check if a specific date is a teaching day
 * @param {Date|string} date - The date to check
 * @param {string} academicYearId - Optional academic year ID (uses current if not provided)
 * @returns {Promise<{isTeaching: boolean, reason?: string}>}
 */
export async function isTeachingDay(date, academicYearId = null) {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const dateStr = dateObj.toISOString().split('T')[0]
  const dayOfWeek = dateObj.getDay() // 0 = Sunday
  
  // Get academic year
  let yearId = academicYearId
  if (!yearId) {
    const year = await getCurrentAcademicYear()
    if (!year) {
      return { isTeaching: true, reason: 'No academic year configured' }
    }
    yearId = year.id
  }
  
  // Fetch calendar data
  const calendar = await fetchCalendarData(yearId)
  
  // Check Sunday (always off)
  if (dayOfWeek === 0) {
    return { isTeaching: false, reason: 'Sunday' }
  }
  
  // Check weekly off days
  const weeklyOff = calendar.weeklyOffDays.find(
    w => w.day_of_week === dayOfWeek && w.is_off
  )
  if (weeklyOff) {
    return { isTeaching: false, reason: weeklyOff.note || 'Weekly off day' }
  }
  
  // Check holidays (non-teaching events)
  const holiday = calendar.events.find(e => {
    const isInRange = e.end_date
      ? dateStr >= e.event_date && dateStr <= e.end_date
      : dateStr === e.event_date
    return isInRange && e.is_non_teaching
  })
  if (holiday) {
    return { isTeaching: false, reason: holiday.title }
  }
  
  // Check vacation periods
  const vacation = calendar.vacations.find(
    v => dateStr >= v.start_date && dateStr <= v.end_date
  )
  if (vacation) {
    return { isTeaching: false, reason: vacation.name }
  }
  
  // Check exam periods (no regular teaching during exams)
  const exam = calendar.examPeriods.find(
    e => dateStr >= e.start_date && dateStr <= e.end_date
  )
  if (exam) {
    return { isTeaching: false, reason: exam.name }
  }
  
  return { isTeaching: true }
}

/**
 * Count teaching days between two dates
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @param {string} academicYearId 
 * @returns {Promise<number>}
 */
export async function countTeachingDays(startDate, endDate, academicYearId = null) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  
  let count = 0
  const current = new Date(start)
  
  while (current <= end) {
    const result = await isTeachingDay(current, academicYearId)
    if (result.isTeaching) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return count
}

/**
 * Get all teaching days in a date range
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @param {string} academicYearId 
 * @returns {Promise<Date[]>}
 */
export async function getTeachingDays(startDate, endDate, academicYearId = null) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  
  const teachingDays = []
  const current = new Date(start)
  
  while (current <= end) {
    const result = await isTeachingDay(current, academicYearId)
    if (result.isTeaching) {
      teachingDays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }
  
  return teachingDays
}

/**
 * Get all non-teaching days in a date range with reasons
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @param {string} academicYearId 
 * @returns {Promise<Array<{date: Date, reason: string}>>}
 */
export async function getNonTeachingDays(startDate, endDate, academicYearId = null) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  
  const nonTeachingDays = []
  const current = new Date(start)
  
  while (current <= end) {
    const result = await isTeachingDay(current, academicYearId)
    if (!result.isTeaching) {
      nonTeachingDays.push({
        date: new Date(current),
        reason: result.reason,
      })
    }
    current.setDate(current.getDate() + 1)
  }
  
  return nonTeachingDays
}

/**
 * Calculate attendance statistics for a date range
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @param {number} classesHeld - Number of classes actually held
 * @param {number} classesAttended - Number of classes attended
 * @param {string} academicYearId 
 * @returns {Promise<Object>}
 */
export async function calculateAttendanceStats(
  startDate, 
  endDate, 
  classesHeld, 
  classesAttended, 
  academicYearId = null
) {
  const teachingDays = await countTeachingDays(startDate, endDate, academicYearId)
  const nonTeachingDays = await getNonTeachingDays(startDate, endDate, academicYearId)
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  
  return {
    totalDays,
    teachingDays,
    nonTeachingDays: nonTeachingDays.length,
    classesHeld,
    classesAttended,
    attendancePercentage: classesHeld > 0 
      ? Math.round((classesAttended / classesHeld) * 100 * 10) / 10 
      : 0,
    holidays: nonTeachingDays.filter(d => 
      d.reason !== 'Sunday' && !d.reason.includes('Weekly')
    ).length,
    sundays: nonTeachingDays.filter(d => d.reason === 'Sunday').length,
  }
}

/**
 * Get upcoming events in the next N days
 * @param {number} days - Number of days to look ahead
 * @param {string} academicYearId 
 * @returns {Promise<Array>}
 */
export async function getUpcomingEvents(days = 30, academicYearId = null) {
  let yearId = academicYearId
  if (!yearId) {
    const year = await getCurrentAcademicYear()
    if (!year) return []
    yearId = year.id
  }
  
  const today = new Date().toISOString().split('T')[0]
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)
  const futureDateStr = futureDate.toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('academic_year_id', yearId)
    .gte('event_date', today)
    .lte('event_date', futureDateStr)
    .order('event_date', { ascending: true })
  
  return data || []
}

/**
 * Check if currently in exam period
 * @param {string} academicYearId 
 * @returns {Promise<{inExam: boolean, examName?: string}>}
 */
export async function isExamPeriod(academicYearId = null) {
  let yearId = academicYearId
  if (!yearId) {
    const year = await getCurrentAcademicYear()
    if (!year) return { inExam: false }
    yearId = year.id
  }
  
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('exam_periods')
    .select('*')
    .eq('academic_year_id', yearId)
    .lte('start_date', today)
    .gte('end_date', today)
    .single()
  
  if (error || !data) {
    return { inExam: false }
  }
  
  return { inExam: true, examName: data.name, examType: data.exam_type }
}

/**
 * Check if currently in vacation
 * @param {string} academicYearId 
 * @returns {Promise<{inVacation: boolean, vacationName?: string}>}
 */
export async function isVacationPeriod(academicYearId = null) {
  let yearId = academicYearId
  if (!yearId) {
    const year = await getCurrentAcademicYear()
    if (!year) return { inVacation: false }
    yearId = year.id
  }
  
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('vacation_periods')
    .select('*')
    .eq('academic_year_id', yearId)
    .lte('start_date', today)
    .gte('end_date', today)
    .single()
  
  if (error || !data) {
    return { inVacation: false }
  }
  
  return { inVacation: true, vacationName: data.name, appliesTo: data.applies_to }
}
