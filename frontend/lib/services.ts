/**
 * NAYAM — API Service Functions
 *
 * Each function maps to a backend endpoint and handles
 * the data transformation from backend schema → frontend type.
 */

import { api } from "./api"
import type {
  TokenResponse,
  CitizenListResponse,
  CitizenBackend,
  Citizen,
  IssueListResponse,
  IssueBackend,
  Issue,
  DocumentListResponse,
  DocumentBackend,
  Document,
  DashboardResponse,
  AgentInfo,
  AgentQueryResponse,
  ActionRequestListResponse,
  ActionRequestBackend,
  Approval,
  HealthProbeResponse,
  MetricListResponse,
  TranscribeResponse,
  TranscribeAndClassifyResponse,
  TranscribeAndIngestResponse,
  NotificationsResponse,
  EventListResponse,
  EventBackend,
  EventCreateRequest,
  EventUpdateRequest,
  DraftListResponse,
  DraftBackend,
  DraftGenerateRequest,
  DraftUpdateRequest,
  BhashiniASRResponse,
  BhashiniTTSRequest,
  BhashiniTTSResponse,
  BhashiniTranslationRequest,
  BhashiniTranslationResponse,
  BhashiniASRTranslateResponse,
  BhashiniLanguagesResponse,
  BhashiniHealthResponse,
  BhashiniClassifyResponse,
  BhashiniSummarizeResponse,
} from "./types"

// ═══════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════

export async function login(email: string, password: string): Promise<TokenResponse> {
  return api.post<TokenResponse>("/auth/login", { email, password })
}

export async function register(
  name: string,
  email: string,
  password: string,
  role: string = "Staff"
): Promise<TokenResponse> {
  return api.post<TokenResponse>("/auth/register", { name, email, password, role })
}

// ═══════════════════════════════════════════════════════════════════════
// Citizens
// ═══════════════════════════════════════════════════════════════════════

function mapCitizen(c: CitizenBackend, issueCount: number = 0): Citizen {
  return {
    id: c.id,
    name: c.name,
    contact: c.contact_number,
    ward: c.ward,
    activeIssues: issueCount,
    riskLevel: issueCount >= 4 ? "critical" : issueCount >= 2 ? "high" : issueCount >= 1 ? "medium" : "low",
  }
}

export async function fetchCitizens(params?: {
  skip?: number
  limit?: number
  ward?: string
  search?: string
}): Promise<{ total: number; citizens: Citizen[] }> {
  const data = await api.get<CitizenListResponse>("/citizens", params as Record<string, string>)

  // Fetch issue counts per citizen (batch via issues endpoint)
  const issueData = await api.get<IssueListResponse>("/issues", { limit: 500 })
  const countMap: Record<string, number> = {}
  for (const issue of issueData.issues) {
    if (issue.status !== "Closed") {
      countMap[issue.citizen_id] = (countMap[issue.citizen_id] || 0) + 1
    }
  }

  return {
    total: data.total,
    citizens: data.citizens.map((c) => mapCitizen(c, countMap[c.id] || 0)),
  }
}

export async function createCitizen(payload: {
  name: string
  contact_number: string
  ward: string
}): Promise<CitizenBackend> {
  return api.post<CitizenBackend>("/citizens", payload)
}

// ═══════════════════════════════════════════════════════════════════════
// Issues
// ═══════════════════════════════════════════════════════════════════════

const statusMap: Record<string, Issue["status"]> = {
  Open: "open",
  "In Progress": "in-progress",
  Closed: "resolved",
}

const priorityMap: Record<string, Issue["priority"]> = {
  Low: "low",
  Medium: "medium",
  High: "high",
}

function mapIssue(i: IssueBackend, citizenName: string = "Unknown"): Issue {
  const priorityScore = { Low: 20, Medium: 50, High: 80 }
  return {
    id: i.id,
    citizenName,
    department: i.department,
    status: statusMap[i.status] || "open",
    priority: priorityMap[i.priority] || "medium",
    ward: "",
    riskScore: priorityScore[i.priority] || 50,
    createdDate: i.created_at.split("T")[0],
    description: i.description,
  }
}

