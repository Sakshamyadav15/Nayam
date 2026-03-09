"use client"

import { usePathname } from "next/navigation"
import { Search, Brain, ChevronRight, LogOut } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { SyncIndicator } from "@/components/nayam/sync-indicator"
import { NotificationBell } from "@/components/nayam/notification-bell"
import { useAuth } from "@/lib/auth-context"

const pathLabels: Record<string, string> = {
  "/": "Dashboard",
  "/citizens": "Citizens",
  "/issues": "Issues",
  "/documents": "Documents",
  "/intelligence": "Intelligence",
  "/geo-analytics": "Geo Analytics",
  "/predictive": "Predictive Insights",
  "/approvals": "Approvals",
  "/compliance": "Compliance & Audit",
  "/monitoring": "Monitoring",
  "/schedule": "Schedule",
  "/drafts": "Drafts",
  "/bhashini": "Bhashini",
  "/settings": "Settings",
}

export function Topbar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const currentLabel = pathLabels[pathname] || "NAYAM"

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"
  const displayName = user?.name?.split(" ").slice(-1)[0] || "User"
  const roleName = user?.role || "staff"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b-3 border-foreground bg-card px-4">
      <SidebarTrigger className="md:hidden" />

      {/* Breadcrumbs */}
      <nav className="hidden items-center gap-1.5 text-xs md:flex" aria-label="Breadcrumb">
        <span className="font-bold uppercase tracking-widest text-muted-foreground">
          NAYAM
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-bold uppercase tracking-widest text-foreground">
          {currentLabel}
        </span>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {/* Search */}
        <div className="hidden items-center border-2 border-foreground bg-background px-3 py-1.5 lg:flex">
          <Search className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search or ask AI..."
            className="w-48 bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="ml-2 flex items-center gap-1 border border-foreground/20 px-1.5 py-0.5">
            <Brain className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground">AI</span>
          </div>
        </div>

        {/* AI Activity */}
        <div className="hidden items-center gap-1.5 px-2 py-1 sm:flex">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            AI Active
          </span>
        </div>

        {/* Sync Status */}
        <SyncIndicator status="online" />

        {/* Notifications */}
        <NotificationBell />

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-primary font-bold text-xs text-primary-foreground">
            {initials}
          </div>
          <div className="hidden flex-col md:flex">
            <span className="text-xs font-bold text-foreground">{displayName}</span>
            <span className="inline-flex w-fit items-center border border-foreground/30 bg-primary/10 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider text-primary">
              {roleName}
            </span>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-background transition-colors hover:bg-destructive hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
