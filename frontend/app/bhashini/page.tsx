"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Mic,
  Volume2,
  ArrowRightLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Play,
  Square,
  Brain,
  FileText,
  AlertTriangle,
  HelpCircle,
  X,
  Sparkles,
} from "lucide-react"
import {
  bhashiniASR,
  bhashiniTTS,
  bhashiniTranslate,
  bhashiniHealth,
  bhashiniClassifyText,
  bhashiniSummarize,
  createIssue,
  uploadDocument,
  sendAgentQuery,
  fetchCitizens,
} from "@/lib/services"
import type { Citizen } from "@/lib/types"

// ── Language catalogue ──────────────────────────────────────────────

const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "en", label: "English", native: "English" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "as", label: "Assamese", native: "অসমীয়া" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "sa", label: "Sanskrit", native: "संस्कृतम्" },
  { code: "mai", label: "Maithili", native: "मैथिली" },
  { code: "doi", label: "Dogri", native: "डोगरी" },
  { code: "ks", label: "Kashmiri", native: "كٲشُر" },
  { code: "kok", label: "Konkani", native: "कोंकणी" },
  { code: "mni", label: "Manipuri", native: "মৈতৈলোন্" },
  { code: "ne", label: "Nepali", native: "नेपाली" },
  { code: "sd", label: "Sindhi", native: "سنڌي" },
  { code: "sat", label: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "brx", label: "Bodo", native: "बड़ो" },
]

type TabType = "asr" | "tts" | "translate"

const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: "asr", label: "Voice Intelligence", icon: <Mic className="h-4 w-4" /> },
  { key: "tts", label: "Text to Speech", icon: <Volume2 className="h-4 w-4" /> },
  { key: "translate", label: "Translate", icon: <ArrowRightLeft className="h-4 w-4" /> },
]

// ═════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════