export async function fetchIssues(params?: {
  skip?: number
  limit?: number
  status?: string
  priority?: string
  department?: string
  ward?: string
}): Promise<{ total: number; issues: Issue[] }> {
  // Map frontend status values to backend enum values
  const backendParams: Record<string, string | number | undefined> = {
    skip: params?.skip,
    limit: params?.limit,
    department: params?.department,
  }

  if (params?.status) {
    const reverseStatusMap: Record<string, string> = {
      open: "Open",
      "in-progress": "In Progress",
      resolved: "Closed",
    }
    backendParams.status = reverseStatusMap[params.status] || params.status
  }

  if (params?.priority) {
    const reversePriorityMap: Record<string, string> = {
      low: "Low",
      medium: "Medium",
      high: "High",
    }
    backendParams.priority = reversePriorityMap[params.priority] || params.priority
  }

  const data = await api.get<IssueListResponse>("/issues", backendParams as Record<string, string>)

  // Fetch citizen names for display
  const citizenIds = [...new Set(data.issues.map((i) => i.citizen_id))]
  const citizenNames: Record<string, string> = {}
  const citizenData = await api.get<CitizenListResponse>("/citizens", { limit: 200 })
  for (const c of citizenData.citizens) {
    citizenNames[c.id] = c.name
  }

  // Get citizen wards
  const citizenWards: Record<string, string> = {}
  for (const c of citizenData.citizens) {
    citizenWards[c.id] = c.ward
  }

  return {
    total: data.total,
    issues: data.issues.map((i) => {
      const issue = mapIssue(i, citizenNames[i.citizen_id] || "Unknown Citizen")
      issue.ward = citizenWards[i.citizen_id] || "N/A"
      return issue
    }),
  }
}

export async function createIssue(payload: {
  citizen_id: string
  department: string
  description: string
  priority?: string
}): Promise<IssueBackend> {
  return api.post<IssueBackend>("/issues", payload)
}

// ═══════════════════════════════════════════════════════════════════════
// Documents
// ═══════════════════════════════════════════════════════════════════════

function mapDocument(d: DocumentBackend): Document {
  const hasHighRisk = d.summary?.toLowerCase().includes("critical") || d.summary?.toLowerCase().includes("risk")
  return {
    id: d.id,
    title: d.title,
    uploadedBy: d.uploaded_by || "System",
    date: d.created_at.split("T")[0],
    aiSummary: d.summary || "No summary available.",
    riskRelevance: hasHighRisk ? "high" : d.summary ? "medium" : "low",
  }
}

export async function fetchDocuments(params?: {
  skip?: number
  limit?: number
}): Promise<{ total: number; documents: Document[] }> {
  const data = await api.get<DocumentListResponse>("/documents", params as Record<string, string>)
  return {
    total: data.total,
    documents: data.documents.map(mapDocument),
  }
}

export async function uploadDocument(title: string, file: File): Promise<DocumentBackend> {
  const formData = new FormData()
  formData.append("title", title)
  formData.append("file", file)
  return api.upload<DocumentBackend>("/documents/upload", formData)
}

// ═══════════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════════

export async function fetchDashboard(): Promise<DashboardResponse> {
  return api.get<DashboardResponse>("/dashboard")
}

// ═══════════════════════════════════════════════════════════════════════
// Intelligence (Agent)
// ═══════════════════════════════════════════════════════════════════════

export async function fetchAgents(): Promise<AgentInfo[]> {
  const data = await api.get<{ agents: AgentInfo[] }>("/agent/agents")
  return data.agents
}

export async function sendAgentQuery(
  query: string,
  sessionId?: string,
  agentName?: string
): Promise<AgentQueryResponse> {
  return api.post<AgentQueryResponse>("/agent/query", {
    query,
    session_id: sessionId || null,
    agent_name: agentName || null,
    metadata: {},
  })
}

