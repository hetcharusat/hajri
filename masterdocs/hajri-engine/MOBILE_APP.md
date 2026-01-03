# HAJRI Mobile App Integration Guide

> **Last Updated:** January 4, 2026  
> **Target Platform:** React Native / Flutter / Native Mobile  
> **Backend:** HAJRI Engine + Supabase

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Authentication](#authentication)
5. [Core Features](#core-features)
6. [API Patterns](#api-patterns)
7. [Real-time Updates](#real-time-updates)
8. [Offline Support](#offline-support)
9. [Data Models](#data-models)
10. [Common Screens](#common-screens)
11. [Error Handling](#error-handling)
12. [Testing](#testing)

---

## Overview

### What HAJRI Mobile App Does

1. **OCR Capture** - Scan university portal attendance screenshots
2. **Dashboard** - View current attendance (like college portal)
3. **Predictions** - See "can bunk" and "must attend" per subject
4. **Manual Tracking** - Mark daily attendance
5. **Timetable** - View weekly schedule
6. **Notifications** - Alerts when attendance drops

### Tech Stack

| Component | Technology |
|-----------|------------|
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Google OAuth) |
| **API** | HAJRI Engine (FastAPI) |
| **Real-time** | Supabase Realtime |
| **Storage** | Supabase Storage (OCR images) |

### Production URLs

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://etmlimraemfdpvrsgdpk.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
  ENGINE_URL: 'https://hajri-x8ag.onrender.com/engine',
  OCR_URL: 'https://hajri.onrender.com'
};
```

---

## Quick Start

### 1. Install Supabase

```bash
# React Native
npm install @supabase/supabase-js

# Flutter
flutter pub add supabase_flutter
```

### 2. Initialize Client

```javascript
// supabase.js
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://etmlimraemfdpvrsgdpk.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 3. Login with Google

```javascript
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'your-app-scheme://login-callback'
    }
  });
};
```

### 4. Fetch Dashboard

```javascript
const getDashboard = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    `${CONFIG.ENGINE_URL}/predictions/dashboard`,
    {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    }
  );
  
  return response.json();
};
```

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE APP                                      │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Home /    │  │  Timetable  │  │   Manual    │  │    OCR      │        │
│  │  Dashboard  │  │    View     │  │ Attendance  │  │   Capture   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HAJRI ENGINE API                                    │
│                    https://hajri-x8ag.onrender.com/engine                   │
│                                                                             │
│  /predictions/dashboard  │  /attendance/manual  │  /snapshots/confirm      │
└─────────────────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                        │
│                                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  attendance_   │  │  timetable_    │  │  ocr_snapshots │                │
│  │  summary       │  │  events        │  │                │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│                                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  students      │  │  subjects      │  │  app_users     │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use What

| Use Case | Method |
|----------|--------|
| Get predictions | Engine API |
| Add manual attendance | Engine API |
| Confirm OCR snapshot | Engine API |
| Get timetable | Supabase Direct |
| Get subjects | Supabase Direct |
| Get profile | Supabase Direct |
| Real-time updates | Supabase Realtime |

---

## Authentication

### Google OAuth Flow

```javascript
// 1. Trigger OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'com.hajri.app://login-callback',
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    }
  }
});

// 2. Handle callback (deep link)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if user has student profile
        await checkStudentProfile(session.user.id);
      }
    }
  );
  
  return () => subscription.unsubscribe();
}, []);
```

### Check/Create Student Profile

```javascript
const checkStudentProfile = async (userId) => {
  // Check app_users
  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, students(*)')
    .eq('id', userId)
    .single();
  
  if (!appUser) {
    // New user - needs onboarding
    navigation.navigate('Onboarding');
    return;
  }
  
  if (!appUser.student_id) {
    // Needs to link student
    navigation.navigate('LinkStudent');
    return;
  }
  
  // Ready!
  navigation.navigate('Home');
};
```

### Link Student to Auth User

```javascript
const linkStudent = async (rollNumber) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Find student by roll number
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('roll_number', rollNumber)
    .single();
  
  if (!student) {
    throw new Error('Student not found');
  }
  
  // Create or update app_users
  await supabase.from('app_users').upsert({
    id: user.id,
    student_id: student.id,
    current_batch_id: student.batch_id,
    current_semester_id: null, // Will be set later
    preferences: { theme: 'light', notifications: true }
  });
};
```

### API Request Helper

```javascript
const engineFetch = async (endpoint, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(`${CONFIG.ENGINE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API Error');
  }
  
  return data;
};
```

---

## Core Features

### 1. Dashboard (Current Attendance)

```javascript
const useDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchDashboard();
  }, []);
  
  const fetchDashboard = async () => {
    try {
      const data = await engineFetch('/predictions/dashboard');
      setDashboard(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return { dashboard, loading, refresh: fetchDashboard };
};

// Response shape:
// {
//   semester: "Even Semester 2025-26",
//   overall_present: 245,
//   overall_total: 280,
//   overall_percentage: 87.5,
//   subjects: [
//     { subject_code: "MSUD102", present: 42, total: 48, percentage: 87.5, status: "SAFE" }
//   ]
// }
```

### 2. Predictions (Can Bunk / Must Attend)

```javascript
const usePredictions = () => {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchPredictions();
  }, []);
  
  const fetchPredictions = async () => {
    try {
      const data = await engineFetch('/predictions');
      setPredictions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return { predictions, loading, refresh: fetchPredictions };
};

// Response shape:
// {
//   total_can_bunk: 23,
//   total_must_attend: 0,
//   subjects_at_risk: 0,
//   subjects: [
//     {
//       subject_code: "MSUD102",
//       can_bunk: 8,
//       must_attend: 0,
//       classes_remaining: 36,
//       status: "SAFE"
//     }
//   ]
// }
```

### 3. Add Manual Attendance

```javascript
const addAttendance = async (subjectId, date, status, classType) => {
  try {
    const result = await engineFetch('/attendance/manual', {
      method: 'POST',
      body: JSON.stringify({
        subject_id: subjectId,
        event_date: date, // "2026-01-15"
        status: status,   // "PRESENT" | "ABSENT" | "CANCELLED"
        class_type: classType // "LECTURE" | "LAB" | "TUTORIAL"
      })
    });
    
    // Attendance updated, recompute triggered in background
    return result;
  } catch (error) {
    if (error.message.includes('SNAPSHOT_LOCK')) {
      // Can't add attendance for this date
      Alert.alert('Error', 'Cannot modify attendance before your last snapshot');
    }
    throw error;
  }
};
```

### 4. Get Timetable

```javascript
const useTimetable = (batchId) => {
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchTimetable();
  }, [batchId]);
  
  const fetchTimetable = async () => {
    // First get published version
    const { data: version } = await supabase
      .from('timetable_versions')
      .select('id')
      .eq('batch_id', batchId)
      .eq('status', 'published')
      .single();
    
    if (!version) {
      setLoading(false);
      return;
    }
    
    // Then get events
    const { data: events } = await supabase
      .from('timetable_events')
      .select(`
        *,
        course_offerings (
          subjects (id, code, name, type),
          faculty (name, abbr)
        ),
        rooms (room_number)
      `)
      .eq('version_id', version.id)
      .order('day_of_week')
      .order('start_time');
    
    setTimetable(groupByDay(events));
    setLoading(false);
  };
  
  return { timetable, loading };
};

// Group events by day
const groupByDay = (events) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const grouped = {};
  
  days.forEach((day, index) => {
    grouped[day] = events.filter(e => e.day_of_week === index);
  });
  
  return grouped;
};
```

### 5. OCR Snapshot Flow

```javascript
// 1. Capture image
const captureAttendanceImage = async () => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  
  if (!result.cancelled) {
    return result.uri;
  }
};

// 2. Send to OCR service
const processOCR = async (imageUri) => {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'attendance.jpg'
  });
  
  const response = await fetch(`${CONFIG.OCR_URL}/extract`, {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};

// 3. Review and confirm snapshot
const confirmSnapshot = async (ocrResult) => {
  const result = await engineFetch('/snapshots/confirm', {
    method: 'POST',
    body: JSON.stringify({
      captured_at: new Date().toISOString(),
      source_type: 'university_portal',
      confirm_decreases: false,
      entries: ocrResult.subjects.map(s => ({
        subject_code: s.code,
        subject_name: s.name,
        class_type: s.type || 'LECTURE',
        present: s.present,
        total: s.total
      }))
    })
  });
  
  return result;
};
```

---

## API Patterns

### Fetch with Error Handling

```javascript
const useAPIFetch = (endpoint) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await engineFetch(endpoint);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return { data, loading, error, refresh: fetchData };
};
```

### Mutation with Loading State

```javascript
const useMutation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const mutate = async (endpoint, body) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await engineFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { mutate, loading, error };
};
```

---

## Real-time Updates

### Subscribe to Attendance Changes

```javascript
const useRealtimeAttendance = (studentId) => {
  const [summary, setSummary] = useState([]);
  
  useEffect(() => {
    // Initial fetch
    fetchSummary();
    
    // Subscribe to changes
    const subscription = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendance_summary',
          filter: `student_id=eq.${studentId}`
        },
        (payload) => {
          // Update local state
          setSummary(prev => 
            prev.map(s => 
              s.id === payload.new.id ? payload.new : s
            )
          );
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [studentId]);
  
  const fetchSummary = async () => {
    const { data } = await supabase
      .from('attendance_summary')
      .select('*, subjects(code, name)')
      .eq('student_id', studentId);
    setSummary(data);
  };
  
  return summary;
};
```

### Subscribe to Prediction Updates

```javascript
const useRealtimePredictions = (studentId) => {
  const [predictions, setPredictions] = useState([]);
  
  useEffect(() => {
    const subscription = supabase
      .channel('prediction-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_predictions',
          filter: `student_id=eq.${studentId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setPredictions(prev => {
              const existing = prev.findIndex(p => p.id === payload.new.id);
              if (existing >= 0) {
                return prev.map((p, i) => i === existing ? payload.new : p);
              }
              return [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();
    
    return () => supabase.removeChannel(subscription);
  }, [studentId]);
  
  return predictions;
};
```

---

## Offline Support

### Cache Attendance Data

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'hajri_dashboard_cache';

const useCachedDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [isStale, setIsStale] = useState(false);
  
  useEffect(() => {
    loadCached();
    fetchFresh();
  }, []);
  
  const loadCached = async () => {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      setDashboard(data);
      
      // Check if cache is older than 5 minutes
      if (Date.now() - timestamp > 5 * 60 * 1000) {
        setIsStale(true);
      }
    }
  };
  
  const fetchFresh = async () => {
    try {
      const data = await engineFetch('/predictions/dashboard');
      setDashboard(data);
      setIsStale(false);
      
      // Update cache
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      // Offline - use cached data
      console.log('Using cached data');
    }
  };
  
  return { dashboard, isStale, refresh: fetchFresh };
};
```

### Queue Offline Attendance Entries

```javascript
const OFFLINE_QUEUE_KEY = 'hajri_offline_queue';

const useOfflineQueue = () => {
  const addToQueue = async (entry) => {
    const queue = JSON.parse(
      await AsyncStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'
    );
    queue.push({ ...entry, queuedAt: Date.now() });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  };
  
  const syncQueue = async () => {
    const queue = JSON.parse(
      await AsyncStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'
    );
    
    const failed = [];
    for (const entry of queue) {
      try {
        await engineFetch('/attendance/manual', {
          method: 'POST',
          body: JSON.stringify(entry)
        });
      } catch (error) {
        failed.push(entry);
      }
    }
    
    // Save failed entries back to queue
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
    
    return {
      synced: queue.length - failed.length,
      failed: failed.length
    };
  };
  
  return { addToQueue, syncQueue };
};
```

---

## Data Models

### TypeScript Interfaces

```typescript
// User/Auth
interface AppUser {
  id: string;
  student_id: string;
  current_batch_id: string;
  current_semester_id: string;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}

interface Student {
  id: string;
  roll_number: string;
  name: string;
  email: string;
  batch_id: string;
}

// Attendance
interface SubjectAttendance {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  class_type: 'LECTURE' | 'LAB' | 'TUTORIAL';
  present: number;
  total: number;
  percentage: number;
  status: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
}

interface Dashboard {
  semester: string;
  last_updated: string;
  overall_present: number;
  overall_total: number;
  overall_percentage: number;
  subjects: SubjectAttendance[];
}

interface SubjectPrediction extends SubjectAttendance {
  can_bunk: number;
  must_attend: number;
  classes_remaining: number;
  semester_total: number;
  classes_to_recover: number;
}

interface Predictions {
  student_id: string;
  semester: string;
  semester_end: string;
  classes_remaining_in_semester: number;
  total_can_bunk: number;
  total_must_attend: number;
  subjects_at_risk: number;
  subjects: SubjectPrediction[];
}

// Timetable
interface TimetableEvent {
  id: string;
  day_of_week: number; // 0=Monday
  start_time: string;
  end_time: string;
  course_offerings: {
    subjects: {
      id: string;
      code: string;
      name: string;
      type: string;
    };
    faculty: {
      name: string;
      abbr: string;
    };
  };
  rooms: {
    room_number: string;
  };
}

// Snapshot
interface SnapshotEntry {
  subject_code: string;
  subject_name: string;
  class_type: string;
  present: number;
  total: number;
}

interface Snapshot {
  id: string;
  captured_at: string;
  confirmed_at: string;
  entries: SnapshotEntry[];
}
```

---

## Common Screens

### Home Screen

```javascript
const HomeScreen = () => {
  const { dashboard, loading, refresh } = useDashboard();
  const { predictions } = usePredictions();
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <ScrollView>
      {/* Overall Stats */}
      <OverallCard
        percentage={dashboard.overall_percentage}
        present={dashboard.overall_present}
        total={dashboard.overall_total}
      />
      
      {/* Quick Predictions */}
      <QuickStats
        canBunk={predictions?.total_can_bunk || 0}
        mustAttend={predictions?.total_must_attend || 0}
        atRisk={predictions?.subjects_at_risk || 0}
      />
      
      {/* Subject List */}
      <SubjectList subjects={dashboard.subjects} />
      
      <RefreshButton onPress={refresh} />
    </ScrollView>
  );
};
```

### Mark Attendance Screen

```javascript
const MarkAttendanceScreen = () => {
  const { subjects } = useSubjects();
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [status, setStatus] = useState('PRESENT');
  const { mutate, loading } = useMutation();
  
  const handleSubmit = async () => {
    try {
      await mutate('/attendance/manual', {
        subject_id: selectedSubject.id,
        event_date: formatDate(selectedDate),
        status: status,
        class_type: selectedSubject.type
      });
      
      Alert.alert('Success', 'Attendance marked!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };
  
  return (
    <View>
      <SubjectPicker
        subjects={subjects}
        selected={selectedSubject}
        onSelect={setSelectedSubject}
      />
      
      <DatePicker
        value={selectedDate}
        onChange={setSelectedDate}
        minDate={getSnapshotDate()} // Can't go before snapshot
      />
      
      <StatusToggle value={status} onChange={setStatus} />
      
      <Button
        title="Mark Attendance"
        onPress={handleSubmit}
        disabled={loading || !selectedSubject}
      />
    </View>
  );
};
```

### Timetable Screen

```javascript
const TimetableScreen = () => {
  const { appUser } = useAuth();
  const { timetable, loading } = useTimetable(appUser.current_batch_id);
  const [selectedDay, setSelectedDay] = useState(getCurrentDayIndex());
  
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return (
    <View>
      <DaySelector
        days={days}
        selected={selectedDay}
        onSelect={setSelectedDay}
      />
      
      <FlatList
        data={timetable[days[selectedDay]] || []}
        renderItem={({ item }) => (
          <TimetableEventCard
            time={`${item.start_time} - ${item.end_time}`}
            subject={item.course_offerings.subjects.name}
            code={item.course_offerings.subjects.code}
            faculty={item.course_offerings.faculty?.abbr}
            room={item.rooms?.room_number}
            type={item.course_offerings.subjects.type}
          />
        )}
        ListEmptyComponent={<Text>No classes this day!</Text>}
      />
    </View>
  );
};
```

---

## Error Handling

### Error Boundary

```javascript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text>Something went wrong</Text>
          <Button
            title="Try Again"
            onPress={() => this.setState({ hasError: false })}
          />
        </View>
      );
    }
    
    return this.props.children;
  }
}
```

### API Error Handler

```javascript
const handleAPIError = (error) => {
  const errorCode = error.error_code || error.code;
  
  switch (errorCode) {
    case 'NO_SNAPSHOT':
      return {
        title: 'No Snapshot',
        message: 'Please scan your attendance from university portal first.'
      };
    
    case 'SNAPSHOT_LOCK_VIOLATION':
      return {
        title: 'Cannot Modify',
        message: 'You cannot change attendance for dates before your last snapshot.'
      };
    
    case 'INVALID_DATE':
      return {
        title: 'Invalid Date',
        message: 'This is not a teaching day (holiday or weekend).'
      };
    
    case 'UNAUTHORIZED':
      // Redirect to login
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return null;
    
    default:
      return {
        title: 'Error',
        message: error.message || 'Something went wrong'
      };
  }
};
```

---

## Testing

### Test Mode

```javascript
// Enable test mode for development
const TEST_STUDENT_ID = '11111111-1111-1111-1111-111111111111';

const testEndpoint = (endpoint) => {
  const prefix = '/test';
  return endpoint.replace('/engine/', `/engine${prefix}/`);
};

// Use test endpoints (no auth required)
const getTestPredictions = async () => {
  const response = await fetch(
    `${CONFIG.ENGINE_URL}/test/predictions/${TEST_STUDENT_ID}`
  );
  return response.json();
};
```

### Test Portal

Use the Engine Test Portal for debugging:
- URL: https://hajriengine.vercel.app
- All test endpoints available without auth
- Can set up test data easily

---

## Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Schema Reference](../hajri-admin/SCHEMA.md) - Database schema
- [Authentication](../hajri-admin/OAUTH.md) - OAuth setup guide
