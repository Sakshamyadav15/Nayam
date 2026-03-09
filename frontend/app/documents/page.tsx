"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { FileText, Eye, Brain, Upload, Loader2, X, CheckCircle, Mic, MicOff, Edit3, Send, Volume2, ArrowRightLeft } from "lucide-react"
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
  DialogFooter,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/nayam/status-badge"
import { useApiData } from "@/hooks/use-api-data"
import { fetchDocuments, uploadDocument, bhashiniASR, bhashiniClassifyText, createIssue, fetchCitizens, bhashiniTTS, bhashiniTranslate } from "@/lib/services"
import type { Document, Citizen } from "@/lib/types"

export default function DocumentsPage() {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Voice Recording State ──────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false)
  const [voiceLang, setVoiceLang] = useState("hi")
  const [voiceClassification, setVoiceClassification] = useState<{
    transcript: string
    classification: {
      category: string; confidence: number; reasoning: string; extracted_metadata: Record<string, unknown>
    }
  } | null>(null)
  const [voiceResult, setVoiceResult] = useState<{
    ingestion: { created_type: string; title: string | null; detail: string }
  } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Editable fields (populated from LLM classification, user can modify)
  const [editCategory, setEditCategory] = useState<"issue" | "document">("document")
  const [editTitle, setEditTitle] = useState("")
  const [editDept, setEditDept] = useState("")
  const [editPriority, setEditPriority] = useState("Medium")
  const [editCitizenName, setEditCitizenName] = useState("")
  const [editCitizenId, setEditCitizenId] = useState("")
  const [editTranscript, setEditTranscript] = useState("")

  // Citizens list for citizen picker
  const [citizens, setCitizens] = useState<Citizen[]>([])
  useEffect(() => {
    fetchCitizens({ limit: 200 }).then((r) => setCitizens(r.citizens)).catch(() => {})
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      audioChunksRef.current = []
      setVoiceClassification(null)
      setVoiceResult(null)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        if (audioBlob.size < 100) return

        setIsProcessingVoice(true)
        try {
          // Step 1: Bhashini ASR (language-aware STT)
          const asrResult = await bhashiniASR(audioBlob, voiceLang)
          const transcript = asrResult.transcript
          if (!transcript || transcript.trim().length < 3) {
            setUploadError("Could not transcribe audio. Please try again.")
            setIsProcessingVoice(false)
            return
          }

          // Step 2: Classify text via LLM
          const clsResult = await bhashiniClassifyText(transcript)

          setVoiceClassification({
            transcript,
            classification: clsResult,
          })

          // Pre-fill editable fields from LLM metadata
          const meta = clsResult.extracted_metadata || {}
          setEditTitle((meta.title as string) || transcript.slice(0, 80))
          setEditDept((meta.department as string) || "General Administration")
          setEditPriority((meta.priority as string) || "Medium")
          setEditCitizenName((meta.citizen_name as string) || "")
          setEditCitizenId("") // user picks from dropdown
          setEditTranscript(transcript)
          setEditCategory(clsResult.category === "issue" ? "issue" : "document")
        } catch (err) {
          const message = err instanceof Error ? err.message : "Voice processing failed"
          setUploadError(message)
        } finally {
          setIsProcessingVoice(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      alert("Microphone access denied. Please allow microphone permissions.")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  // Step 2: User confirms — create the entity with edited fields
  const handleVoiceConfirm = async () => {
    if (!voiceClassification) return
    setIsSubmittingVoice(true)
    setUploadError("")

    try {
      const category = editCategory

      if (category === "issue") {
        // Create Issue via existing API with user-edited fields
        // Use selected citizen or fall back to first citizen
        const citizenId = editCitizenId || (citizens.length > 0 ? citizens[0].id : "")
        if (!citizenId) {
          setUploadError("No citizens available. Please add a citizen first.")
          setIsSubmittingVoice(false)
          return
        }
        await createIssue({
          citizen_id: citizenId,
          department: editDept,
          description: editTranscript,
          priority: editPriority,
        })
        setVoiceResult({
          ingestion: {
            created_type: "issue",
            title: editTitle,
            detail: `Created issue in '${editDept}' department with ${editPriority} priority.`,
          },
        })
      } else {
        // For documents: use uploadDocument with the transcript as a text file
        const textBlob = new Blob([editTranscript], { type: "text/plain" })
        const textFile = new File([textBlob], `${editTitle.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}.txt`, { type: "text/plain" })
        await uploadDocument(editTitle, textFile)
        setVoiceResult({
          ingestion: {
            created_type: "document",
            title: editTitle,
            detail: `Created document '${editTitle}' from voice transcript.`,
          },
        })
      }

      setVoiceClassification(null) // close edit form
      refetch() // refresh table
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create record"
      setUploadError(message)
    } finally {
      setIsSubmittingVoice(false)
    }
  }

  const { data, isLoading, refetch } = useApiData(() => fetchDocuments({ limit: 200 }), [])
  const allDocuments: Document[] = data?.documents || []

  const doc = selectedDoc ? allDocuments.find((d) => d.id === selectedDoc) : null

  // ── Detail TTS / Translate State ───────────────────
  const [docTtsLang, setDocTtsLang] = useState("hi")
  const [docTtsGender, setDocTtsGender] = useState<"male" | "female">("female")
  const [docTtsLoading, setDocTtsLoading] = useState(false)
  const [docTtsAudio, setDocTtsAudio] = useState<string | null>(null)
  const [docTransLang, setDocTransLang] = useState("hi")
  const [docTransLoading, setDocTransLoading] = useState(false)
  const [docTransResult, setDocTransResult] = useState<string | null>(null)

  const handleDocTTS = async () => {
    if (!doc) return
    setDocTtsLoading(true)
    setDocTtsAudio(null)
    try {
      const res = await bhashiniTTS({
        text: doc.aiSummary || doc.title,
        source_language: docTtsLang,
        gender: docTtsGender,
      })
      setDocTtsAudio(`data:audio/wav;base64,${res.audio_base64}`)
    } catch { /* ignore */ } finally {
      setDocTtsLoading(false)
    }
  }

  const handleDocTranslate = async () => {
    if (!doc) return
    setDocTransLoading(true)
    setDocTransResult(null)
    try {
      const res = await bhashiniTranslate({
        text: doc.aiSummary || doc.title,
        source_language: "en",
        target_language: docTransLang,
      })
      setDocTransResult(res.translated_text)
    } catch { /* ignore */ } finally {
      setDocTransLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadFile) return
    setUploading(true)
    setUploadError("")
    try {
      await uploadDocument(uploadTitle.trim(), uploadFile)
      setShowUpload(false)
      setUploadTitle("")
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      refetch()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed"
      setUploadError(message)
    } finally {
      setUploading(false)
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
            Documents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Document repository with AI-powered analysis &amp; RAG
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Language Selector for Voice */}
          <select
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value)}
            className="border-2 border-foreground bg-background px-2 py-2 text-xs font-bold uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            title="Voice language (Bhashini ASR)"
          >
            <option value="hi">🇮🇳 Hindi</option>
            <option value="en">🇬🇧 English</option>
            <option value="bn">🇮🇳 Bengali</option>
            <option value="ta">🇮🇳 Tamil</option>
            <option value="te">🇮🇳 Telugu</option>
            <option value="mr">🇮🇳 Marathi</option>
            <option value="gu">🇮🇳 Gujarati</option>
            <option value="kn">🇮🇳 Kannada</option>
            <option value="ml">🇮🇳 Malayalam</option>
            <option value="pa">🇮🇳 Punjabi</option>
            <option value="or">🇮🇳 Odia</option>
            <option value="ur">🇮🇳 Urdu</option>
          </select>

          {/* Voice Ingest Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessingVoice}
            className={`flex items-center gap-2 border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[5px_5px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5 ${
              isRecording
                ? "border-red-600 bg-red-600 text-white animate-pulse"
                : "border-foreground bg-orange-600 text-white"
            } disabled:opacity-50`}
            title={isRecording ? "Stop recording" : "Record voice (Bhashini ASR) — auto-classifies as Document or Issue"}
          >
            {isProcessingVoice ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {isProcessingVoice ? "Processing..." : isRecording ? "Stop" : "Voice Ingest"}
          </button>

          {/* File Upload Button */}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[5px_5px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Upload New Document
            </p>
            <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              type="text"
              placeholder="Document title..."
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground file:mr-2 file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-bold file:uppercase"
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadTitle.trim() || !uploadFile}
              className="flex items-center gap-2 border-2 border-foreground bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-colors hover:bg-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Processing..." : "Upload"}
            </button>
          </div>
          {uploadError && (
            <p className="text-xs text-red-600 font-bold">{uploadError}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Supported: PDF, TXT, DOC, DOCX (max 10 MB). Documents are auto-analysed with AI and indexed for RAG retrieval.
          </p>
        </div>
      )}

      {/* Voice Classification — Editable Review Form */}
      {voiceClassification && !voiceResult && (
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-orange-600" />
              <p className="text-xs font-black uppercase tracking-widest text-orange-600">
                Review &amp; Edit Before Creating
              </p>
            </div>
            <button onClick={() => setVoiceClassification(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Classification summary */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Create As</p>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as "issue" | "document")}
                className="w-full border-2 border-foreground bg-background px-2 py-1.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="document">Document</option>
                <option value="issue">Issue</option>
              </select>
            </div>
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">AI Suggestion</p>
              <p className="text-sm font-bold text-foreground">
                {voiceClassification.classification.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({Math.round(voiceClassification.classification.confidence * 100)}%)
                </span>
              </p>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</label>
              <input
                type="text"
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {editCategory === "issue" && (
              <>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Citizen</label>
                  <select
                    value={editCitizenId}
                    onChange={(e) => setEditCitizenId(e.target.value)}
                    className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">
                      {editCitizenName ? `Auto-detected: ${editCitizenName} (pick below)` : "Select a citizen..."}
                    </option>
                    {citizens.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — Ward {c.ward}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Editable Transcript */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transcript (editable)</label>
            <textarea
              value={editTranscript}
              onChange={(e) => setEditTranscript(e.target.value)}
              rows={3}
              className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          {/* Reasoning */}
          <p className="text-[10px] text-muted-foreground italic">
            AI reasoning: {voiceClassification.classification.reasoning}
          </p>

          {uploadError && <p className="text-xs text-red-600 font-bold">{uploadError}</p>}

          {/* Confirm / Cancel */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleVoiceConfirm}
              disabled={isSubmittingVoice || !editTitle.trim()}
              className="flex items-center gap-2 border-2 border-foreground bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-colors hover:bg-foreground/80 disabled:opacity-50"
            >
              {isSubmittingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {isSubmittingVoice ? "Creating..." : editCategory === "issue" ? "Create Issue" : "Create Document"}
            </button>
            <button
              onClick={() => setVoiceClassification(null)}
              className="flex items-center gap-2 border-2 border-foreground/50 bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Voice Ingest Success Result */}
      {voiceResult && (
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
                Successfully Created
              </p>
            </div>
            <button onClick={() => setVoiceResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Type</p>
              <p className="text-sm font-bold text-foreground">
                {voiceResult.ingestion.created_type === "document" ? "📄 Document" : "⚠️ Issue"}
              </p>
            </div>
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Title</p>
              <p className="text-sm font-bold text-foreground">{voiceResult.ingestion.title}</p>
            </div>
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Detail</p>
              <p className="text-xs text-foreground">{voiceResult.ingestion.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border-3 border-foreground bg-card shadow-[4px_4px_0px_0px] shadow-foreground/20">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground bg-muted/50">
              <TableHead className="text-xs font-black uppercase tracking-widest">Title</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Uploaded By</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Date</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">AI Summary</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Risk</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">No documents yet</p>
                  <p className="text-xs mt-1">Upload policy documents, reports, or guidelines to enable RAG-powered AI analysis</p>
                </TableCell>
              </TableRow>
            ) : (
              allDocuments.map((d) => (
                <TableRow key={d.id} className="border-b border-foreground/10">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-foreground">{d.title}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{d.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{d.uploadedBy}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{d.date}</TableCell>
                  <TableCell>
                    <p className="max-w-xs truncate text-xs text-muted-foreground">{d.aiSummary}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.riskRelevance} variant="risk" />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setSelectedDoc(d.id)}
                      className="flex items-center gap-1.5 border-2 border-foreground bg-background px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-foreground hover:text-background"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Showing {allDocuments.length} of {data?.total || 0} documents
      </p>

      {/* Document Detail Modal */}
      <Dialog open={!!selectedDoc} onOpenChange={() => { setSelectedDoc(null); setDocTtsAudio(null); setDocTransResult(null) }}>
        <DialogContent className="border-3 border-foreground rounded-none shadow-[8px_8px_0px_0px] shadow-foreground/20 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              Document Detail
            </DialogTitle>
          </DialogHeader>
          {doc && (
            <div className="space-y-4">
              <div className="border-2 border-foreground p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{doc.title}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>By: <span className="font-semibold text-foreground">{doc.uploadedBy}</span></span>
                  <span className="font-mono">{doc.date}</span>
                  <StatusBadge status={doc.riskRelevance} variant="risk" />
                </div>
              </div>

              {/* AI Summary */}
              <div className="border-2 border-foreground border-l-4 border-l-blue-700 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-blue-700" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">AI Summary</p>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{doc.aiSummary}</p>
              </div>

              {/* Bhashini: TTS + Translate */}
              <div className="border-2 border-foreground border-l-4 border-l-orange-600 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Bhashini Language Tools</p>
                <div className="flex flex-wrap items-end gap-3">
                  {/* TTS */}
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Speak in</label>
                      <select value={docTtsLang} onChange={(e) => setDocTtsLang(e.target.value)} className="mt-0.5 block w-24 border border-foreground/50 bg-background px-2 py-1 text-xs">
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
                      <select value={docTtsGender} onChange={(e) => setDocTtsGender(e.target.value as "male" | "female")} className="mt-0.5 block w-20 border border-foreground/50 bg-background px-2 py-1 text-xs">
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </div>
                    <button onClick={handleDocTTS} disabled={docTtsLoading} className="flex items-center gap-1.5 border-2 border-foreground bg-orange-600 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-orange-700 disabled:opacity-50">
                      {docTtsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                      Speak
                    </button>
                  </div>

                  {/* Translate */}
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Translate to</label>
                      <select value={docTransLang} onChange={(e) => setDocTransLang(e.target.value)} className="mt-0.5 block w-24 border border-foreground/50 bg-background px-2 py-1 text-xs">
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
                    <button onClick={handleDocTranslate} disabled={docTransLoading} className="flex items-center gap-1.5 border-2 border-foreground bg-blue-600 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-blue-700 disabled:opacity-50">
                      {docTransLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />}
                      Translate
                    </button>
                  </div>
                </div>
                {docTtsAudio && (
                  <audio controls src={docTtsAudio} className="w-full mt-2" />
                )}
                {docTransResult && (
                  <div className="mt-2 border border-foreground/30 bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Translation</p>
                    <p className="text-sm text-foreground leading-relaxed">{docTransResult}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[5px_5px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Close
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
