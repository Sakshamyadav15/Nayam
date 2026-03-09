"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Search, Filter, ChevronLeft, ChevronRight, Brain, MapPin, Clock, Loader2, Plus, X, Mic, MicOff, Send, Languages, Volume2, ArrowRightLeft } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/nayam/status-badge"
import { useApiData } from "@/hooks/use-api-data"
import { fetchIssues, fetchCitizens, createIssue, bhashiniASR, bhashiniTranslate, bhashiniTTS } from "@/lib/services"
import type { Issue, Citizen } from "@/lib/types"

export default function IssuesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null)

  // ── Create Issue State ─────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createCitizenId, setCreateCitizenId] = useState("")
  const [createDept, setCreateDept] = useState("Public Works")
  const [createDesc, setCreateDesc] = useState("")
  const [createPriority, setCreatePriority] = useState("Medium")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState("")

  // ── Voice Recording State ──────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [voiceLang, setVoiceLang] = useState("hi")
  const [isTranslating, setIsTranslating] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // ── Detail TTS / Translate State ───────────────────
  const [detailTtsLang, setDetailTtsLang] = useState("hi")
  const [detailTtsGender, setDetailTtsGender] = useState<"male" | "female">("female")
  const [detailTtsLoading, setDetailTtsLoading] = useState(false)
  const [detailTtsAudio, setDetailTtsAudio] = useState<string | null>(null)
  const [detailTransLang, setDetailTransLang] = useState("hi")
  const [detailTransLoading, setDetailTransLoading] = useState(false)
  const [detailTransResult, setDetailTransResult] = useState<string | null>(null)

  const { data, isLoading, refetch } = useApiData(() => fetchIssues({ limit: 500 }), [])
  const allIssues: Issue[] = data?.issues || []

  // Fetch citizens for dropdown
  const [citizens, setCitizens] = useState<Citizen[]>([])
  useEffect(() => {
    fetchCitizens({ limit: 200 }).then((r) => setCitizens(r.citizens || [])).catch(() => {})
  }, [])

  const departments = useMemo(() => [...new Set(allIssues.map((i) => i.department))], [allIssues])
  const statuses = useMemo(() => [...new Set(allIssues.map((i) => i.status))], [allIssues])

  const filtered = allIssues.filter((i) => {
    const matchSearch =
      i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.citizenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchDept = !departmentFilter || i.department === departmentFilter
    const matchStatus = !statusFilter || i.status === statusFilter
    const matchPriority = !priorityFilter || i.priority === priorityFilter
    return matchSearch && matchDept && matchStatus && matchPriority
  })

  const issue = selectedIssue ? allIssues.find((i) => i.id === selectedIssue) : null

  // ── Detail: Text-to-Speech ─────────────────────────
  const handleDetailTTS = async () => {
    if (!issue) return
    setDetailTtsLoading(true)
    setDetailTtsAudio(null)
    try {
      const res = await bhashiniTTS({
        text: issue.description,
        source_language: detailTtsLang,
        gender: detailTtsGender,
      })
      setDetailTtsAudio(`data:audio/wav;base64,${res.audio_base64}`)
    } catch { /* ignore */ } finally {
      setDetailTtsLoading(false)
    }
  }

  // ── Detail: Translate ──────────────────────────────
  const handleDetailTranslate = async () => {
    if (!issue) return
    setDetailTransLoading(true)
    setDetailTransResult(null)
    try {
      const res = await bhashiniTranslate({
        text: issue.description,
        source_language: "en",
        target_language: detailTransLang,
      })
      setDetailTransResult(res.translated_text)
    } catch { /* ignore */ } finally {
      setDetailTransLoading(false)
    }
  }

  // ── Voice Recording ────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        if (audioBlob.size < 100) return
        setIsProcessingVoice(true)
        try {
          const result = await bhashiniASR(audioBlob, voiceLang)
          const transcript = result.transcript || ""
          if (transcript.trim().length < 3) {
            setCreateError("Could not transcribe audio. Please try again.")
          } else {
            setCreateDesc(transcript)
            setCreateError("")
          }
        } catch (err) {
          setCreateError(err instanceof Error ? err.message : "Voice transcription failed")
        } finally {
          setIsProcessingVoice(false)
        }
      }
      recorder.start()
      setIsRecording(true)
    } catch {
      setCreateError("Microphone access denied.")
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  // ── Translate to English ───────────────────────────
  const handleTranslateToEnglish = async () => {
    if (!createDesc.trim() || voiceLang === "en") return
    setIsTranslating(true)
    try {
      const result = await bhashiniTranslate({
        text: createDesc,
        source_language: voiceLang,
        target_language: "en",
      })
      setCreateDesc(result.translated_text)
      setCreateError("")
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Translation failed")
    } finally {
      setIsTranslating(false)
    }
  }

  // ── Submit Issue ───────────────────────────────────
  const handleCreateIssue = async () => {
    if (!createCitizenId || !createDesc.trim()) return
    setIsCreating(true)
    setCreateError("")
    setCreateSuccess("")
    try {
      await createIssue({
        citizen_id: createCitizenId,
        department: createDept,
        description: createDesc.trim(),
        priority: createPriority,
      })
      setCreateSuccess("Issue created successfully!")
      setCreateDesc("")
      setCreateDept("Public Works")
      setCreatePriority("Medium")
      setCreateCitizenId("")
      refetch()
      setTimeout(() => { setShowCreate(false); setCreateSuccess("") }, 1500)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create issue")
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">
            Issues
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Advanced issue tracking and management
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[5px_5px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Issue
        </button>
      </div>

      {/* ── Create Issue Form (with Voice + Bhashini) ─── */}
      {showCreate && (
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              New Issue — Voice or Text in Any Language
            </p>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Citizen Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Citizen *</label>
              <select
                value={createCitizenId}
                onChange={(e) => setCreateCitizenId(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select citizen...</option>
                {citizens.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — Ward {c.ward}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</label>
              <select
                value={createDept}
                onChange={(e) => setCreateDept(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Public Works">Public Works</option>
                <option value="Water Supply">Water Supply</option>
                <option value="Electricity">Electricity</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Revenue">Revenue</option>
                <option value="Education">Education</option>
                <option value="Health">Health</option>
                <option value="Transport">Transport</option>
                <option value="Housing">Housing</option>
                <option value="General Administration">General Administration</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Priority</label>
              <select
                value={createPriority}
                onChange={(e) => setCreatePriority(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            {/* Language + Voice Record */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Voice Language</label>
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                  className="flex-1 border-2 border-foreground bg-background px-2 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="hi">Hindi</option>
                  <option value="en">English</option>
                  <option value="bn">Bengali</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="mr">Marathi</option>
                  <option value="gu">Gujarati</option>
                  <option value="kn">Kannada</option>
                  <option value="ml">Malayalam</option>
                  <option value="pa">Punjabi</option>
                  <option value="or">Odia</option>
                  <option value="ur">Urdu</option>
                </select>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessingVoice}
                  className={`flex items-center justify-center h-[38px] w-[38px] border-2 ${
                    isRecording ? "border-red-600 bg-red-600 text-white animate-pulse" : "border-foreground bg-orange-600 text-white"
                  } disabled:opacity-50`}
                  title={isRecording ? "Stop recording" : "Record voice issue"}
                >
                  {isProcessingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Description * {isProcessingVoice && "(transcribing...)"}
              </label>
              {voiceLang !== "en" && createDesc.trim() && (
                <button
                  onClick={handleTranslateToEnglish}
                  disabled={isTranslating}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  <Languages className="h-3 w-3" />
                  {isTranslating ? "Translating..." : "Translate to English"}
                </button>
              )}
            </div>
            <textarea
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              rows={3}
              placeholder="Type or record issue description in any language..."
              className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          {createError && <p className="text-xs text-red-600 font-bold">{createError}</p>}
          {createSuccess && <p className="text-xs text-green-600 font-bold">{createSuccess}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateIssue}
              disabled={isCreating || !createCitizenId || !createDesc.trim()}
              className="flex items-center gap-2 border-2 border-foreground bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-colors hover:bg-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {isCreating ? "Creating..." : "Create Issue"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="border-2 border-foreground/50 bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center border-2 border-foreground bg-card px-3 py-2 flex-1 max-w-md">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border-3 border-foreground bg-card shadow-[4px_4px_0px_0px] shadow-foreground/20">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground bg-muted/50">
              <TableHead className="text-xs font-black uppercase tracking-widest">Issue ID</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Citizen</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Department</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Priority</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Ward</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Risk</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Date</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => (
              <TableRow key={i.id} className="border-b border-foreground/10">
                <TableCell className="font-mono text-sm font-bold text-foreground">{i.id}</TableCell>
                <TableCell className="text-sm font-semibold text-foreground">{i.citizenName}</TableCell>
                <TableCell className="text-sm text-foreground">{i.department}</TableCell>
                <TableCell>
                  <StatusBadge status={i.status} variant="status" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={i.priority} variant="priority" />
                </TableCell>
                <TableCell className="text-sm font-semibold text-foreground">{i.ward}</TableCell>
                <TableCell>
                  <span
                    className={`text-sm font-black ${
                      i.riskScore >= 80
                        ? "text-red-700"
                        : i.riskScore >= 60
                        ? "text-orange-700"
                        : i.riskScore >= 40
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {i.riskScore}
                  </span>
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">{i.createdDate}</TableCell>
                <TableCell>
                  <button
                    onClick={() => setSelectedIssue(i.id)}
                    className="border-2 border-foreground bg-background px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-foreground hover:text-background"
                  >
                    Detail
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t-2 border-foreground px-4 py-3">
          <p className="text-xs font-bold text-muted-foreground">
            Showing {filtered.length} of {allIssues.length} issues
          </p>
          <div className="flex items-center gap-2">
            <button className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-background text-foreground transition-colors hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-foreground text-xs font-bold text-background">
              1
            </span>
            <button className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-background text-foreground transition-colors hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Issue Detail Modal */}
      <Dialog open={!!selectedIssue} onOpenChange={() => { setSelectedIssue(null); setDetailTtsAudio(null); setDetailTransResult(null) }}>
        <DialogContent className="border-3 border-foreground rounded-none shadow-[8px_8px_0px_0px] shadow-foreground/20 sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              Issue Detail {issue?.id}
            </DialogTitle>
          </DialogHeader>
          {issue && (
            <div className="space-y-4">
              {/* Status Row */}
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={issue.status} />
                <StatusBadge status={issue.priority} variant="priority" />
                <span className="text-xs font-mono text-muted-foreground">
                  Risk Score: <span className="font-black text-foreground">{issue.riskScore}</span>
                </span>
              </div>

              {/* Description */}
              <div className="border-2 border-foreground p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</p>
                <p className="mt-2 text-sm text-foreground leading-relaxed">{issue.description}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Citizen</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{issue.citizenName}</p>
                </div>
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{issue.department}</p>
                </div>
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ward</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{issue.ward}</p>
                </div>
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created</p>
                  <p className="mt-1 text-sm font-mono text-foreground">{issue.createdDate}</p>
                </div>
              </div>

              {/* AI Suggested Actions */}
              <div className="border-2 border-foreground border-l-4 border-l-blue-700 p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-700" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">AI Suggested Actions</p>
                </div>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-start gap-2 text-xs text-foreground">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 bg-blue-700" />
                    Escalate to department head for immediate resource allocation
                  </li>
                  <li className="flex items-start gap-2 text-xs text-foreground">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 bg-blue-700" />
                    Cross-reference with similar historical patterns in adjacent wards
                  </li>
                  <li className="flex items-start gap-2 text-xs text-foreground">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 bg-blue-700" />
                    Schedule follow-up inspection within 72 hours
                  </li>
                </ul>
              </div>

              {/* Geo & Timeline */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border-2 border-foreground p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</p>
                  </div>
                  <p className="text-sm text-foreground">{issue.ward}, Block A, Sector 7</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">28.6139N, 77.2090E</p>
                </div>
                <div className="border-2 border-foreground p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timeline</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">{issue.createdDate}</span>
                      <span className="font-semibold text-foreground">Issue created</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">2026-02-22</span>
                      <span className="font-semibold text-foreground">Assigned to department</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">2026-02-25</span>
                      <span className="font-semibold text-foreground">AI analysis completed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bhashini: TTS + Translate */}
              <div className="border-2 border-foreground border-l-4 border-l-orange-600 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Bhashini Language Tools</p>

                <div className="flex flex-wrap items-end gap-3">
                  {/* TTS */}
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Speak in</label>
                      <select value={detailTtsLang} onChange={(e) => setDetailTtsLang(e.target.value)} className="mt-0.5 block w-24 border border-foreground/50 bg-background px-2 py-1 text-xs">
                        <option value="hi">Hindi</option>
                        <option value="en">English</option>
                        <option value="bn">Bengali</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                        <option value="mr">Marathi</option>
                        <option value="gu">Gujarati</option>
                        <option value="kn">Kannada</option>
                        <option value="ml">Malayalam</option>
                        <option value="pa">Punjabi</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Voice</label>
                      <select value={detailTtsGender} onChange={(e) => setDetailTtsGender(e.target.value as "male" | "female")} className="mt-0.5 block w-20 border border-foreground/50 bg-background px-2 py-1 text-xs">
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </div>
                    <button onClick={handleDetailTTS} disabled={detailTtsLoading} className="flex items-center gap-1.5 border-2 border-foreground bg-orange-600 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-orange-700 disabled:opacity-50">
                      {detailTtsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                      Speak
                    </button>
                  </div>

                  {/* Translate */}
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Translate to</label>
                      <select value={detailTransLang} onChange={(e) => setDetailTransLang(e.target.value)} className="mt-0.5 block w-24 border border-foreground/50 bg-background px-2 py-1 text-xs">
                        <option value="hi">Hindi</option>
                        <option value="bn">Bengali</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                        <option value="mr">Marathi</option>
                        <option value="gu">Gujarati</option>
                        <option value="kn">Kannada</option>
                        <option value="ml">Malayalam</option>
                        <option value="pa">Punjabi</option>
                        <option value="or">Odia</option>
                        <option value="ur">Urdu</option>
                      </select>
                    </div>
                    <button onClick={handleDetailTranslate} disabled={detailTransLoading} className="flex items-center gap-1.5 border-2 border-foreground bg-blue-600 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-blue-700 disabled:opacity-50">
                      {detailTransLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />}
                      Translate
                    </button>
                  </div>
                </div>
                {detailTtsAudio && (
                  <audio controls src={detailTtsAudio} className="w-full mt-2" />
                )}
                {detailTransResult && (
                  <div className="mt-2 border border-foreground/30 bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Translation</p>
                    <p className="text-sm text-foreground leading-relaxed">{detailTransResult}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