// ═══════════════════════════════════════════════════════════════════════
// Approvals (Actions)
// ═══════════════════════════════════════════════════════════════════════

function mapApproval(a: ActionRequestBackend): Approval {
  // Extract issue ref from description (ISS-xxxx format, hex or digits)
  const issueRef = a.description.match(/ISS-[a-f0-9]+/i)?.[0] || a.session_id
  // Derive confidence from agent name for variety
  const confidenceMap: Record<string, number> = {
    PolicyAgent: 91,
    CitizenAgent: 86,
    OperationsAgent: 88,
  }
  return {
    id: a.id,
    action: a.action_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    aiConfidence: confidenceMap[a.agent_name] || 85,
    linkedIssue: issueRef,
    timestamp: a.created_at.replace("T", " ").slice(0, 16),
    summary: a.description,
    status: a.status === "expired" ? "rejected" : a.status,
  }
}

export async function fetchPendingApprovals(): Promise<Approval[]> {
  const data = await api.get<ActionRequestListResponse>("/actions/pending")
  return data.actions.map(mapApproval)
}

export async function fetchAllApprovals(): Promise<Approval[]> {
  const data = await api.get<ActionRequestListResponse>("/actions")
  return data.actions.map(mapApproval)
}

export async function reviewAction(
  actionId: string,
  status: "approved" | "rejected",
  reviewNote?: string
): Promise<void> {
  await api.post(`/actions/${actionId}/review`, {
    status,
    review_note: reviewNote || null,
  })
}

// ═══════════════════════════════════════════════════════════════════════
// Compliance
// ═══════════════════════════════════════════════════════════════════════

export async function fetchComplianceExports(params?: { skip?: number; limit?: number }) {
  return api.get<{ total: number; exports: unknown[] }>("/compliance/exports", params as Record<string, string>)
}

// ═══════════════════════════════════════════════════════════════════════
// Monitoring
// ═══════════════════════════════════════════════════════════════════════

export async function fetchHealthDeep(): Promise<HealthProbeResponse> {
  return api.get<HealthProbeResponse>("/monitoring/health/deep")
}

export async function fetchMetrics(params?: { category?: string; limit?: number }) {
  return api.get<MetricListResponse>("/monitoring/metrics", params as Record<string, string>)
}

// ═══════════════════════════════════════════════════════════════════════
// Speech-to-Text (STT)
// ═══════════════════════════════════════════════════════════════════════

/** Transcribe audio to text only (no entity creation). */
export async function transcribeAudio(audioBlob: Blob, filename?: string): Promise<TranscribeResponse> {
  const formData = new FormData()
  formData.append("file", audioBlob, filename || "recording.webm")
  return api.upload<TranscribeResponse>("/stt/transcribe", formData)
}

/** Transcribe + classify content (no entity creation). */
export async function transcribeAndClassify(audioBlob: Blob, filename?: string): Promise<TranscribeAndClassifyResponse> {
  const formData = new FormData()
  formData.append("file", audioBlob, filename || "recording.webm")
  return api.upload<TranscribeAndClassifyResponse>("/stt/classify", formData)
}

/** Full pipeline: transcribe → classify → route → create entity → RAG index. */
export async function transcribeAndIngest(
  audioBlob: Blob,
  filename?: string,
  sessionId?: string,
): Promise<TranscribeAndIngestResponse> {
  const formData = new FormData()
  formData.append("file", audioBlob, filename || "recording.webm")
  if (sessionId) formData.append("session_id", sessionId)
  return api.upload<TranscribeAndIngestResponse>("/stt/ingest", formData)
}

// ═══════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return api.get<NotificationsResponse>("/notifications")
}

// ═══════════════════════════════════════════════════════════════════════
// Schedule / Events
// ═══════════════════════════════════════════════════════════════════════

export async function fetchEvents(params?: {
  skip?: number
  limit?: number
  status?: string
  event_type?: string
  department?: string
}): Promise<EventListResponse> {
  return api.get<EventListResponse>("/schedule", params as Record<string, string>)
}

