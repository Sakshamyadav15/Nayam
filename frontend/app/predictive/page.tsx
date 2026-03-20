"use client"

import { useState } from "react"
import {
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  BarChart3, Loader2, ChevronDown, ChevronUp
} from "lucide-react"
import {
  CartesianGrid, Line, LineChart,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
} from "recharts"
import { ChartCard } from "@/components/nayam/chart-card"
import { useApiData } from "@/hooks/use-api-data"

interface WardPrediction {
  ward: string
  weekly_actual: number[]
  weekly_predicted: number[]
  next_week_forecast: number
  trend_slope: number
  anomaly: boolean
  anomaly_reason: string
  high_priority_count: number
  risk: number
}

interface PredictiveResponse {
  wards: WardPrediction[]
  generated_at: string
}

async function fetchPredictive(): Promise<PredictiveResponse> {
  const res = await fetch("/api/v1/prediction")
  if (!res.ok) throw new Error("Failed to fetch predictive data")
  return res.json()
}

const WEEK_LABELS = ["W1", "W2", "W3", "W4", "W5"]

const WARD_COLORS = [
  "#c1292e", "#e8a838", "#3d5a80", "#16a34a",
  "#7c3aed", "#0891b2", "#ea580c", "#be185d",
]

// ── Anomaly card ──────────────────────────────────────────────────────