export default function BhashiniPage() {
  const [activeTab, setActiveTab] = useState<TabType>("asr")
  const [healthOk, setHealthOk] = useState<boolean | null>(null)

  useEffect(() => {
    bhashiniHealth()
      .then((r) => setHealthOk(r.available))
      .catch(() => setHealthOk(false))
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-primary p-1">
              <img src="/bhashini-logo.svg" alt="Bhashini" className="h-6 w-6 invert" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">
                Bhashini
              </h1>
              <p className="text-xs font-medium text-muted-foreground">
                Government of India AI Language Services — 22+ Indian Languages
              </p>
            </div>
          </div>
        </div>

        {/* Health indicator */}
        <div className="flex items-center gap-2 border-2 border-foreground px-3 py-1.5">
          {healthOk === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : healthOk ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-600" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {healthOk === null ? "Checking" : healthOk ? "Connected" : "Offline"}
          </span>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────── */}
      <div className="flex gap-1 border-2 border-foreground bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.key
                ? "border-2 border-foreground bg-primary text-primary-foreground shadow-[2px_2px_0px_0px] shadow-foreground/20"
                : "border-2 border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────── */}
      {activeTab === "asr" && <ASRTab />}
      {activeTab === "tts" && <TTSTab />}
      {activeTab === "translate" && <TranslateTab />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// ASR Tab — Voice Intelligence (Record → Transcribe → Classify → Act)
// ═════════════════════════════════════════════════════════════════════

function ASRTab() {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [sourceLang, setSourceLang] = useState("hi")
  const [provider, setProvider] = useState("")
  const [error, setError] = useState("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Classification state
  const [classifying, setClassifying] = useState(false)
  const [classification, setClassification] = useState<{
    category: string; confidence: number; reasoning: string; extracted_metadata: Record<string, unknown>
  } | null>(null)

  // Summarization state
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState<{
    summary: string; key_points: string[]; action_items: string[]; departments_mentioned: string[]
  } | null>(null)

  // Action state
  const [actioning, setActioning] = useState(false)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [agentAnswer, setAgentAnswer] = useState<string | null>(null)

  // Citizens for issue creation
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [selectedCitizenId, setSelectedCitizenId] = useState("")
  useEffect(() => {
    fetchCitizens({ limit: 200 }).then((r) => setCitizens(r.citizens)).catch(() => {})
  }, [])

  const startRecording = useCallback(async () => {
    try {
      setError("")
      setClassification(null)
      setSummary(null)
      setActionResult(null)
      setAgentAnswer(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        if (blob.size === 0) return
        setLoading(true)
        try {
          const res = await bhashiniASR(blob, sourceLang)
          setTranscript(res.transcript)
          setProvider(res.provider)
          // Auto-classify after transcription
          if (res.transcript.trim().length > 5) {
            setClassifying(true)
            try {
              const cls = await bhashiniClassifyText(res.transcript)
              setClassification(cls)
            } catch {
              /* classification optional */
            }
            setClassifying(false)
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "ASR failed")
        } finally {
          setLoading(false)
        }
      }
      mr.start(250)
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Microphone access denied")
    }
  }, [sourceLang])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }, [])

  const handleSummarize = async () => {
    if (!transcript.trim()) return
    setSummarizing(true)
    try {
      const res = await bhashiniSummarize(transcript)
      setSummary(res)
    } catch {
      /* summarization optional */
    }
    setSummarizing(false)
  }

  const handleCreateIssue = async () => {
    if (!transcript.trim()) return
    setActioning(true)
    setActionResult(null)
    try {
      const meta = classification?.extracted_metadata || {}
      const citizenId = selectedCitizenId || (citizens.length > 0 ? citizens[0].id : "")
      if (!citizenId) {
        setError("No citizens available")
        setActioning(false)
        return
      }
      await createIssue({
        citizen_id: citizenId,
        department: (meta.department as string) || "General Administration",
        description: transcript,
        priority: (meta.priority as string) || "Medium",
      })
      setActionResult("✅ Issue created successfully!")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create issue")
    }
    setActioning(false)
  }

  const handleCreateDocument = async () => {
    if (!transcript.trim()) return
    setActioning(true)
    setActionResult(null)
    try {
      const meta = classification?.extracted_metadata || {}
      const title = (meta.title as string) || transcript.slice(0, 60)
      const blob = new Blob([transcript], { type: "text/plain" })
      const file = new File([blob], `${title.slice(0, 40).replace(/[^a-zA-Z0-9]/g, "_")}.txt`, { type: "text/plain" })
      await uploadDocument(title, file)
      setActionResult("✅ Document created successfully!")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create document")
    }
    setActioning(false)
  }

  const handleAskAgent = async () => {
    if (!transcript.trim()) return
    setActioning(true)
    setAgentAnswer(null)
    try {
      const res = await sendAgentQuery(transcript)
      setAgentAnswer(res.response)
      setActionResult("✅ Agent answered!")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Agent query failed")
    }
    setActioning(false)
  }

  const reset = () => {
    setTranscript("")
    setClassification(null)
    setSummary(null)
    setActionResult(null)
    setAgentAnswer(null)
    setError("")
  }

  const categoryIcon = (cat: string) => {
    if (cat === "question") return <HelpCircle className="h-4 w-4 text-blue-600" />
    if (cat === "issue") return <AlertTriangle className="h-4 w-4 text-orange-600" />
    return <FileText className="h-4 w-4 text-emerald-600" />
  }

  const categoryLabel = (cat: string) => {
    if (cat === "question") return "Question — Needs AI Answer"
    if (cat === "issue") return "Citizen Issue — Create Grievance"
    return "Document — Save as Record"
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Recording Panel ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 border-2 border-foreground bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider">Voice Input</h2>
            <LanguageSelect value={sourceLang} onChange={setSourceLang} label="Language" />
          </div>

          <div className="flex flex-col items-center gap-4 py-8">
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              className={`flex h-20 w-20 items-center justify-center border-3 border-foreground transition-all ${
                recording
                  ? "animate-pulse bg-destructive text-destructive-foreground shadow-[4px_4px_0px_0px] shadow-foreground/30"
                  : "bg-primary text-primary-foreground shadow-[4px_4px_0px_0px] shadow-foreground/20 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px]"
              }`}
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : recording ? (
                <Square className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </button>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {loading ? "Processing with Bhashini" : recording ? "Recording — tap to stop" : "Tap to record"}
            </span>
          </div>

          {error && (
            <div className="border-2 border-destructive bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* ── Transcript Panel ────────────────────────── */}
        <div className="flex flex-col gap-4 border-2 border-foreground bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider">Transcript</h2>
            <div className="flex items-center gap-2">
              {provider && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  via {provider}
                </span>
              )}
              {transcript && (
                <button onClick={reset} className="text-muted-foreground hover:text-foreground" title="Clear">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-[160px] border-2 border-foreground/20 bg-background p-4">
            {transcript ? (
              <p className="text-sm leading-relaxed">{transcript}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Record voice → auto-transcribe → AI classifies → take action
              </p>
            )}
          </div>

          {transcript && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(transcript)}
                className="flex items-center gap-2 border-2 border-foreground bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-primary hover:text-primary-foreground"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
              {!summary && (
                <button
                  onClick={handleSummarize}
                  disabled={summarizing}
                  className="flex items-center gap-2 border-2 border-foreground bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                >
                  {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Summarize
                </button>
              )}
            </div>
          )}

          {classifying && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Classifying with AI...
            </div>
          )}
        </div>
      </div>

      {/* ── AI Classification Result ─────────────────── */}
      {classification && !actionResult && (
        <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-700" />
            <h2 className="text-sm font-black uppercase tracking-wider text-blue-700">AI Classification</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Category</p>
              <div className="flex items-center gap-2">
                {categoryIcon(classification.category)}
                <p className="text-sm font-bold">{categoryLabel(classification.category)}</p>
              </div>
            </div>
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Confidence</p>
              <p className="text-sm font-bold">{Math.round(classification.confidence * 100)}%</p>
            </div>
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Reasoning</p>
              <p className="text-xs text-muted-foreground">{classification.reasoning}</p>
            </div>
          </div>

          {/* Action Buttons based on classification */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {classification.category === "question" && (
              <button
                onClick={handleAskAgent}
                disabled={actioning}
                className="flex items-center gap-2 border-2 border-foreground bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[3px_3px_0px_0px] shadow-foreground/20 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px] disabled:opacity-50"
              >
                {actioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HelpCircle className="h-3.5 w-3.5" />}
                Ask AI Agent
              </button>
            )}
            {classification.category === "issue" && (
              <>
                <select
                  value={selectedCitizenId}
                  onChange={(e) => setSelectedCitizenId(e.target.value)}
                  className="border-2 border-foreground bg-background px-2 py-2 text-xs font-bold"
                >
                  <option value="">Select Citizen...</option>
                  {citizens.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Ward {c.ward}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleCreateIssue}
                  disabled={actioning}
                  className="flex items-center gap-2 border-2 border-foreground bg-orange-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[3px_3px_0px_0px] shadow-foreground/20 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px] disabled:opacity-50"
                >
                  {actioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  Create Issue
                </button>
              </>
            )}
            {classification.category === "document" && (
              <button
                onClick={handleCreateDocument}
                disabled={actioning}
                className="flex items-center gap-2 border-2 border-foreground bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[3px_3px_0px_0px] shadow-foreground/20 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px] disabled:opacity-50"
              >
                {actioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Save as Document
              </button>
            )}
            {/* Manual override buttons */}
            {classification.category !== "issue" && (
              <button
                onClick={handleCreateIssue}
                disabled={actioning}
                className="flex items-center gap-2 border-2 border-foreground/50 bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
              >
                <AlertTriangle className="h-3 w-3" /> Create as Issue
              </button>
            )}
            {classification.category !== "document" && (
              <button
                onClick={handleCreateDocument}
                disabled={actioning}
                className="flex items-center gap-2 border-2 border-foreground/50 bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
              >
                <FileText className="h-3 w-3" /> Save as Document
              </button>
            )}
            {classification.category !== "question" && (
              <button
                onClick={handleAskAgent}
                disabled={actioning}
                className="flex items-center gap-2 border-2 border-foreground/50 bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
              >
                <HelpCircle className="h-3 w-3" /> Ask AI Agent
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Action Result ────────────────────────────── */}
      {actionResult && (
        <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-black uppercase tracking-wider text-emerald-600">{actionResult}</p>
          </div>
          {agentAnswer && (
            <div className="border-2 border-blue-600/30 bg-blue-50 dark:bg-blue-950/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-blue-700" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">AI Agent Response</p>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{agentAnswer}</p>
            </div>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-2 border-2 border-foreground bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-primary hover:text-primary-foreground"
          >
            Record Another
          </button>
        </div>
      )}

      {/* ── Summary Panel ────────────────────────────── */}
      {summary && (
        <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-purple-600">AI Summary</h2>
          </div>

          <div className="border-2 border-foreground/20 p-4">
            <p className="text-sm leading-relaxed">{summary.summary}</p>
          </div>

          {summary.key_points.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Key Points</p>
              <ul className="space-y-1">
                {summary.key_points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-purple-600" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.action_items.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Action Items</p>
              <ul className="space-y-1">
                {summary.action_items.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-orange-600" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.departments_mentioned.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Departments:</span>
              {summary.departments_mentioned.map((d, i) => (
                <span key={i} className="border border-foreground/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// TTS Tab — Text to Speech
// ═════════════════════════════════════════════════════════════════════

function TTSTab() {
  const [text, setText] = useState("")
  const [sourceLang, setSourceLang] = useState("hi")
  const [gender, setGender] = useState<"male" | "female">("female")
  const [loading, setLoading] = useState(false)
  const [audioSrc, setAudioSrc] = useState("")
  const [error, setError] = useState("")
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const synthesize = async () => {
    if (!text.trim()) return
    setError("")
    setLoading(true)
    setAudioSrc("")
    try {
      const res = await bhashiniTTS({
        text: text.trim(),
        source_language: sourceLang,
        gender,
      })
      if (res.audio_base64) {
        setAudioSrc(`data:audio/wav;base64,${res.audio_base64}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "TTS failed")
    } finally {
      setLoading(false)
    }
  }

  const playAudio = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4 border-2 border-foreground bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider">Text Input</h2>
          <LanguageSelect value={sourceLang} onChange={setSourceLang} label="Language" />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to convert to speech..."
          className="min-h-[160px] w-full resize-none border-2 border-foreground bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={5000}
        />

        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Voice</label>
          <div className="flex gap-1">
            {(["female", "male"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`border-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  gender === g
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-foreground/30 text-muted-foreground hover:bg-muted"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <button
            onClick={synthesize}
            disabled={loading || !text.trim()}
            className="ml-auto flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_0px] shadow-foreground/20 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
            Synthesize
          </button>
        </div>

        {error && (
          <div className="border-2 border-destructive bg-destructive/10 p-3 text-xs font-medium text-destructive">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-2 border-foreground bg-card p-5">
        <h2 className="text-sm font-black uppercase tracking-wider">Audio Output</h2>
        <div className="flex flex-col items-center gap-4 py-8">
          {audioSrc ? (
            <>
              <audio ref={audioRef} src={audioSrc} onEnded={() => setPlaying(false)} className="hidden" />
              <button
                onClick={playAudio}
                className="flex h-16 w-16 items-center justify-center border-3 border-foreground bg-primary text-primary-foreground shadow-[4px_4px_0px_0px] shadow-foreground/20 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px]"
              >
                {playing ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {playing ? "Playing" : "Tap to play"}
              </span>
              <a
                href={audioSrc}
                download="bhashini_tts_output.wav"
                className="flex items-center gap-2 border-2 border-foreground bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-primary hover:text-primary-foreground"
              >
                Download Audio
              </a>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Audio will appear here after synthesis...</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// Translate Tab — Neural Machine Translation
// ═════════════════════════════════════════════════════════════════════

function TranslateTab() {
  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [sourceLang, setSourceLang] = useState("en")
  const [targetLang, setTargetLang] = useState("hi")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const translate = async () => {
    if (!sourceText.trim()) return
    setError("")
    setLoading(true)
    try {
      const res = await bhashiniTranslate({
        text: sourceText.trim(),
        source_language: sourceLang,
        target_language: targetLang,
      })
      setTranslatedText(res.translated_text)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Translation failed")
    } finally {
      setLoading(false)
    }
  }

  const swapLanguages = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setSourceText(translatedText)
    setTranslatedText(sourceText)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <LanguageSelect value={sourceLang} onChange={setSourceLang} label="From" />
        <button
          onClick={swapLanguages}
          className="flex h-9 w-9 items-center justify-center border-2 border-foreground bg-muted hover:bg-primary hover:text-primary-foreground"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
        <LanguageSelect value={targetLang} onChange={setTargetLang} label="To" />
        <button
          onClick={translate}
          disabled={loading || !sourceText.trim()}
          className="ml-auto flex items-center gap-2 border-2 border-foreground bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_0px] shadow-foreground/20 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
          Translate
        </button>
      </div>

      {error && (
        <div className="border-2 border-destructive bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2 border-2 border-foreground bg-card p-5">
          <h2 className="text-sm font-black uppercase tracking-wider">Source</h2>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            className="min-h-[200px] w-full resize-none border-2 border-foreground/20 bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={5000}
          />
          <span className="self-end text-[10px] text-muted-foreground">{sourceText.length}/5000</span>
        </div>
        <div className="flex flex-col gap-2 border-2 border-foreground bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider">Translation</h2>
            {translatedText && (
              <button
                onClick={() => navigator.clipboard.writeText(translatedText)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            )}
          </div>
          <div className="min-h-[200px] border-2 border-foreground/20 bg-background p-3">
            {translatedText ? (
              <p className="text-sm leading-relaxed">{translatedText}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Translation will appear here...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// Shared: Language Select Dropdown
// ═════════════════════════════════════════════════════════════════════

function LanguageSelect({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-2 border-foreground bg-background px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label} ({l.native})
          </option>
        ))}
      </select>
    </div>
  )
}
