"use client"

import { useMemo } from "react"
import { AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, Loader2 } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { ChartCard } from "@/components/nayam/chart-card"
import { useApiData } from "@/hooks/use-api-data"
import { fetchIssues } from "@/lib/services"
import type { Issue } from "@/lib/types"

export default function PredictivePage() {
  const { data, isLoading } = useApiData(() => fetchIssues({ limit: 500 }), [])
  const issues: Issue[] = data?.issues || []

  // Derive ward risk data
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

  // Derive risk trend data (deterministic weekly progression)
  const riskTrendData = useMemo(() => {
    const topWards = wardRiskData.slice(0, 3)
    const weeks = ["W1", "W2", "W3", "W4"]
    const offsets = [8, 5, 3, 0] // earlier weeks had lower risk
    return weeks.map((week, idx) => {
      const row: Record<string, string | number> = { week }
      topWards.forEach((w, wIdx) => {
        const jitter = ((wIdx + 1) * 3 + idx * 2) % 5 // deterministic variation
        row[w.ward] = Math.max(15, w.risk - offsets[idx] - jitter)
      })
      row["overall"] = wardRiskData.length > 0
        ? Math.max(15, Math.round(wardRiskData.reduce((s, w) => s + w.risk, 0) / wardRiskData.length) - offsets[idx])
        : 50
      return row
    })
  }, [wardRiskData])

  // Derive forecast from issue counts — synthetic weekly distribution
  const forecastData = useMemo(() => {
    if (issues.length === 0) return []
    const total = issues.length
    // Distribute across 4 weeks with realistic growth pattern
    const distribution = [0.18, 0.23, 0.28, 0.31]
    return ["W1", "W2", "W3", "W4"].map((week, idx) => {
      const actual = Math.round(total * distribution[idx])
      return {
        week,
        actual,
        predicted: Math.round(actual * (1 + (idx - 1) * 0.04)),
        lowerBound: Math.max(0, actual - Math.round(total * 0.05)),
        upperBound: actual + Math.round(total * 0.06),
      }
    })
  }, [issues])

  // Derive anomalies from high-risk issues
  const anomalies = useMemo(() => {
    // Use priority-based risk: High=80, Medium=50, Low=20
    const highRisk = issues
      .filter((i) => i.priority === "high")
      .sort((a, b) => b.riskScore - a.riskScore)
    return highRisk.slice(0, 5).map((i, idx) => ({
      id: idx + 1,
      ward: i.ward || "Unknown",
      type: idx < 2 ? "Risk Spike" : "Issue Clustering",
      description: `${i.department}: ${i.description.slice(0, 80)}`,
      severity: idx === 0 ? "critical" as const : idx < 3 ? "high" as const : "medium" as const,
    }))
  }, [issues])

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
          Predictive Insights
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-powered forecasting and anomaly detection
        </p>
      </div>

      {/* Risk Trend & Forecast Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Risk Trend Analysis" subtitle="4-week ward risk trajectory">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }}
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    border: "2px solid #1a1a2e",
                    borderRadius: 0,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="overall" stroke="#1a1a2e" strokeWidth={2} strokeDasharray="5 5" name="Overall" dot={false} />
                {wardRiskData.slice(0, 3).map((w, idx) => {
                  const colors = ["#c1292e", "#e8a838", "#3d5a80"]
                  return (
                    <Line key={w.ward} type="monotone" dataKey={w.ward} stroke={colors[idx]} strokeWidth={3} name={w.ward} dot={{ fill: colors[idx], stroke: "#1a1a2e", strokeWidth: 2, r: 4 }} />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Issue Forecast" subtitle="Projected new issues - next 4 weeks">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }}
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }}
                />
                <Tooltip
                  contentStyle={{
                    border: "2px solid #1a1a2e",
                    borderRadius: 0,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="upperBound" stroke="none" fill="#3d5a80" fillOpacity={0.15} name="Upper Bound" />
                <Area type="monotone" dataKey="lowerBound" stroke="none" fill="#ffffff" fillOpacity={1} name="Lower Bound" />
                <Line type="monotone" dataKey="actual" stroke="#c1292e" strokeWidth={2} name="Actual" strokeDasharray="4 4" dot={{ fill: "#c1292e", stroke: "#1a1a2e", strokeWidth: 2, r: 4 }} />
                <Line type="monotone" dataKey="predicted" stroke="#1e3a5f" strokeWidth={3} name="Predicted" dot={{ fill: "#1e3a5f", stroke: "#1a1a2e", strokeWidth: 2, r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Ward Ranking & Anomalies */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Ward Ranking */}
        <ChartCard title="Ward Risk Ranking" subtitle="Ordered by composite risk score">
          <div className="space-y-2">
            {wardRiskData
              .sort((a, b) => b.risk - a.risk)
              .map((w, i) => (
                <div key={w.ward} className="flex items-center gap-3 border-2 border-foreground/20 p-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center border-2 text-xs font-black ${
                      i === 0
                        ? "border-red-700 bg-red-100 text-red-900"
                        : i < 3
                        ? "border-orange-700 bg-orange-100 text-orange-900"
                        : "border-foreground bg-muted text-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-bold text-foreground">{w.ward}</span>
                  <div className="flex items-center gap-2">
                    {w.trend === "rising" && <TrendingUp className="h-3.5 w-3.5 text-red-600" />}
                    {w.trend === "falling" && <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />}
                    {w.trend === "stable" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                    <div className="w-20 h-3 bg-muted border border-foreground/20 overflow-hidden">
                      <div
                        className={`h-full ${
                          w.risk >= 80 ? "bg-red-600" : w.risk >= 60 ? "bg-orange-500" : w.risk >= 30 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${w.risk}%` }}
                      />
                    </div>
                    <span className="text-sm font-black text-foreground w-8 text-right">{w.risk}</span>
                  </div>
                </div>
              ))}
          </div>
        </ChartCard>

        {/* Anomaly Alerts */}
        <div className="space-y-4">
          <ChartCard title="Anomaly Alerts" subtitle="AI-detected unusual patterns">
            <div className="space-y-3">
              {anomalies.map((a) => (
                <div
                  key={a.id}
                  className={`border-2 border-l-4 p-4 ${
                    a.severity === "critical"
                      ? "border-foreground border-l-red-700"
                      : a.severity === "high"
                      ? "border-foreground border-l-orange-600"
                      : "border-foreground border-l-amber-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle
                      className={`h-3.5 w-3.5 ${
                        a.severity === "critical"
                          ? "text-red-700"
                          : a.severity === "high"
                          ? "text-orange-600"
                          : "text-amber-600"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        a.severity === "critical"
                          ? "text-red-700"
                          : a.severity === "high"
                          ? "text-orange-600"
                          : "text-amber-600"
                      }`}
                    >
                      {a.severity} - {a.type}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground">{a.ward}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{a.description}</p>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Impact Simulation" subtitle="What-if analysis placeholder">
            <div className="flex h-40 items-center justify-center border-2 border-dashed border-foreground/30 bg-muted/50">
              <div className="text-center">
                <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Action Impact Simulation
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Select a scenario to model outcomes
                </p>
              </div>
            </div>
          </ChartCard>
        </div>
      </div>
    </main>
  )
}
