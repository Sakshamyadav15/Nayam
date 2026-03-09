import { cn } from "@/lib/utils"
import { Brain, AlertTriangle, TrendingUp } from "lucide-react"
import type { AIInsight } from "@/lib/types"

interface AIInsightCardProps {
  insight: AIInsight
}

const typeConfig = {
  recommendation: {
    icon: Brain,
    borderColor: "border-l-blue-700",
    label: "RECOMMENDATION",
    labelColor: "bg-blue-100 text-blue-900 border-blue-900",
  },
  alert: {
    icon: AlertTriangle,
    borderColor: "border-l-red-700",
    label: "ALERT",
    labelColor: "bg-red-100 text-red-900 border-red-900",
  },
  prediction: {
    icon: TrendingUp,
    borderColor: "border-l-amber-600",
    label: "PREDICTION",
    labelColor: "bg-amber-100 text-amber-900 border-amber-900",
  },
}

export function AIInsightCard({ insight }: AIInsightCardProps) {
  const config = typeConfig[insight.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "border-2 border-foreground border-l-4 bg-card p-4",
        config.borderColor
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border",
                config.labelColor
              )}
            >
              {config.label}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {insight.confidence}% confidence
            </span>
          </div>
          <h4 className="mt-1.5 text-sm font-bold text-card-foreground">
            {insight.title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  )
}
