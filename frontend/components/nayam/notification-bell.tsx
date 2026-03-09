"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell, AlertTriangle, FileText, Shield, X, RefreshCw } from "lucide-react"
import { fetchNotifications } from "@/lib/services"
import type { NotificationItem } from "@/lib/types"

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  critical_issue: AlertTriangle,
  pending_approval: Shield,
  new_document: FileText,
  system: Bell,
}

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "border-l-red-600 bg-red-50 dark:bg-red-950/20",
  warning: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
  info: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20",
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchNotifications()
      setItems(data.items)
      setTotal(data.total)
    } catch {
      // silent — keep last data
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + poll every 30s
  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const visibleItems = items.filter((n) => !dismissed.has(n.id))
  const visibleCount = visibleItems.length

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }

  const handleClick = (item: NotificationItem) => {
    if (item.link) {
      router.push(item.link)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center border-2 border-foreground bg-background transition-colors hover:bg-muted"
        aria-label={`Notifications (${visibleCount})`}
      >
        <Bell className="h-4 w-4 text-foreground" />
        {visibleCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center bg-red-600 px-0.5 text-[10px] font-bold text-white">
            {visibleCount > 99 ? "99+" : visibleCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-h-[28rem] overflow-hidden border-3 border-foreground bg-card shadow-[6px_6px_0px_0px] shadow-foreground/20 sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-foreground" />
              <span className="text-xs font-black uppercase tracking-widest text-foreground">
                Notifications
              </span>
              {visibleCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center bg-red-600 px-1 text-[10px] font-bold text-white">
                  {visibleCount}
                </span>
              )}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Items */}
          <div className="max-h-[22rem] overflow-y-auto">
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs font-bold">All caught up!</p>
                <p className="text-[10px]">No new notifications</p>
              </div>
            ) : (
              visibleItems.map((item) => {
                const Icon = ICON_MAP[item.type] || Bell
                const severityClass = SEVERITY_CLASSES[item.severity] || SEVERITY_CLASSES.info
                return (
                  <div
                    key={item.id}
                    className={`group flex items-start gap-3 border-b border-foreground/10 border-l-4 px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer ${severityClass}`}
                  >
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => handleClick(item)}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
                        <p className="text-xs font-bold text-foreground truncate">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.detail}
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        {timeAgo(item.timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDismiss(item.id)
                      }}
                      className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {visibleItems.length > 0 && (
            <div className="border-t-2 border-foreground px-4 py-2">
              <button
                onClick={() => setDismissed(new Set(items.map((n) => n.id)))}
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
