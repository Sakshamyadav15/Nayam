import { cn } from "@/lib/utils"
import { Wifi, WifiOff, RefreshCw } from "lucide-react"

interface SyncIndicatorProps {
  status: "online" | "offline" | "syncing"
  className?: string
}

export function SyncIndicator({ status, className }: SyncIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 text-xs font-bold uppercase tracking-wider border-2",
        status === "online" && "border-emerald-900 bg-emerald-100 text-emerald-900",
        status === "offline" && "border-red-900 bg-red-100 text-red-900",
        status === "syncing" && "border-amber-900 bg-amber-100 text-amber-900",
        className
      )}
    >
      {status === "online" && <Wifi className="h-3 w-3" />}
      {status === "offline" && <WifiOff className="h-3 w-3" />}
      {status === "syncing" && <RefreshCw className="h-3 w-3 animate-spin" />}
      {status}
    </div>
  )
}
