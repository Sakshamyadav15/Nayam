"use client"

import { useMemo } from "react"
import {
  AlertCircle,
  Briefcase,
  ShieldAlert,
  CheckSquare,
  Server,
  Loader2,
} from "lucide-react"
import {
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
import { SummaryCard } from "@/components/nayam/summary-card"
import { ChartCard } from "@/components/nayam/chart-card"
import { AIInsightCard } from "@/components/nayam/ai-insight-card"
import { MapPlaceholder } from "@/components/nayam/map-placeholder"
import { useApiData } from "@/hooks/use-api-data"
import { fetchDashboard, fetchIssues, fetchPendingApprovals } from "@/lib/services"
import type { DashboardResponse, Issue, Approval, AIInsight } from "@/lib/types"

export default function DashboardPage() {
  const { data: dashboard, isLoading: loadingDash } = useApiData<DashboardResponse>(fetchDashboard)
  const { data: issuesData } = useApiData(() => fetchIssues({ limit: 500 }), [])
  const { data: pendingApprovals } = useApiData<Approval[]>(() => fetchPendingApprovals(), [])

  const issues = issuesData?.issues || []

  // Derive ward risk data from issues
  const wardRiskData = useMemo(() => {
    const wardMap: Record<string, { count: number; highPriority: number }> = {}
    for (const i of issues) {
      const w = i.ward || "Unknown"
      if (!wardMap[w]) wardMap[w] = { count: 0, highPriority: 0 }
      wardMap[w].count++
      if (i.priority === "high" || i.priority === "critical") wardMap[w].highPriority++
    }

    // Normalised risk formula (matches geo-analytics page)
    const entries = Object.entries(wardMap)
    const maxCount = Math.max(...entries.map(([, d]) => d.count), 1)

    return entries.map(([ward, d]) => {
      const volumeScore = (d.count / maxCount) * 50            // 0-50, relative to busiest ward
      const severityScore = (d.highPriority / Math.max(d.count, 1)) * 50  // 0-50, ratio-based
      return {
        ward,
        risk: Math.min(100, Math.round(volumeScore + severityScore)),
        issues: d.count,
        trend: d.highPriority > 1 ? "rising" as const : d.count > 3 ? "stable" as const : "falling" as const,
      }
    }).sort((a, b) => b.risk - a.risk)
  }, [issues])

  // Derive issue trend data from issues by creation month
  const issueTrendData = useMemo(() => {
    const monthMap: Record<string, { open: number; resolved: number; escalated: number }> = {}
    for (const i of issues) {
      const month = i.createdDate?.slice(0, 7) || "Unknown"
      if (!monthMap[month]) monthMap[month] = { open: 0, resolved: 0, escalated: 0 }
      if (i.status === "open") monthMap[month].open++
      else if (i.status === "resolved") monthMap[month].resolved++
      else if (i.status === "escalated") monthMap[month].escalated++
      else monthMap[month].open++
    }
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, d]) => ({ month, ...d }))
  }, [issues])

  // AI insights derived from dashboard data
  const aiInsights: AIInsight[] = useMemo(() => {
    if (!dashboard) return []
    const insights: AIInsight[] = []
    const topDept = dashboard.issues_by_department?.sort((a, b) => b.count - a.count)[0]
    if (topDept) {
      insights.push({
        id: "ai-1",
        title: `${topDept.department} Department Overloaded`,
        description: `${topDept.department} has ${topDept.count} issues — highest across all departments.`,
        confidence: 92,
        type: "alert",
        timestamp: new Date().toISOString(),
      })
    }
    if (wardRiskData.length > 0) {
      const topWard = wardRiskData[0]
      insights.push({
        id: "ai-2",
        title: `${topWard.ward} Risk Elevated`,
        description: `Composite risk score of ${topWard.risk} with ${topWard.issues} active issues.`,
        confidence: 88,
        type: "prediction",
        timestamp: new Date().toISOString(),
      })
    }
    insights.push({
      id: "ai-3",
      title: "Resource Optimization Opportunity",
      description: `${dashboard.total_documents} documents analysed. Cross-reference with active issues recommended.`,
      confidence: 79,
      type: "recommendation",
      timestamp: new Date().toISOString(),
    })
    return insights
  }, [dashboard, wardRiskData])

  // Sync activity from recent documents
  const syncActivity = useMemo(() => {
    return (dashboard?.recent_documents || []).slice(0, 4).map((d, i) => ({
      id: `sync-${i}`,
      action: `Document synced: ${d.title}`,
      timestamp: d.created_at?.replace("T", " ").slice(0, 16) || "",
      status: "success" as const,
    }))
  }, [dashboard])

  const totalIssues = dashboard?.total_issues ?? 0
  const openIssues = dashboard?.issues_by_status?.find((s) => s.status === "Open")?.count ?? 0
  const avgRisk = wardRiskData.length > 0 ? (wardRiskData.reduce((s, w) => s + w.risk, 0) / wardRiskData.length).toFixed(1) : "0"

  if (loadingDash) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">
          Command Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time governance overview and strategic intelligence
        </p>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Total Issues"
          value={totalIssues}
          icon={AlertCircle}
          trend="up"
          trendValue={`${openIssues} open`}
          subtitle="tracked in system"
        />
        <SummaryCard
          title="Active Cases"
          value={openIssues}
          icon={Briefcase}
          subtitle="currently open"
          variant="warning"
        />
        <SummaryCard
          title="Risk Score"
          value={avgRisk}
          icon={ShieldAlert}
          subtitle="avg ward composite"
          variant="danger"
        />
        <SummaryCard
          title="Pending Approvals"
          value={pendingApprovals?.length ?? 0}
          icon={CheckSquare}
          subtitle="requiring action"
        />
        <SummaryCard
          title="Documents"
          value={dashboard?.total_documents ?? 0}
          icon={Server}
          subtitle="in repository"
          variant="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Risk by Ward" subtitle="Composite risk score per ward">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardRiskData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="ward"
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
                <Bar
                  dataKey="risk"
                  fill="#1e3a5f"
                  stroke="#1a1a2e"
                  strokeWidth={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Issue Trends" subtitle="6-month issue flow analysis">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={issueTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
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
                <Line
                  type="monotone"
                  dataKey="open"
                  stroke="#e8a838"
                  strokeWidth={3}
                  dot={{ fill: "#e8a838", stroke: "#1a1a2e", strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  stroke="#2d8a4e"
                  strokeWidth={3}
                  dot={{ fill: "#2d8a4e", stroke: "#1a1a2e", strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="escalated"
                  stroke="#c1292e"
                  strokeWidth={3}
                  dot={{ fill: "#c1292e", stroke: "#1a1a2e", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Geo Snapshot" subtitle="Spatial risk distribution">
          <MapPlaceholder className="h-64" label="Geo Spatial View" wards={wardRiskData} />
        </ChartCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* AI Insights */}
        <ChartCard title="AI Insights" subtitle="Latest intelligence analysis" className="lg:col-span-1">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {aiInsights.map((insight) => (
              <AIInsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </ChartCard>

        {/* Recent Activity */}
        <ChartCard title="Recent Activity" subtitle="Platform-wide activity feed" className="lg:col-span-1">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {[
              { action: "ISS-003 escalated to critical", time: "2 min ago", type: "alert" },
              { action: "APR-005 approved by Commissioner", time: "15 min ago", type: "approval" },
              { action: "New document uploaded: Water Audit", time: "32 min ago", type: "document" },
              { action: "Ward 12 risk score updated: 78", time: "1 hr ago", type: "update" },
              { action: "AI prediction: Ward 3 risk rising", time: "1.5 hr ago", type: "ai" },
              { action: "Citizen record CIT-004 modified", time: "2 hr ago", type: "update" },
              { action: "Weekly compliance report generated", time: "3 hr ago", type: "system" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border-l-3 border-foreground/20 pl-3 py-1"
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold text-card-foreground">{item.action}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Sync Activity */}
        <ChartCard title="Sync Activity" subtitle="Data synchronization log" className="lg:col-span-1">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {syncActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-l-3 pl-3 py-1"
                style={{
                  borderLeftColor:
                    item.status === "success" ? "#2d8a4e" : "#e8a838",
                }}
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold text-card-foreground">{item.action}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{item.timestamp}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${
                    item.status === "success"
                      ? "border-emerald-900 bg-emerald-100 text-emerald-900"
                      : "border-amber-900 bg-amber-100 text-amber-900"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </main>
  )
}
