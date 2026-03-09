import { cn } from "@/lib/utils"
import { MapPin } from "lucide-react"

interface WardData {
  ward: string
  risk: number
  issues: number
  trend: "rising" | "stable" | "falling"
}

interface MapPlaceholderProps {
  className?: string
  label?: string
  wards?: WardData[]
  onWardClick?: (ward: string) => void
  activeWard?: string | null
}

function riskColor(risk: number): string {
  if (risk >= 80) return "bg-red-600"
  if (risk >= 60) return "bg-orange-500"
  if (risk >= 30) return "bg-amber-500"
  return "bg-emerald-500"
}

function riskGlow(risk: number): string {
  if (risk >= 80) return "shadow-red-500/40"
  if (risk >= 60) return "shadow-orange-400/30"
  if (risk >= 30) return "shadow-amber-400/20"
  return "shadow-emerald-400/20"
}

export function MapPlaceholder({
  className,
  label = "Geo Spatial View",
  wards = [],
  onWardClick,
  activeWard,
}: MapPlaceholderProps) {
  // Grid layout positions for wards (deterministic placement)
  const positions = [
    { row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 },
    { row: 2, col: 2 }, { row: 2, col: 4 },
    { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 },
  ]

  return (
    <div
      className={cn(
        "relative flex items-center justify-center border-3 border-foreground bg-muted overflow-hidden",
        className
      )}
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {wards.length > 0 ? (
        /* Data-driven ward heatmap grid */
        <div className="relative z-10 grid grid-cols-6 grid-rows-4 gap-3 p-6 w-full h-full">
          {wards.slice(0, 8).map((w, i) => {
            const pos = positions[i] || { row: 1, col: 1 }
            const isActive = activeWard === w.ward
            return (
              <button
                key={w.ward}
                onClick={() => onWardClick?.(w.ward)}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-sm border-2 p-2 transition-all shadow-lg",
                  riskColor(w.risk),
                  riskGlow(w.risk),
                  isActive
                    ? "border-foreground ring-2 ring-foreground scale-105"
                    : "border-foreground/30 hover:border-foreground hover:scale-105"
                )}
                style={{
                  gridRow: pos.row,
                  gridColumn: `${pos.col} / span 2`,
                }}
              >
                <MapPin className="h-4 w-4 text-white/90 mb-0.5" />
                <span className="text-[9px] font-black uppercase tracking-wider text-white leading-tight">
                  {w.ward}
                </span>
                <span className="text-[8px] font-bold text-white/80">
                  {w.risk} risk · {w.issues} issues
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        /* Empty state */
        <>
          <div className="absolute top-1/4 left-1/3 h-16 w-16 rounded-full bg-muted-foreground/10 blur-xl" />
          <div className="absolute bottom-1/4 right-1/3 h-20 w-20 rounded-full bg-muted-foreground/10 blur-xl" />
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-foreground bg-card">
              <MapPin className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {label}
            </span>
            <span className="text-[10px] text-muted-foreground">No ward data available</span>
          </div>
        </>
      )}

      {/* Label overlay */}
      {wards.length > 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <span className="bg-card/80 backdrop-blur-sm border border-foreground/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        </div>
      )}
    </div>
  )
}
