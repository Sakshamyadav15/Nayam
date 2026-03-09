"use client"

import { useState, useMemo } from "react"
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2 } from "lucide-react"
import { MapPlaceholder } from "@/components/nayam/map-placeholder"
import { ChartCard } from "@/components/nayam/chart-card"
import { useApiData } from "@/hooks/use-api-data"
import { fetchIssues } from "@/lib/services"
import type { Issue } from "@/lib/types"

export default function GeoAnalyticsPage() {
  const [selectedWard, setSelectedWard] = useState<string | null>(null)
  const { data, isLoading } = useApiData(() => fetchIssues({ limit: 500 }), [])
  const issues: Issue[] = data?.issues || []

  // Derive ward risk data from real issues
  const wardRiskData = useMemo(() => {
    const wardMap: Record<string, { count: number; highPriority: number }> = {}
    for (const i of issues) {
      const w = i.ward || "Unknown"
      if (!wardMap[w]) wardMap[w] = { count: 0, highPriority: 0 }
      wardMap[w].count++
      if (i.priority === "high" || i.priority === "critical") wardMap[w].highPriority++
    }
    const maxCount = Math.max(...Object.values(wardMap).map((d) => d.count), 1)
    return Object.entries(wardMap).map(([ward, d]) => {
      const volumeScore = (d.count / maxCount) * 50
      const severityScore = (d.highPriority / Math.max(d.count, 1)) * 50
      const ratio = d.highPriority / Math.max(d.count, 1)
      return {
        ward,
        risk: Math.min(100, Math.round(volumeScore + severityScore)),
        issues: d.count,
        trend: ratio > 0.5 ? "rising" as const : ratio > 0.25 ? "stable" as const : "falling" as const,
      }
    }).sort((a, b) => b.risk - a.risk)
  }, [issues])

  // Auto-select first ward
  const activeWard = selectedWard || wardRiskData[0]?.ward || null
  const ward = wardRiskData.find((w) => w.ward === activeWard)

  if (isLoading) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">
          Geo Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spatial intelligence and ward-level risk mapping
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Map Area */}
        <div className="lg:col-span-2 space-y-4">
          <MapPlaceholder
            className="h-96"
            label="Ward Risk Heatmap"
            wards={wardRiskData}
            activeWard={activeWard}
            onWardClick={(ward) => setSelectedWard(ward)}
          />

          {/* Legend & Filters */}
          <div className="flex flex-wrap items-center gap-4 border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Heatmap Legend:
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-6 bg-emerald-500 border border-foreground" />
                <span className="text-[10px] font-bold text-foreground">Low (0-30)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-6 bg-amber-500 border border-foreground" />
                <span className="text-[10px] font-bold text-foreground">Medium (31-60)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-6 bg-orange-500 border border-foreground" />
                <span className="text-[10px] font-bold text-foreground">High (61-80)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-6 bg-red-600 border border-foreground" />
                <span className="text-[10px] font-bold text-foreground">Critical (81+)</span>
              </div>
            </div>
          </div>

          {/* Ward Risk Cluster Table */}
          <ChartCard title="Ward Risk Breakdown" subtitle="Cluster analysis by ward">
            <div className="space-y-2">
              {wardRiskData
                .sort((a, b) => b.risk - a.risk)
                .map((w) => (
                  <button
                    key={w.ward}
                    onClick={() => setSelectedWard(w.ward)}
                    className={`flex w-full items-center justify-between border-2 p-3 text-left transition-colors ${
                      activeWard === w.ward
                        ? "border-foreground bg-muted"
                        : "border-foreground/20 bg-card hover:border-foreground/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground">{w.ward}</span>
                      <span className="text-xs text-muted-foreground">
                        {w.issues} issues
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {w.trend === "rising" && (
                        <TrendingUp className="h-3.5 w-3.5 text-red-600" />
                      )}
                      {w.trend === "falling" && (
                        <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      {w.trend === "stable" && (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <div className="w-24 h-3 bg-muted border border-foreground/20 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            w.risk >= 80
                              ? "bg-red-600"
                              : w.risk >= 60
                              ? "bg-orange-500"
                              : w.risk >= 30
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${w.risk}%` }}
                        />
                      </div>
                      <span
                        className={`text-sm font-black w-8 text-right ${
                          w.risk >= 80
                            ? "text-red-700"
                            : w.risk >= 60
                            ? "text-orange-700"
                            : w.risk >= 30
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {w.risk}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </ChartCard>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Ward Details */}
          {ward && (
            <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20">
              <h3 className="text-xs font-black uppercase tracking-widest text-card-foreground mb-4">
                {ward.ward} Details
              </h3>
              <div className="space-y-4">
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Risk Index</p>
                  <p
                    className={`mt-1 text-3xl font-black ${
                      ward.risk >= 80
                        ? "text-red-700"
                        : ward.risk >= 60
                        ? "text-orange-700"
                        : ward.risk >= 30
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {ward.risk}
                    <span className="text-sm text-muted-foreground">/100</span>
                  </p>
                </div>

                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Issues</p>
                  <p className="mt-1 text-2xl font-black text-foreground">{ward.issues}</p>
                </div>

                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trend</p>
                  <div className="mt-1 flex items-center gap-2">
                    {ward.trend === "rising" && (
                      <>
                        <TrendingUp className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-bold text-red-700 uppercase">Rising</span>
                      </>
                    )}
                    {ward.trend === "falling" && (
                      <>
                        <TrendingDown className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-700 uppercase">Falling</span>
                      </>
                    )}
                    {ward.trend === "stable" && (
                      <>
                        <Minus className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-bold text-muted-foreground uppercase">Stable</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Trend Summary
                  </p>
                  <p className="mt-1 text-xs text-foreground leading-relaxed">
                    {ward.risk >= 80
                      ? "Critical risk zone requiring immediate coordinated intervention across multiple departments."
                      : ward.risk >= 60
                      ? "Elevated risk indicators detected. Proactive measures recommended within 48 hours."
                      : ward.risk >= 30
                      ? "Moderate risk levels within acceptable parameters. Continued monitoring advised."
                      : "Low risk profile. Standard operational monitoring sufficient."}
                  </p>
                </div>

                {ward.risk >= 60 && (
                  <div className="border-2 border-foreground border-l-4 border-l-amber-600 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        Suggested Intervention
                      </p>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">
                      Deploy rapid response team for assessment. Coordinate with local administration for resource allocation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
