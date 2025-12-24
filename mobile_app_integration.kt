// ========================================
// HAJRI Mobile App - Supabase Integration
// ========================================
// Example Kotlin code for Android app to fetch timetable data
// ========================================

package com.example.hajri.data.repository

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.Serializable
import javax.inject.Inject

// ========================================
// DATA MODELS
// ========================================

@Serializable
data class TimetableEvent(
    val event_id: String,
    val day_of_week: Int,  // 1=Mon, 2=Tue... 6=Sat
    val start_time: String, // "09:00:00"
    val end_time: String,   // "09:50:00"
    val subject_code: String,
    val subject_name: String,
    val subject_type: String, // "LECT", "LAB", "TUT"
    val credits: Int?,
    val faculty_name: String?,
    val faculty_abbr: String?,
    val room_number: String?
)

@Serializable
data class BatchInfo(
    val batch_id: String,
    val batch_name: String,
    val department_name: String?,
    val student_id: String?,
    val student_name: String?
)

@Serializable
data class SubjectSummary(
    val subject_id: String,
    val subject_code: String,
    val subject_name: String,
    val subject_type: String,
    val credits: Int,
    val faculty_name: String?,
    val faculty_abbr: String?
)

@Serializable
data class PeriodSlot(
    val period_id: String,
    val period_number: Int,
    val period_name: String,
    val start_time: String,
    val end_time: String,
    val is_break: Boolean,
    val duration_minutes: Double
)

// ========================================
// REPOSITORY
// ========================================

class TimetableRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val localDb: AppDatabase // Room database for offline storage
) {
    
    // ========================================
    // 1. STUDENT AUTHENTICATION & BATCH LOOKUP
    // ========================================
    
    /**
     * Find batch information by student's roll number
     * Call this on first launch after student enters roll number
     */
    suspend fun findBatchByRollNumber(rollNumber: String): Result<BatchInfo> {
        return try {
            // Using the helper function from SQL
            val result = supabase
                .from("rpc")
                .select("get_batch_by_roll_number") {
                    body = mapOf("roll_no" to rollNumber)
                }
                .decodeSingle<BatchInfo>()
            
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Alternative: Direct query if helper function not available
     */
    suspend fun findBatchByRollNumberDirect(rollNumber: String): Result<BatchInfo> {
        return try {
            // Query student node
            val studentNode = supabase
                .from("nodes")
                .select(Columns.raw("id, name, parent_id, metadata"))
                .eq("type", "student")
                .eq("metadata->>rollNumber", rollNumber)
                .decodeSingle<StudentNode>()
            
            // Query batch node (parent)
            val batchNode = supabase
                .from("nodes")
                .select(Columns.raw("id, name, parent_id"))
                .eq("id", studentNode.parent_id)
                .decodeSingle<Node>()
            
            // Optional: Query department (grandparent)
            val deptNode = batchNode.parent_id?.let { parentId ->
                supabase
                    .from("nodes")
                    .select(Columns.raw("id, name"))
                    .eq("id", parentId)
                    .decodeSingle<Node>()
            }
            
            Result.success(
                BatchInfo(
                    batch_id = batchNode.id,
                    batch_name = batchNode.name,
                    department_name = deptNode?.name,
                    student_id = studentNode.id,
                    student_name = studentNode.name
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // ========================================
    // 2. TIMETABLE SYNC
    // ========================================
    
    /**
     * Fetch latest published timetable from Supabase
     * Call this on app launch (if network available)
     */
    suspend fun syncTimetable(batchId: String): Result<Int> {
        return try {
            // Query the view created in SQL
            val events = supabase
                .from("current_timetables")
                .select()
                .eq("batch_id", batchId)
                .decodeList<TimetableEvent>()
            
            // Save to local Room database
            localDb.withTransaction {
                localDb.timetableDao().deleteByBatch(batchId)
                localDb.timetableDao().insertAll(events.map { it.toEntity(batchId) })
            }
            
            // Update sync metadata
            localDb.syncDao().updateLastSync(
                table = "timetable",
                timestamp = System.currentTimeMillis()
            )
            
            Result.success(events.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Alternative: Manual query without view
     */
    suspend fun syncTimetableManual(batchId: String): Result<Int> {
        return try {
            // Step 1: Get latest published version
            val version = supabase
                .from("timetable_versions")
                .select(Columns.raw("id, name, published_at"))
                .eq("batch_id", batchId)
                .eq("status", "published")
                .order("published_at", order = Order.DESCENDING)
                .limit(1)
                .decodeSingle<TimetableVersion>()
            
            // Step 2: Get all events with joins
            val events = supabase
                .from("timetable_events")
                .select(Columns.raw("""
                    id,
                    day_of_week,
                    start_time,
                    end_time,
                    room_id,
                    rooms:room_id(room_number),
                    course_offerings(
                        id,
                        subjects(id, code, name, type, credits),
                        faculty(name, abbr)
                    )
                """))
                .eq("version_id", version.id)
                .order("day_of_week")
                .order("start_time")
                .decodeList<TimetableEventRaw>()
            
            // Transform and save to local DB
            val entities = events.map { it.toEntity(batchId) }
            localDb.withTransaction {
                localDb.timetableDao().deleteByBatch(batchId)
                localDb.timetableDao().insertAll(entities)
            }
            
            Result.success(entities.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // ========================================
    // 3. LOCAL DATA ACCESS (OFFLINE-FIRST)
    // ========================================
    
    /**
     * Get timetable for a specific day from local DB
     * Always call this to show UI (works offline)
     */
    fun getTimetableForDay(batchId: String, dayOfWeek: Int): Flow<List<TimetableEvent>> {
        return localDb.timetableDao()
            .observeByBatchAndDay(batchId, dayOfWeek)
            .map { entities -> entities.map { it.toModel() } }
    }
    
    /**
     * Get current lecture happening right now
     */
    fun getCurrentLecture(batchId: String): Flow<TimetableEvent?> = flow {
        val calendar = Calendar.getInstance()
        val currentDay = when (calendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> 1
            Calendar.TUESDAY -> 2
            Calendar.WEDNESDAY -> 3
            Calendar.THURSDAY -> 4
            Calendar.FRIDAY -> 5
            Calendar.SATURDAY -> 6
            else -> null
        }
        
        if (currentDay == null) {
            emit(null)
            return@flow
        }
        
        val currentTime = String.format(
            "%02d:%02d:00",
            calendar.get(Calendar.HOUR_OF_DAY),
            calendar.get(Calendar.MINUTE)
        )
        
        val todayEvents = localDb.timetableDao()
            .getByBatchAndDay(batchId, currentDay)
        
        val currentLecture = todayEvents.find { event ->
            event.start_time <= currentTime && event.end_time > currentTime
        }
        
        emit(currentLecture?.toModel())
    }
    
    /**
     * Get next lecture after current time
     */
    fun getNextLecture(batchId: String): Flow<TimetableEvent?> = flow {
        val calendar = Calendar.getInstance()
        val currentDay = when (calendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> 1
            Calendar.TUESDAY -> 2
            Calendar.WEDNESDAY -> 3
            Calendar.THURSDAY -> 4
            Calendar.FRIDAY -> 5
            Calendar.SATURDAY -> 6
            else -> null
        }
        
        if (currentDay == null) {
            emit(null)
            return@flow
        }
        
        val currentTime = String.format(
            "%02d:%02d:00",
            calendar.get(Calendar.HOUR_OF_DAY),
            calendar.get(Calendar.MINUTE)
        )
        
        val todayEvents = localDb.timetableDao()
            .getByBatchAndDay(batchId, currentDay)
        
        val nextLecture = todayEvents.find { event ->
            event.start_time > currentTime
        }
        
        emit(nextLecture?.toModel())
    }
    
    /**
     * Get full week timetable
     */
    fun getFullWeekTimetable(batchId: String): Flow<Map<Int, List<TimetableEvent>>> {
        return localDb.timetableDao()
            .observeByBatch(batchId)
            .map { entities ->
                entities
                    .map { it.toModel() }
                    .groupBy { it.day_of_week }
            }
    }
    
    // ========================================
    // 4. SUBJECTS
    // ========================================
    
    /**
     * Sync all subjects for a batch
     */
    suspend fun syncSubjects(batchId: String): Result<Int> {
        return try {
            val subjects = supabase
                .from("batch_subjects")
                .select()
                .eq("batch_id", batchId)
                .decodeList<SubjectSummary>()
            
            localDb.withTransaction {
                localDb.subjectDao().deleteByBatch(batchId)
                localDb.subjectDao().insertAll(subjects.map { it.toEntity(batchId) })
            }
            
            Result.success(subjects.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get all subjects from local DB
     */
    fun getAllSubjects(batchId: String): Flow<List<SubjectSummary>> {
        return localDb.subjectDao()
            .observeByBatch(batchId)
            .map { entities -> entities.map { it.toModel() } }
    }
    
    // ========================================
    // 5. PERIOD TEMPLATE
    // ========================================
    
    /**
     * Sync active period template (for showing time slots)
     */
    suspend fun syncPeriodTemplate(): Result<List<PeriodSlot>> {
        return try {
            val periods = supabase
                .from("active_period_schedule")
                .select()
                .decodeList<PeriodSlot>()
            
            localDb.withTransaction {
                localDb.periodDao().deleteAll()
                localDb.periodDao().insertAll(periods.map { it.toEntity() })
            }
            
            Result.success(periods)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get period slots from local DB
     */
    fun getPeriodSlots(dayOfWeek: Int?): Flow<List<PeriodSlot>> {
        return if (dayOfWeek != null) {
            localDb.periodDao().observeByDay(dayOfWeek)
        } else {
            localDb.periodDao().observeAll()
        }.map { entities -> entities.map { it.toModel() } }
    }
    
    // ========================================
    // 6. SYNC STATUS
    // ========================================
    
    /**
     * Check if timetable needs sync
     */
    suspend fun needsSync(): Boolean {
        val lastSync = localDb.syncDao().getLastSync("timetable")
        if (lastSync == null) return true
        
        val hoursSinceSync = (System.currentTimeMillis() - lastSync) / (1000 * 60 * 60)
        return hoursSinceSync >= 24 // Sync once per day
    }
    
    /**
     * Full sync (call on app launch)
     */
    suspend fun performFullSync(batchId: String): Result<String> {
        return try {
            val timetableCount = syncTimetable(batchId).getOrThrow()
            val subjectsCount = syncSubjects(batchId).getOrThrow()
            val periodsCount = syncPeriodTemplate().getOrThrow().size
            
            Result.success("Synced: $timetableCount events, $subjectsCount subjects, $periodsCount periods")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

// ========================================
// HELPER MODELS (for raw Supabase responses)
// ========================================

@Serializable
private data class StudentNode(
    val id: String,
    val name: String,
    val parent_id: String,
    val metadata: Map<String, String>
)

@Serializable
private data class Node(
    val id: String,
    val name: String,
    val parent_id: String?
)

@Serializable
private data class TimetableVersion(
    val id: String,
    val name: String,
    val published_at: String
)

@Serializable
private data class TimetableEventRaw(
    val id: String,
    val day_of_week: Int,
    val start_time: String,
    val end_time: String,
    val rooms: Room?,
    val course_offerings: CourseOffering
) {
    fun toEntity(batchId: String) = TimetableEventEntity(
        id = id,
        batchId = batchId,
        dayOfWeek = day_of_week,
        startTime = start_time,
        endTime = end_time,
        subjectCode = course_offerings.subjects.code,
        subjectName = course_offerings.subjects.name,
        subjectType = course_offerings.subjects.type,
        credits = course_offerings.subjects.credits,
        facultyName = course_offerings.faculty?.name,
        facultyAbbr = course_offerings.faculty?.abbr,
        roomNumber = rooms?.room_number
    )
}

@Serializable
private data class Room(val room_number: String)

@Serializable
private data class CourseOffering(
    val id: String,
    val subjects: Subject,
    val faculty: Faculty?
)

@Serializable
private data class Subject(
    val id: String,
    val code: String,
    val name: String,
    val type: String,
    val credits: Int
)

@Serializable
private data class Faculty(
    val name: String,
    val abbr: String
)

// ========================================
// USAGE EXAMPLE IN VIEWMODEL
// ========================================

@HiltViewModel
class TimetableViewModel @Inject constructor(
    private val repository: TimetableRepository
) : ViewModel() {
    
    private val _batchId = MutableStateFlow<String?>(null)
    
    // Observe today's timetable
    val todayTimetable: StateFlow<List<TimetableEvent>> = _batchId
        .flatMapLatest { batchId ->
            if (batchId != null) {
                val today = Calendar.getInstance().get(Calendar.DAY_OF_WEEK)
                val dayOfWeek = when (today) {
                    Calendar.MONDAY -> 1
                    Calendar.TUESDAY -> 2
                    Calendar.WEDNESDAY -> 3
                    Calendar.THURSDAY -> 4
                    Calendar.FRIDAY -> 5
                    Calendar.SATURDAY -> 6
                    else -> 1
                }
                repository.getTimetableForDay(batchId, dayOfWeek)
            } else {
                flowOf(emptyList())
            }
        }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())
    
    // Observe current lecture
    val currentLecture: StateFlow<TimetableEvent?> = _batchId
        .flatMapLatest { batchId ->
            if (batchId != null) {
                repository.getCurrentLecture(batchId)
            } else {
                flowOf(null)
            }
        }
        .stateIn(viewModelScope, SharingStarted.Lazily, null)
    
    // Initialize with roll number
    fun initialize(rollNumber: String) {
        viewModelScope.launch {
            val result = repository.findBatchByRollNumber(rollNumber)
            if (result.isSuccess) {
                _batchId.value = result.getOrNull()?.batch_id
                syncIfNeeded()
            }
        }
    }
    
    // Sync data if needed
    private fun syncIfNeeded() {
        viewModelScope.launch {
            val batchId = _batchId.value ?: return@launch
            if (repository.needsSync()) {
                repository.performFullSync(batchId)
            }
        }
    }
    
    // Manual refresh
    fun refresh() {
        viewModelScope.launch {
            val batchId = _batchId.value ?: return@launch
            repository.performFullSync(batchId)
        }
    }
}

// ========================================
// USAGE IN COMPOSE UI
// ========================================

@Composable
fun TimetableScreen(
    viewModel: TimetableViewModel = hiltViewModel()
) {
    val todayTimetable by viewModel.todayTimetable.collectAsState()
    val currentLecture by viewModel.currentLecture.collectAsState()
    
    Column {
        // Current lecture card
        currentLecture?.let { lecture ->
            CurrentLectureCard(lecture)
        }
        
        // Today's full schedule
        LazyColumn {
            items(todayTimetable) { event ->
                TimetableEventCard(event)
            }
        }
    }
}
