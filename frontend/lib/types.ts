/**
 * NAYAM — TypeScript interfaces matching the FastAPI backend schemas.
 *
 * These types mirror the Pydantic response models from the backend
 * and extend them with frontend-specific computed fields.
 */

// ── Auth ────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  role: "leader" | "staff" | "analyst"
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

// ── Citizens ────────────────────────────────────────────────────────
export interface CitizenBackend {
  id: string
  name: string
  contact_number: string
  ward: string
  created_at: string
}

export interface CitizenListResponse {
  total: number
  citizens: CitizenBackend[]
}

/** Frontend-enriched citizen for display */
export interface Citizen {
  id: string
  name: string
  contact: string
  ward: string
  activeIssues: number
  riskLevel: "low" | "medium" | "high" | "critical"
}

// ── Issues ──────────────────────────────────────────────────────────
export interface IssueBackend {
  id: string
  citizen_id: string
  department: string
  description: string
  status: "Open" | "In Progress" | "Closed"
  priority: "Low" | "Medium" | "High"
  latitude: number | null
  longitude: number | null
  location_description: string | null
  created_at: string
  updated_at: string
}

export interface IssueListResponse {
  total: number
  issues: IssueBackend[]
}

/** Frontend-enriched issue for display */
export interface Issue {
  id: string
  citizenName: string
  department: string
  status: "open" | "in-progress" | "resolved" | "escalated"
  priority: "low" | "medium" | "high" | "critical"
  ward: string
  riskScore: number
  createdDate: string
  description: string
}

// ── Documents ───────────────────────────────────────────────────────
export interface DocumentBackend {
  id: string
  title: string
  uploaded_by: string | null
  file_path: string
  extracted_text: string | null
  summary: string | null
  created_at: string
}

export interface DocumentListResponse {
  total: number
  documents: DocumentBackend[]
}

export interface Document {
  id: string
  title: string
  uploadedBy: string
  date: string
  aiSummary: string
  riskRelevance: "low" | "medium" | "high"
}

// ── Dashboard ───────────────────────────────────────────────────────
export interface DepartmentCount {
  department: string
  count: number
}

export interface StatusCount {
  status: string
  count: number
}

export interface DashboardResponse {
  total_issues: number
  issues_by_department: DepartmentCount[]
  issues_by_status: StatusCount[]
  total_documents: number
  recent_documents: { id: string; title: string; uploaded_by: string | null; created_at: string }[]
}

// ── Agent / Intelligence ────────────────────────────────────────────
export interface AgentInfo {
  name: string
  description: string
}

export interface AgentQueryResponse {
  session_id: string
  agent_name: string
  response: string
  confidence: number
  suggested_actions: Record<string, unknown>[]
  pending_actions: { id: string; action_type: string; description: string; status: string }[]
  metadata: Record<string, unknown>
}

// ── Actions / Approvals ─────────────────────────────────────────────
export interface ActionRequestBackend {
  id: string
  session_id: string
  agent_name: string
  action_type: string
  description: string
  payload: Record<string, unknown>
  status: "pending" | "approved" | "rejected" | "expired"
  requested_by: string
  reviewed_by: string | null
  review_note: string | null
  created_at: string
  reviewed_at: string | null
}

export interface ActionRequestListResponse {
  total: number
  actions: ActionRequestBackend[]
}

/** Frontend approval shape */
export interface Approval {
  id: string
  action: string
  aiConfidence: number
  linkedIssue: string
  linkedDocument?: string
  timestamp: string
  summary: string
  status: "pending" | "approved" | "rejected"
}

// ── Audit / Compliance ──────────────────────────────────────────────
export interface AuditLog {
  id: string
  action: string
  user: string
  timestamp: string
  details: string
  type: "access" | "modification" | "approval" | "system"
}

// ── Monitoring ──────────────────────────────────────────────────────
export interface HealthProbeResponse {
  status: string
  db_connected: boolean
  db_latency_ms: number | null
  total_metrics: number | null
  performance_tracking_enabled: boolean | null
  error: string | null
}

export interface MetricBackend {
  id: string
  category: string
  endpoint: string | null
  method: string | null
  value: number
  unit: string
  status_code: number | null
  node_id: string | null
  metadata_json: Record<string, unknown> | null
  recorded_at: string
}

export interface MetricListResponse {
  total: number
  metrics: MetricBackend[]
}

// ── AI Insight (frontend-only, derived from agent) ──────────────────
export interface AIInsight {
  id: string
  title: string
  description: string
  confidence: number
  type: "recommendation" | "alert" | "prediction"
  timestamp: string
}

// ── Speech-to-Text ──────────────────────────────────────────────────

export type ContentCategory =
  | "policy_document"
  | "citizen_issue"
  | "meeting_minutes"
  | "field_report"
  | "general_query"