export async function fetchUpcomingEvents(limit: number = 10): Promise<EventListResponse> {
  return api.get<EventListResponse>("/schedule/upcoming/list", { limit } as Record<string, string>)
}

export async function createEvent(payload: EventCreateRequest): Promise<EventBackend> {
  return api.post<EventBackend>("/schedule", payload)
}

export async function updateEvent(id: string, payload: EventUpdateRequest): Promise<EventBackend> {
  return api.patch<EventBackend>(`/schedule/${id}`, payload)
}

export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/schedule/${id}`)
}

// ═══════════════════════════════════════════════════════════════════════
// Drafts / Speech Generation
// ═══════════════════════════════════════════════════════════════════════

export async function generateDraft(payload: DraftGenerateRequest): Promise<DraftBackend> {
  return api.post<DraftBackend>("/drafts/generate", payload)
}

export async function fetchDrafts(params?: {
  skip?: number
  limit?: number
  draft_type?: string
  status?: string
  department?: string
}): Promise<DraftListResponse> {
  return api.get<DraftListResponse>("/drafts", params as Record<string, string>)
}

export async function getDraft(id: string): Promise<DraftBackend> {
  return api.get<DraftBackend>(`/drafts/${id}`)
}

export async function updateDraft(id: string, payload: DraftUpdateRequest): Promise<DraftBackend> {
  return api.patch<DraftBackend>(`/drafts/${id}`, payload)
}

export async function deleteDraft(id: string): Promise<void> {
  await api.delete(`/drafts/${id}`)
}

// ═══════════════════════════════════════════════════════════════════════
// Bhashini (Gov India AI Language Services)
// ═══════════════════════════════════════════════════════════════════════

export async function bhashiniASR(
  audioBlob: Blob,
  sourceLanguage: string = "hi",
  enableVad: boolean = true,
  enableItn: boolean = true,
  enablePunctuation: boolean = true,
): Promise<BhashiniASRResponse> {
  const formData = new FormData()
  formData.append("file", audioBlob, "recording.webm")
  formData.append("source_language", sourceLanguage)
  formData.append("enable_vad", String(enableVad))
  formData.append("enable_itn", String(enableItn))
  formData.append("enable_punctuation", String(enablePunctuation))
  return api.upload<BhashiniASRResponse>("/bhashini/asr", formData)
}

export async function bhashiniTTS(payload: BhashiniTTSRequest): Promise<BhashiniTTSResponse> {
  return api.post<BhashiniTTSResponse>("/bhashini/tts", payload)
}

export async function bhashiniTranslate(
  payload: BhashiniTranslationRequest,
): Promise<BhashiniTranslationResponse> {
  return api.post<BhashiniTranslationResponse>("/bhashini/translate", payload)
}

export async function bhashiniClassifyText(text: string): Promise<BhashiniClassifyResponse> {
  return api.post<BhashiniClassifyResponse>("/bhashini/classify-text", { text })
}

export async function bhashiniSummarize(text: string): Promise<BhashiniSummarizeResponse> {
  return api.post<BhashiniSummarizeResponse>("/bhashini/summarize", { text })
}

export async function bhashiniASRTranslate(
  audioBlob: Blob,
  sourceLanguage: string = "hi",
  targetLanguage: string = "en",
): Promise<BhashiniASRTranslateResponse> {
  const formData = new FormData()
  formData.append("file", audioBlob, "recording.webm")
  formData.append("source_language", sourceLanguage)
  formData.append("target_language", targetLanguage)
  return api.upload<BhashiniASRTranslateResponse>("/bhashini/asr-translate", formData)
}

export async function bhashiniLanguages(): Promise<BhashiniLanguagesResponse> {
  return api.get<BhashiniLanguagesResponse>("/bhashini/languages")
}

export async function bhashiniHealth(): Promise<BhashiniHealthResponse> {
  return api.get<BhashiniHealthResponse>("/bhashini/health")
}
