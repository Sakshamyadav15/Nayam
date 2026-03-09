"use client"

import { useState, useMemo } from "react"
import {
  PenTool,
  Sparkles,
  FileText,
  Send,
  Loader2,
  Search,
  Filter,
  Eye,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  X,
  Edit3,
  Download,
} from "lucide-react"
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
import { useApiData } from "@/hooks/use-api-data"
import { fetchDrafts, generateDraft, updateDraft, deleteDraft } from "@/lib/services"
import type { DraftBackend, DraftType, DraftStatus, DraftGenerateRequest } from "@/lib/types"

// ── Constants ───────────────────────────────────────────────────────
const DRAFT_TYPE_INFO: Record<DraftType, { label: string; icon: string; description: string }> = {
  SPEECH: { label: "Speech", icon: "🎤", description: "Public address, event speech, official statements" },
  OFFICIAL_RESPONSE: { label: "Official Response", icon: "📋", description: "Formal reply to complaints, petitions, RTI" },
  PRESS_RELEASE: { label: "Press Release", icon: "📰", description: "Media communication, announcements" },
  POLICY_BRIEF: { label: "Policy Brief", icon: "📊", description: "Analysis and recommendations for leadership" },
  MEETING_AGENDA: { label: "Meeting Agenda", icon: "📝", description: "Structured agenda with items and time" },
  PUBLIC_NOTICE: { label: "Public Notice", icon: "📢", description: "Official notices for citizens" },
  LETTER: { label: "Formal Letter", icon: "✉️", description: "Official government correspondence" },
  RTI_RESPONSE: { label: "RTI Response", icon: "🔍", description: "Right to Information Act response" },
  CIRCULAR: { label: "Govt. Circular", icon: "🏛️", description: "Internal government circulars and orders" },
}

const STATUS_COLORS: Record<DraftStatus, string> = {
  GENERATING: "bg-purple-100 text-purple-900 border-purple-900",
  DRAFT: "bg-amber-100 text-amber-900 border-amber-900",
  UNDER_REVIEW: "bg-blue-100 text-blue-900 border-blue-900",
  APPROVED: "bg-emerald-100 text-emerald-900 border-emerald-900",
  PUBLISHED: "bg-green-100 text-green-900 border-green-900",
}

const STATUS_LABELS: Record<DraftStatus, string> = {
  GENERATING: "Generating",
  DRAFT: "Draft",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
}

