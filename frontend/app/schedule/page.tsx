"use client"

import { useState, useMemo } from "react"
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Plus,
  Filter,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Trash2,
  AlertCircle,
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
import { StatusBadge } from "@/components/nayam/status-badge"
import { useApiData } from "@/hooks/use-api-data"
import { fetchEvents, createEvent, updateEvent, deleteEvent } from "@/lib/services"
import type { EventBackend, EventType, EventPriority, EventCreateRequest } from "@/lib/types"

// ── Constants ───────────────────────────────────────────────────────
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  "Meeting": "Meeting",
  "Hearing": "Hearing",
  "Site Visit": "Site Visit",
  "Deadline": "Deadline",
  "Review": "Review",
  "Public Event": "Public Event",
  "Other": "Other",
}

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  "Meeting": "bg-blue-100 text-blue-900 border-blue-900",
  "Hearing": "bg-purple-100 text-purple-900 border-purple-900",
  "Site Visit": "bg-emerald-100 text-emerald-900 border-emerald-900",
  "Deadline": "bg-red-100 text-red-900 border-red-900",
  "Review": "bg-amber-100 text-amber-900 border-amber-900",
  "Public Event": "bg-pink-100 text-pink-900 border-pink-900",
  "Other": "bg-slate-100 text-slate-900 border-slate-900",
}

const PRIORITY_COLORS: Record<EventPriority, string> = {
  "Low": "bg-slate-100 text-slate-800 border-slate-800",
  "Medium": "bg-amber-100 text-amber-900 border-amber-900",
  "High": "bg-red-100 text-red-900 border-red-900",
}

const STATUS_COLORS: Record<string, string> = {
  "Scheduled": "bg-blue-100 text-blue-900 border-blue-900",
  "In Progress": "bg-amber-100 text-amber-900 border-amber-900",
  "Completed": "bg-emerald-100 text-emerald-900 border-emerald-900",
  "Cancelled": "bg-slate-100 text-slate-700 border-slate-700",
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
}

