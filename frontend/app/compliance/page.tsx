"use client"

import { useState, useMemo } from "react"
import { Download, Filter, Shield, Lock, CheckCircle, Search, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/nayam/status-badge"
import { ChartCard } from "@/components/nayam/chart-card"
import { useApiData } from "@/hooks/use-api-data"
import { fetchComplianceExports } from "@/lib/services"
import type { AuditLog } from "@/lib/types"

export default function CompliancePage() {
  const [userFilter, setUserFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  // Fetch compliance exports as audit trail
  const { data: exportData, isLoading } = useApiData(
    () => fetchComplianceExports({ limit: 100 }),
    []
  )

  // Transform compliance exports into audit-like logs
  const auditLogs: AuditLog[] = useMemo(() => {
    if (!exportData?.exports) return []
    return (exportData.exports as Record<string, unknown>[]).map((e, i) => ({
      id: (e.id as string) || `AUD-${i + 1}`,
      action: (e.report_type as string) || "Data Export",
      user: (e.requested_by as string) || "System",
      timestamp: ((e.requested_at as string) || "").replace("T", " ").slice(0, 16),
      details: `${(e.export_format as string) || "json"} export — ${(e.status as string) || "completed"}${e.record_count ? ` (${e.record_count} records)` : ""}`,
      type: "access" as const,
    }))
  }, [exportData])

  const users = useMemo(() => [...new Set(auditLogs.map((l) => l.user))], [auditLogs])
  const types = useMemo(() => [...new Set(auditLogs.map((l) => l.type))], [auditLogs])

  const filtered = auditLogs.filter((l) => {
    const matchUser = !userFilter || l.user === userFilter
    const matchType = !typeFilter || l.type === typeFilter
    return matchUser && matchType
  })

  if (isLoading) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">
            Compliance & Audit
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable audit trails and compliance monitoring
          </p>
        </div>
        <button className="flex items-center gap-2 border-3 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[4px_4px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[6px_6px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5">
          <Download className="h-4 w-4" />
          Export Logs
        </button>
      </div>

      {/* Security Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-emerald-900 bg-emerald-100">
              <Shield className="h-5 w-5 text-emerald-900" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Compliance Score</p>
              <p className="text-xl font-black text-emerald-700">96.8%</p>
            </div>
          </div>
        </div>
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-primary">
              <Lock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Encryption</p>
              <p className="text-sm font-black text-foreground">AES-256 Active</p>
            </div>
          </div>
        </div>
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-emerald-900 bg-emerald-100">
              <CheckCircle className="h-5 w-5 text-emerald-900" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data Integrity</p>
              <p className="text-sm font-black text-emerald-700">Verified</p>
            </div>
          </div>
        </div>
        <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-muted">
              <Search className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Logs</p>
              <p className="text-xl font-black text-foreground">{auditLogs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
        >
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
        >
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="border-3 border-foreground bg-card shadow-[4px_4px_0px_0px] shadow-foreground/20">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground bg-muted/50">
              <TableHead className="text-xs font-black uppercase tracking-widest">Timestamp</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Action</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">User</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Type</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <TableRow key={log.id} className="border-b border-foreground/10">
                <TableCell className="text-xs font-mono text-muted-foreground">{log.timestamp}</TableCell>
                <TableCell className="text-sm font-bold text-foreground">{log.action}</TableCell>
                <TableCell className="text-sm text-foreground">{log.user}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      log.type === "access"
                        ? "border-blue-900 bg-blue-100 text-blue-900"
                        : log.type === "modification"
                        ? "border-amber-900 bg-amber-100 text-amber-900"
                        : log.type === "approval"
                        ? "border-emerald-900 bg-emerald-100 text-emerald-900"
                        : "border-foreground/50 bg-muted text-foreground"
                    }`}
                  >
                    {log.type}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
