import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  variant?: "status" | "priority" | "risk"
}

const statusColors: Record<string, string> = {
  open: "bg-amber-100 text-amber-900 border-amber-900",
  "in-progress": "bg-blue-100 text-blue-900 border-blue-900",
  resolved: "bg-emerald-100 text-emerald-900 border-emerald-900",
  escalated: "bg-red-100 text-red-900 border-red-900",
  pending: "bg-amber-100 text-amber-900 border-amber-900",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-900",
  rejected: "bg-red-100 text-red-900 border-red-900",
}

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800 border-slate-800",
  medium: "bg-amber-100 text-amber-900 border-amber-900",
  high: "bg-orange-100 text-orange-900 border-orange-900",
  critical: "bg-red-100 text-red-900 border-red-900",
}

const riskColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-900 border-emerald-900",
  medium: "bg-amber-100 text-amber-900 border-amber-900",
  high: "bg-orange-100 text-orange-900 border-orange-900",
  critical: "bg-red-100 text-red-900 border-red-900",
}

export function StatusBadge({ status, variant = "status" }: StatusBadgeProps) {
  const colorMap = variant === "priority" ? priorityColors : variant === "risk" ? riskColors : statusColors
  const colors = colorMap[status.toLowerCase()] || "bg-slate-100 text-slate-800 border-slate-800"

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider border-2",
        colors
      )}
    >
      {status}
    </span>
  )
}