function AnomalyCard({ ward }: { ward: WardPrediction }) {
  const [open, setOpen] = useState(false)

  const severity =
    ward.risk >= 80 ? "critical" :
    ward.risk >= 60 ? "high" : "medium"

  const borderColor =
    severity === "critical" ? "border-l-red-700" :
    severity === "high"     ? "border-l-orange-600" : "border-l-amber-600"

  const textColor =
    severity === "critical" ? "text-red-700" :
    severity === "high"     ? "text-orange-600" : "text-amber-600"

  return (
    <div className={`border-2 border-foreground border-l-4 ${borderColor}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-3.5 w-3.5 ${textColor}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor}`}>
              {severity} — Anomaly Detected
            </span>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest
              border border-foreground/30 px-2 py-0.5 hover:bg-muted transition-colors ${textColor}`}
          >
            Why?
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        <p className="text-sm font-bold text-foreground">{ward.ward}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ward.weekly_actual[ward.weekly_actual.length - 1]} issues this week
          · {ward.high_priority_count} High priority
          · Risk score {ward.risk}
        </p>
      </div>

      {open && (
        <div className="border-t-2 border-foreground/20 bg-muted/40 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Reason
          </p>
          <p className="text-xs text-foreground leading-relaxed font-medium">
            {ward.anomaly_reason}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="border border-foreground/20 p-2">
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Actual</p>
              <p className="text-lg font-black text-foreground">
                {ward.weekly_actual[ward.weekly_actual.length - 1]}
              </p>
            </div>
            <div className="border border-foreground/20 p-2">
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Predicted</p>
              <p className="text-lg font-black text-foreground">
                {Math.round(ward.weekly_predicted[ward.weekly_predicted.length - 1])}
              </p>
            </div>
            <div className="border border-foreground/20 p-2">
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Ratio</p>
              <p className="text-lg font-black text-red-700">
                {(
                  ward.weekly_actual[ward.weekly_actual.length - 1] /
                  Math.max(ward.weekly_predicted[ward.weekly_predicted.length - 1], 1)
                ).toFixed(1)}×
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────

export default function PredictivePage() {
  const { data, isLoading, error } = useApiData(fetchPredictive, [])
  const wards: WardPrediction[] = data?.wards || []

  // Selected ward for the forecast chart
  const [selectedWard, setSelectedWard] = useState<string>("")
  const activeWardName = selectedWard || wards[0]?.ward || ""
  const activeWard     = wards.find((w) => w.ward === activeWardName)
  const activeColor    = WARD_COLORS[wards.findIndex((w) => w.ward === activeWardName) % WARD_COLORS.length]

  // Per-ward forecast chart data — actual solid, predicted dashed
  const forecastData = WEEK_LABELS.map((label, idx) => ({
    week:      label,
    actual:    activeWard?.weekly_actual[idx]    ?? 0,
    predicted: activeWard?.weekly_predicted[idx] ?? 0,
  }))

  // Risk trend — top 3 wards
  const topWards  = [...wards].sort((a, b) => b.risk - a.risk).slice(0, 3)
  const trendData = WEEK_LABELS.map((label, idx) => {
    const row: Record<string, string | number> = { week: label }
    topWards.forEach((w) => { row[w.ward] = w.weekly_actual[idx] ?? 0 })
    return row
  })

  const wardRanking = [...wards].sort((a, b) => b.risk - a.risk)
  const anomalies   = wards.filter((w) => w.anomaly)

  if (isLoading) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  if (error || wards.length === 0) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Predictive data unavailable
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ensure the backend is running and seed data has been loaded
          </p>
        </div>
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
          Ward-level forecasting · Weighted Moving Average model · 1.5× anomaly threshold
        </p>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Risk Trend — top 3 wards */}
        <ChartCard title="Risk Trend Analysis" subtitle="Weekly issue counts — top 3 wards by risk">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }} />
                <Tooltip contentStyle={{ border: "2px solid #1a1a2e", borderRadius: 0, fontWeight: 700, fontSize: 12 }} />
                {topWards.map((w, idx) => (
                  <Line key={w.ward} type="monotone" dataKey={w.ward}
                    stroke={WARD_COLORS[idx]} strokeWidth={3} name={w.ward}
                    dot={{ fill: WARD_COLORS[idx], stroke: "#1a1a2e", strokeWidth: 2, r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Ward-by-ward forecast — actual vs predicted */}
        <ChartCard
          title="Issue Forecast"
          subtitle={`${activeWardName} — Actual (solid) vs WMA Predicted (dashed)`}
        >
          {/* Ward selector tabs */}
          <div className="flex flex-wrap gap-1 mb-3">
            {wards.map((w, idx) => (
              <button
                key={w.ward}
                onClick={() => setSelectedWard(w.ward)}
                className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                  w.ward === activeWardName
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/30 text-muted-foreground hover:border-foreground/60"
                }`}
              >
                {w.ward}
              </button>
            ))}
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: "#1a1a2e", strokeWidth: 2 }} />
                <Tooltip contentStyle={{ border: "2px solid #1a1a2e", borderRadius: 0, fontWeight: 700, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                {/* Actual — solid line */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={activeColor}
                  strokeWidth={3}
                  name="Actual"
                  dot={{ fill: activeColor, stroke: "#1a1a2e", strokeWidth: 2, r: 5 }}
                />
                {/* Predicted — dashed line */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke={activeColor}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  name="Predicted (WMA)"
                  dot={{ fill: "#fff", stroke: activeColor, strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Next week forecast pill */}
          {activeWard && (
            <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Next week forecast
              </span>
              <span className="text-sm font-black text-foreground">
                ~{Math.round(activeWard.next_week_forecast)} issues
              </span>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Ward ranking & anomalies */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Ward risk ranking */}
        <ChartCard title="Ward Risk Ranking" subtitle="Ordered by composite risk score">
          <div className="space-y-2">
            {wardRanking.map((w, i) => (
              <button
                key={w.ward}
                onClick={() => setSelectedWard(w.ward)}
                className={`flex w-full items-center gap-3 border-2 p-3 text-left transition-colors ${
                  w.ward === activeWardName
                    ? "border-foreground bg-muted"
                    : "border-foreground/20 hover:border-foreground/40"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center border-2 text-xs font-black ${
                  i === 0 ? "border-red-700 bg-red-100 text-red-900" :
                  i < 3   ? "border-orange-700 bg-orange-100 text-orange-900" :
                            "border-foreground bg-muted text-foreground"
                }`}>{i + 1}</span>
                <span className="flex-1 text-sm font-bold text-foreground">{w.ward}</span>
                <div className="flex items-center gap-2">
                  {w.trend_slope >  0.5 && <TrendingUp  className="h-3.5 w-3.5 text-red-600" />}
                  {w.trend_slope < -0.5 && <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />}
                  {Math.abs(w.trend_slope) <= 0.5 && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                  <div className="w-20 h-3 bg-muted border border-foreground/20 overflow-hidden">
                    <div className={`h-full ${
                      w.risk >= 80 ? "bg-red-600" : w.risk >= 60 ? "bg-orange-500" :
                      w.risk >= 30 ? "bg-amber-500" : "bg-emerald-500"
                    }`} style={{ width: `${w.risk}%` }} />
                  </div>
                  <span className="text-sm font-black text-foreground w-8 text-right">{w.risk}</span>
                  {w.anomaly && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                </div>
              </button>
            ))}
          </div>
        </ChartCard>

        {/* Anomaly alerts */}
        <div className="space-y-4">
          <ChartCard
            title="Anomaly Alerts"
            subtitle={`${anomalies.length} ward(s) exceed 1.5× predicted baseline`}
          >
            <div className="space-y-3">
              {anomalies.length === 0 ? (
                <div className="flex h-32 items-center justify-center border-2 border-dashed border-foreground/30">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    No anomalies detected this week
                  </p>
                </div>
              ) : (
                anomalies.map((w) => <AnomalyCard key={w.ward} ward={w} />)
              )}
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
