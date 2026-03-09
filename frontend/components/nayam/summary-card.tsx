import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SummaryCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: "up" | "down" | "stable"
  trendValue?: string
  variant?: "default" | "warning" | "danger" | "success"
}

const variantStyles = {
  default: "border-foreground bg-card",
  warning: "border-amber-900 bg-amber-50",
  danger: "border-red-900 bg-red-50",
  success: "border-emerald-900 bg-emerald-50",
}

const iconVariantStyles = {
  default: "bg-primary text-primary-foreground",
  warning: "bg-amber-900 text-amber-50",
  danger: "bg-red-900 text-red-50",
  success: "bg-emerald-900 text-emerald-50",
}

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        "border-3 p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[6px_6px_0px_0px] hover:shadow-foreground/20 hover:-translate-x-0.5 hover:-translate-y-0.5",
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-card-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-bold",
                  trend === "up" && "text-red-700",
                  trend === "down" && "text-emerald-700",
                  trend === "stable" && "text-muted-foreground"
                )}
              >
                {trend === "up" ? "+" : trend === "down" ? "-" : ""}
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center border-2 border-foreground",
            iconVariantStyles[variant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