function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Component ───────────────────────────────────────────────────────
export default function SchedulePage() {
  const { data, isLoading, refetch } = useApiData(() => fetchEvents({ limit: 200 }), [])
  const allEvents: EventBackend[] = data?.events || []

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [view, setView] = useState<"list" | "timeline">("list")

  // Dialogs
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventBackend | null>(null)
  const [showDelete, setShowDelete] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Create form state
  const [formTitle, setFormTitle] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formType, setFormType] = useState<EventType>("Meeting")
  const [formPriority, setFormPriority] = useState<EventPriority>("Medium")
  const [formStart, setFormStart] = useState("")
  const [formEnd, setFormEnd] = useState("")
  const [formLocation, setFormLocation] = useState("")
  const [formAttendees, setFormAttendees] = useState("")
  const [formDepartment, setFormDepartment] = useState("")
  const [formWard, setFormWard] = useState("")
  const [formAllDay, setFormAllDay] = useState(false)
  const [formError, setFormError] = useState("")

  // Derived
  const departments = useMemo(
    () => [...new Set(allEvents.map((e) => e.department).filter(Boolean))],
    [allEvents]
  )

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      const matchSearch =
        !searchQuery ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.department || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchType = !typeFilter || e.event_type === typeFilter
      const matchStatus = !statusFilter || e.status === statusFilter
      return matchSearch && matchType && matchStatus
    })
  }, [allEvents, searchQuery, typeFilter, statusFilter])

  // Sort: upcoming first, then by start_time
  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )
  }, [filtered])

  // Stats
  const upcoming = allEvents.filter((e) => e.status === "Scheduled").length
  const today = allEvents.filter((e) => {
    const d = new Date(e.start_time)
    const now = new Date()
    return d.toDateString() === now.toDateString() && e.status !== "Cancelled"
  }).length
  const highPriority = allEvents.filter(
    (e) => e.priority === "High" && e.status === "Scheduled"
  ).length

  // Handlers
  const handleCreate = async () => {
    if (!formTitle.trim() || !formStart || !formEnd) {
      setFormError("Title, start time, and end time are required.")
      return
    }
    setCreating(true)
    setFormError("")
    try {
      const payload: EventCreateRequest = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        event_type: formType,
        priority: formPriority,
        start_time: new Date(formStart).toISOString(),
        end_time: new Date(formEnd).toISOString(),
        location: formLocation.trim(),
        attendees: formAttendees.trim(),
        department: formDepartment.trim(),
        ward: formWard.trim(),
        is_all_day: formAllDay,
      }
      await createEvent(payload)
      setShowCreate(false)
      resetForm()
      await refetch()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create event")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await deleteEvent(id)
      setShowDelete(null)
      setSelectedEvent(null)
      await refetch()
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateEvent(id, { status } as any)
      await refetch()
      if (selectedEvent?.id === id) {
        setSelectedEvent((prev) => prev ? { ...prev, status: status as any } : null)
      }
    } catch {
      // ignore
    }
  }

  const resetForm = () => {
    setFormTitle("")
    setFormDesc("")
    setFormType("Meeting")
    setFormPriority("Medium")
    setFormStart("")
    setFormEnd("")
    setFormLocation("")
    setFormAttendees("")
    setFormDepartment("")
    setFormWard("")
    setFormAllDay(false)
    setFormError("")
  }

  const initCreateForm = () => {
    resetForm()
    const now = new Date()
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    setFormStart(toLocalISO(now))
    setFormEnd(toLocalISO(later))
    setShowCreate(true)
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
            Schedule
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage meetings, hearings, site visits, and deadlines
          </p>
        </div>
        <button
          onClick={initCreateForm}
          className="flex items-center gap-2 border-3 border-foreground bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-[4px_4px_0px_0px] shadow-foreground/20 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          <Plus className="h-4 w-4" />
          New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-blue-100">
              <CalendarDays className="h-5 w-5 text-blue-900" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{upcoming}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Upcoming
              </p>
            </div>
          </div>
        </div>
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-amber-100">
              <Clock className="h-5 w-5 text-amber-900" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{today}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Today
              </p>
            </div>
          </div>
        </div>
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-900" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{highPriority}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                High Priority
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center border-2 border-foreground bg-card px-3 py-2 flex-1 max-w-md">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events..."
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
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="border-3 border-foreground bg-card shadow-[4px_4px_0px_0px] shadow-foreground/20">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground bg-muted/50">
              <TableHead className="font-black uppercase text-xs tracking-wider">Event</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Type</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Date & Time</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Location</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Priority</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider">Status</TableHead>
              <TableHead className="font-black uppercase text-xs tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-2 text-sm font-bold text-muted-foreground">No events found</p>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((evt) => (
                <TableRow
                  key={evt.id}
                  className="border-b border-foreground/10 cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => setSelectedEvent(evt)}
                >
                  <TableCell>
                    <div>
                      <p className="font-bold text-sm text-foreground">{evt.title}</p>
                      {evt.department && (
                        <p className="text-xs text-muted-foreground">{evt.department}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${EVENT_TYPE_COLORS[evt.event_type]}`}
                    >
                      {EVENT_TYPE_LABELS[evt.event_type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <p className="font-bold text-foreground">{formatDateOnly(evt.start_time)}</p>
                      <p className="text-muted-foreground">
                        {formatTimeOnly(evt.start_time)} — {formatTimeOnly(evt.end_time)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-foreground">{evt.location || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${PRIORITY_COLORS[evt.priority]}`}
                    >
                      {evt.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${STATUS_COLORS[evt.status] || STATUS_COLORS["Scheduled"]}`}
                    >
                      {evt.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEvent(evt)
                        }}
                        className="p-1.5 border border-foreground/20 hover:bg-muted"
                        title="View"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDelete(evt.id)
                        }}
                        className="p-1.5 border border-foreground/20 hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Event Detail Dialog ─────────────────────────────────── */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="border-3 border-foreground bg-card shadow-[8px_8px_0px_0px] shadow-foreground/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${EVENT_TYPE_COLORS[selectedEvent.event_type]}`}
                >
                  {EVENT_TYPE_LABELS[selectedEvent.event_type]}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${PRIORITY_COLORS[selectedEvent.priority]}`}
                >
                  {selectedEvent.priority} Priority
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 ${STATUS_COLORS[selectedEvent.status]}`}
                >
                  {selectedEvent.status}
                </span>
              </div>

              {selectedEvent.description && (
                <p className="text-sm text-foreground border-l-4 border-primary pl-3">
                  {selectedEvent.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Date & Time</p>
                    <p className="text-muted-foreground">{formatDateTime(selectedEvent.start_time)}</p>
                    <p className="text-muted-foreground">to {formatDateTime(selectedEvent.end_time)}</p>
                  </div>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Location</p>
                      <p className="text-muted-foreground">{selectedEvent.location}</p>
                    </div>
                  </div>
                )}
                {selectedEvent.attendees && (
                  <div className="flex items-start gap-2 col-span-2">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Attendees</p>
                      <p className="text-muted-foreground">{selectedEvent.attendees}</p>
                    </div>
                  </div>
                )}
                {selectedEvent.department && (
                  <div>
                    <p className="font-bold">Department</p>
                    <p className="text-muted-foreground">{selectedEvent.department}</p>
                  </div>
                )}
                {selectedEvent.ward && (
                  <div>
                    <p className="font-bold">Ward</p>
                    <p className="text-muted-foreground">{selectedEvent.ward}</p>
                  </div>
                )}
              </div>

              {/* Status Actions */}
              {selectedEvent.status === "Scheduled" && (
                <div className="flex gap-2 pt-2 border-t-2 border-foreground/10">
                  <button
                    onClick={() => handleStatusChange(selectedEvent.id, "In Progress")}
                    className="flex-1 border-2 border-foreground bg-amber-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-900 hover:bg-amber-200"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedEvent.id, "Completed")}
                    className="flex-1 border-2 border-foreground bg-emerald-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-900 hover:bg-emerald-200"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedEvent.id, "Cancelled")}
                    className="flex-1 border-2 border-foreground bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {selectedEvent.status === "In Progress" && (
                <div className="flex gap-2 pt-2 border-t-2 border-foreground/10">
                  <button
                    onClick={() => handleStatusChange(selectedEvent.id, "Completed")}
                    className="flex-1 border-2 border-foreground bg-emerald-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-900 hover:bg-emerald-200"
                  >
                    Mark Completed
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Event Dialog ─────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-3 border-foreground bg-card shadow-[8px_8px_0px_0px] shadow-foreground/20 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              New Event
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {formError && (
              <div className="border-2 border-red-900 bg-red-100 px-3 py-2 text-xs font-bold text-red-900">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Ward Development Meeting"
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
                placeholder="Details about the event..."
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Event Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as EventType)}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground"
                >
                  {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Priority
                </label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as EventPriority)}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Location
              </label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g., Municipal Hall, Room 201"
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Attendees
              </label>
              <input
                type="text"
                value={formAttendees}
                onChange={(e) => setFormAttendees(e.target.value)}
                placeholder="e.g., DM Singh, SDO Verma, Ward Members"
                className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  placeholder="e.g., Public Works"
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Ward
                </label>
                <input
                  type="text"
                  value={formWard}
                  onChange={(e) => setFormWard(e.target.value)}
                  placeholder="e.g., Karol Bagh"
                  className="w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formAllDay}
                onChange={(e) => setFormAllDay(e.target.checked)}
                className="h-4 w-4 border-2 border-foreground"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                All-day event
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t-2 border-foreground/10">
            <button
              onClick={() => setShowCreate(false)}
              className="border-2 border-foreground bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Event
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────────────────────── */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="border-3 border-foreground bg-card shadow-[8px_8px_0px_0px] shadow-foreground/20 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              Delete Event?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The event will be permanently removed.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowDelete(null)}
              className="border-2 border-foreground bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => showDelete && handleDelete(showDelete)}
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