const TONE_OPTIONS = ["Formal", "Empathetic", "Authoritative", "Professional", "Persuasive", "Informative", "Analytical"]
const AUDIENCE_OPTIONS = [
  "General Public",
  "Citizens",
  "Senior Administration",
  "Media",
  "Department Heads",
  "Ward Residents",
  "Policy Committee",
  "State Government",
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// ── Component ───────────────────────────────────────────────────────
export default function DraftsPage() {
  const { data, isLoading, refetch } = useApiData(() => fetchDrafts({ limit: 100 }), [])
  const allDrafts: DraftBackend[] = data?.drafts || []

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Generation form
  const [showGenerate, setShowGenerate] = useState(false)
  const [genType, setGenType] = useState<DraftType | "">("")
  const [genTopic, setGenTopic] = useState("")
  const [genTone, setGenTone] = useState("Formal")
  const [genAudience, setGenAudience] = useState("General Public")
  const [genDepartment, setGenDepartment] = useState("")
  const [genContext, setGenContext] = useState("")
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState("")

  // View / Edit
  const [selectedDraft, setSelectedDraft] = useState<DraftBackend | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Delete
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filtered drafts
  const filtered = useMemo(() => {
    return allDrafts.filter((d) => {
      const matchSearch =
        !searchQuery ||
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.content || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.department || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchType = !typeFilter || d.draft_type === typeFilter
      const matchStatus = !statusFilter || d.status === statusFilter
      return matchSearch && matchType && matchStatus
    })
  }, [allDrafts, searchQuery, typeFilter, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [filtered])

  // Stats
  const totalDrafts = allDrafts.length
  const aiGenerated = allDrafts.filter(
    (d) => d.extra_metadata?.ai_generated === true
  ).length
  const underReview = allDrafts.filter((d) => d.status === "UNDER_REVIEW").length

  // ── Handlers ──────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!genType || !genTopic.trim()) {
      setGenError("Select a template type and enter a topic.")
      return
    }
    setGenerating(true)
    setGenError("")
    try {
      const payload: DraftGenerateRequest = {
        draft_type: genType as DraftType,
        topic: genTopic.trim(),
        tone: genTone,
        audience: genAudience,
        department: genDepartment.trim(),
        additional_context: genContext.trim(),
      }
      const draft = await generateDraft(payload)
      setShowGenerate(false)
      resetGenForm()
      await refetch()
      // Open the generated draft
      setSelectedDraft(draft)
      setEditContent(draft.content)
      setEditTitle(draft.title)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedDraft) return
    setSaving(true)
    try {
      const updated = await updateDraft(selectedDraft.id, {
        title: editTitle.trim() || selectedDraft.title,
        content: editContent,
      })
      setSelectedDraft(updated)
      setEditMode(false)
      await refetch()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id: string, status: DraftStatus) => {
    try {
      const updated = await updateDraft(id, { status })
      if (selectedDraft?.id === id) {
        setSelectedDraft(updated)
      }
      await refetch()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await deleteDraft(id)
      setShowDeleteId(null)
      if (selectedDraft?.id === id) setSelectedDraft(null)
      await refetch()
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  const handleCopy = () => {
    if (selectedDraft) {
      navigator.clipboard.writeText(selectedDraft.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const resetGenForm = () => {
    setGenType("")
    setGenTopic("")
    setGenTone("Formal")
    setGenAudience("General Public")
    setGenDepartment("")
    setGenContext("")
    setGenError("")
  }

  const selectTemplate = (type: DraftType) => {
    setGenType(type)
    setShowGenerate(true)
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">
            Drafts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered speech, response, and document generation
          </p>
        </div>
        <button
          onClick={() => { resetGenForm(); setShowGenerate(true) }}
          className="flex items-center gap-2 border-3 border-foreground bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-[4px_4px_0px_0px] shadow-foreground/20 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          <Sparkles className="h-4 w-4" />
          Generate with AI
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-purple-100">
              <PenTool className="h-5 w-5 text-purple-900" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{totalDrafts}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Drafts
              </p>
            </div>
          </div>
        </div>
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-blue-100">
              <Sparkles className="h-5 w-5 text-blue-900" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{aiGenerated}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                AI Generated
              </p>
            </div>
          </div>
        </div>
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-amber-100">
              <Eye className="h-5 w-5 text-amber-900" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{underReview}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Under Review
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Template Cards */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3">
          Quick Generate — Pick a Template
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.entries(DRAFT_TYPE_INFO) as [DraftType, typeof DRAFT_TYPE_INFO[DraftType]][]).map(
            ([type, info]) => (
              <button
                key={type}
                onClick={() => selectTemplate(type)}
                className="group border-2 border-foreground bg-card p-3 text-left transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none shadow-[3px_3px_0px_0px] shadow-foreground/20"
              >
                <span className="text-2xl">{info.icon}</span>
                <p className="mt-1 text-xs font-bold text-foreground">{info.label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight line-clamp-2">
                  {info.description}
                </p>
              </button>
            )
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center border-2 border-foreground bg-card px-3 py-2 flex-1 max-w-md">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search drafts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Types</option>
            {(Object.entries(DRAFT_TYPE_INFO) as [DraftType, typeof DRAFT_TYPE_INFO[DraftType]][]).map(
              ([type, info]) => (
                <option key={type} value={type}>
                  {info.label}
                </option>
              )
            )}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Status</option>
            {(Object.entries(STATUS_LABELS) as [DraftStatus, string][]).map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drafts Table */}
      <div className="border-3 border-foreground bg-card shadow-[4px_4px_0px_0px] shadow-foreground/20">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground bg-muted/50">
              <TableHead className="font-black uppercase text-xs tracking-wider">Draft</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Type</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Status</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Version</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Updated</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <PenTool className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-2 text-sm font-bold text-muted-foreground">No drafts found</p>
                  <p className="text-xs text-muted-foreground">Use &quot;Generate with AI&quot; to create your first draft</p>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((draft) => {
                const info = DRAFT_TYPE_INFO[draft.draft_type]
                const wordCount = (draft.extra_metadata?.word_count as number) || 0
                return (
                  <TableRow
                    key={draft.id}
                    className="border-b border-foreground/10 cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => {
                      setSelectedDraft(draft)
                      setEditContent(draft.content)
                      setEditTitle(draft.title)
                      setEditMode(false)
                    }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm text-foreground">{draft.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {draft.department || "No department"} · {wordCount} words
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {info?.icon} <span className="text-xs font-bold">{info?.label}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${STATUS_COLORS[draft.status]}`}
                      >
                        {STATUS_LABELS[draft.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-foreground">v{draft.version}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{formatDate(draft.updated_at)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDraft(draft)
                            setEditContent(draft.content)
                            setEditTitle(draft.title)
                            setEditMode(false)
                          }}
                          className="p-1.5 border border-foreground/20 hover:bg-muted"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteId(draft.id)
                          }}
                          className="p-1.5 border border-foreground/20 hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Generate Draft Dialog ─────────────────────────────────── */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="border-3 border-foreground bg-card shadow-[8px_8px_0px_0px] shadow-foreground/20 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Draft with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {genError && (
              <div className="border-2 border-red-900 bg-red-100 px-3 py-2 text-xs font-bold text-red-900">
                {genError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Template Type *
              </label>
              <select
                value={genType}
                onChange={(e) => setGenType(e.target.value as DraftType)}
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground"
              >
                <option value="">Select template...</option>
                {(Object.entries(DRAFT_TYPE_INFO) as [DraftType, typeof DRAFT_TYPE_INFO[DraftType]][]).map(
                  ([type, info]) => (
                    <option key={type} value={type}>
                      {info.icon} {info.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Topic / Subject *
              </label>
              <textarea
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                rows={3}
                placeholder="e.g., Independence Day address highlighting district achievements in infrastructure and governance..."
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Tone
                </label>
                <select
                  value={genTone}
                  onChange={(e) => setGenTone(e.target.value)}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Audience
                </label>
                <select
                  value={genAudience}
                  onChange={(e) => setGenAudience(e.target.value)}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground"
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Department
              </label>
              <input
                type="text"
                value={genDepartment}
                onChange={(e) => setGenDepartment(e.target.value)}
                placeholder="e.g., General Administration"
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Additional Context (optional)
              </label>
              <textarea
                value={genContext}
                onChange={(e) => setGenContext(e.target.value)}
                rows={2}
                placeholder="Any specific points, data, or references to include..."
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t-2 border-foreground/10">
            <button
              onClick={() => setShowGenerate(false)}
              className="border-2 border-foreground bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Draft View / Edit Dialog ─────────────────────────────── */}
      <Dialog
        open={!!selectedDraft}
        onOpenChange={() => {
          setSelectedDraft(null)
          setEditMode(false)
        }}
      >
        <DialogContent className="border-3 border-foreground bg-card shadow-[8px_8px_0px_0px] shadow-foreground/20 max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedDraft && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {editMode ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full border-2 border-foreground bg-background px-3 py-1.5 text-lg font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <DialogTitle className="text-lg font-black">
                        {selectedDraft.title}
                      </DialogTitle>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-sm">
                        {DRAFT_TYPE_INFO[selectedDraft.draft_type]?.icon}{" "}
                        <span className="text-xs font-bold">
                          {DRAFT_TYPE_INFO[selectedDraft.draft_type]?.label}
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${STATUS_COLORS[selectedDraft.status]}`}
                      >
                        {STATUS_LABELS[selectedDraft.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        v{selectedDraft.version} · {formatDate(selectedDraft.updated_at)}
                      </span>
                      {Boolean(selectedDraft.extra_metadata?.ai_generated) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 border-purple-900 bg-purple-100 text-purple-900">
                          <Sparkles className="h-3 w-3" /> AI
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Meta info */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-b-2 border-foreground/10 pb-3">
                {selectedDraft.tone && <span><strong>Tone:</strong> {selectedDraft.tone}</span>}
                {selectedDraft.audience && <span><strong>Audience:</strong> {selectedDraft.audience}</span>}
                {selectedDraft.department && <span><strong>Dept:</strong> {selectedDraft.department}</span>}
                {selectedDraft.extra_metadata?.word_count != null && (
                  <span><strong>Words:</strong> {String(selectedDraft.extra_metadata.word_count)}</span>
                )}
              </div>

              {/* Content */}
              {editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                />
              ) : (
                <div className="prose prose-sm max-w-none text-foreground">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {selectedDraft.content}
                  </pre>
                </div>
              )}

              {/* Action bar */}
              <div className="flex flex-wrap gap-2 pt-3 border-t-2 border-foreground/10">
                {editMode ? (
                  <>
                    <button
                      onClick={() => setEditMode(false)}
                      className="border-2 border-foreground bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex items-center gap-2 border-2 border-foreground bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 border-2 border-foreground bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 border-2 border-foreground bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    {selectedDraft.status === "DRAFT" && (
                      <button
                        onClick={() => handleStatusChange(selectedDraft.id, "UNDER_REVIEW")}
                        className="flex items-center gap-1.5 border-2 border-foreground bg-blue-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-900 hover:bg-blue-200"
                      >
                        Submit for Review
                      </button>
                    )}
                    {selectedDraft.status === "UNDER_REVIEW" && (
                      <button
                        onClick={() => handleStatusChange(selectedDraft.id, "APPROVED")}
                        className="flex items-center gap-1.5 border-2 border-foreground bg-emerald-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-900 hover:bg-emerald-200"
                      >
                        Approve
                      </button>
                    )}
                    {selectedDraft.status === "APPROVED" && (
                      <button
                        onClick={() => handleStatusChange(selectedDraft.id, "PUBLISHED")}
                        className="flex items-center gap-1.5 border-2 border-foreground bg-green-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-green-900 hover:bg-green-200"
                      >
                        Publish
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────────────────────── */}
      <Dialog open={!!showDeleteId} onOpenChange={() => setShowDeleteId(null)}>
        <DialogContent className="border-3 border-foreground bg-card shadow-[8px_8px_0px_0px] shadow-foreground/20 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              Delete Draft?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The draft and all its versions will be permanently removed.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowDeleteId(null)}
              className="border-2 border-foreground bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => showDeleteId && handleDelete(showDeleteId)}
              disabled={deleting}
              className="flex items-center gap-2 border-2 border-foreground bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