export interface ClassificationResult {
  category: ContentCategory
  confidence: number
  reasoning: string
  extracted_metadata: Record<string, unknown>
}

export interface TranscribeResponse {
  transcript: string
  language: string | null
  duration_seconds: number | null
  provider: string
}

export interface TranscribeAndClassifyResponse extends TranscribeResponse {
  classification: ClassificationResult
}

export interface IngestResult {
  category: ContentCategory
  created_type: "document" | "issue" | "agent_query"
  created_id: string | null
  title: string | null
  summary: string | null
  detail: string
}

export interface TranscribeAndIngestResponse extends TranscribeResponse {
  classification: ClassificationResult
  ingestion: IngestResult
}

// ── Notifications ───────────────────────────────────────────────────
export interface NotificationItem {
  id: string
  type: "critical_issue" | "pending_approval" | "new_document" | "system"
  title: string
  detail: string
  severity: "info" | "warning" | "critical"
  timestamp: string
  link: string | null
}

export interface NotificationsResponse {
  total: number
  items: NotificationItem[]
}

// ── Schedule / Events ───────────────────────────────────────────────
export type EventType =
  | "Meeting"
  | "Hearing"
  | "Site Visit"
  | "Deadline"
  | "Review"
  | "Public Event"
  | "Other"

export type EventStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled"

export type EventPriority = "Low" | "Medium" | "High"

export interface EventBackend {
  id: string
  title: string
  description: string | null
  event_type: EventType
  status: EventStatus
  priority: EventPriority
  start_time: string
  end_time: string
  location: string | null
  attendees: string | null
  department: string | null
  ward: string | null
  reminder_minutes: string | null
  is_all_day: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EventListResponse {
  total: number
  events: EventBackend[]
}

export interface EventCreateRequest {
  title: string
  description?: string
  event_type?: EventType
  priority?: EventPriority
  start_time: string
  end_time: string
  location?: string
  attendees?: string
  department?: string
  ward?: string
  reminder_minutes?: string
  is_all_day?: boolean
}

export interface EventUpdateRequest {
  title?: string
  description?: string
  event_type?: EventType
  status?: EventStatus
  priority?: EventPriority
  start_time?: string
  end_time?: string
  location?: string
  attendees?: string
  department?: string
  ward?: string
}

// ── Drafts / Speech Generation ──────────────────────────────────────
export type DraftType =
  | "SPEECH"
  | "OFFICIAL_RESPONSE"
  | "PRESS_RELEASE"
  | "POLICY_BRIEF"
  | "MEETING_AGENDA"
  | "PUBLIC_NOTICE"
  | "LETTER"
  | "RTI_RESPONSE"
  | "CIRCULAR"

export type DraftStatus = "GENERATING" | "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "PUBLISHED"

export interface DraftBackend {
  id: string
  title: string
  draft_type: DraftType
  status: DraftStatus
  content: string
  prompt_context: string | null
  tone: string | null
  audience: string | null
  department: string | null
  version: number
  extra_metadata: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DraftListResponse {
  total: number
  drafts: DraftBackend[]
}

export interface DraftGenerateRequest {
  draft_type: DraftType
  topic: string
  tone?: string
  audience?: string
  department?: string
  additional_context?: string
}

export interface DraftUpdateRequest {
  title?: string
  content?: string
  status?: DraftStatus
  tone?: string
  audience?: string
  department?: string
}

// ── Bhashini (Gov India AI Language Services) ───────────────────────

export interface BhashiniASRResponse {
  transcript: string
  source_language: string
  service_id: string
  provider: string
  success: boolean
}

export interface BhashiniTTSRequest {
  text: string
  source_language: string
  gender: "male" | "female"
  sampling_rate?: number
}

export interface BhashiniTTSResponse {
  audio_base64: string
  source_language: string
  service_id: string
  provider: string
  success: boolean
}

export interface BhashiniTranslationRequest {
  text: string
  source_language: string
  target_language: string
}

export interface BhashiniTranslationResponse {
  translated_text: string
  source_language: string
  target_language: string
  service_id: string
  provider: string
  success: boolean
}

export interface BhashiniASRTranslateResponse {
  transcript: string
  translated_text: string
  source_language: string
  target_language: string
  provider: string
  success: boolean
}

export interface BhashiniClassifyResponse {
  category: "question" | "issue" | "document"
  confidence: number
  reasoning: string
  extracted_metadata: Record<string, unknown>
  success: boolean
}

export interface BhashiniSummarizeResponse {
  summary: string
  key_points: string[]
  action_items: string[]
  departments_mentioned: string[]
  language_detected: string
  success: boolean
}

export interface BhashiniLanguagesResponse {
  asr_languages: string[]
  tts_languages: string[]
  translation_pairs: { source: string; target: string }[]
  provider: string
}

export interface BhashiniHealthResponse {
  service: string
  available: boolean
  detail: string
}
