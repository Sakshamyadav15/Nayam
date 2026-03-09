"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Brain, Link2, Clock, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { useApiData } from "@/hooks/use-api-data"
import { fetchAllApprovals, reviewAction } from "@/lib/services"
import type { Approval } from "@/lib/types"

export default function ApprovalsPage() {
  const [confirmAction, setConfirmAction] = useState<{ approval: Approval; action: "approve" | "reject" } | null>(null)
  const { data: allApprovals, isLoading, refetch } = useApiData<Approval[]>(() => fetchAllApprovals(), [])

  const handleConfirm = async () => {
    if (!confirmAction) return
    try {
      await reviewAction(
        confirmAction.approval.id,
        confirmAction.action === "approve" ? "approved" : "rejected",
        `${confirmAction.action === "approve" ? "Approved" : "Rejected"} via dashboard`
      )
      setConfirmAction(null)
      refetch()
    } catch {
      setConfirmAction(null)
    }
  }

  const approvals = allApprovals || []
  const pending = approvals.filter((a) => a.status === "pending")
  const processed = approvals.filter((a) => a.status !== "pending")

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
          Approvals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Human-in-the-loop approval workflows
        </p>
      </div>

      {/* Pending Approvals */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
          Pending Actions ({pending.length})
        </h2>
        <div className="space-y-3">
          {pending.map((a) => (
            <div
              key={a.id}
              className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{a.id}</span>
                    <div className="flex items-center gap-1">
                      <Brain className="h-3 w-3 text-primary" />
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${
                          a.aiConfidence >= 90
                            ? "border-emerald-900 bg-emerald-100 text-emerald-900"
                            : a.aiConfidence >= 80
                            ? "border-blue-900 bg-blue-100 text-blue-900"
                            : "border-amber-900 bg-amber-100 text-amber-900"
                        }`}
                      >
                        {a.aiConfidence}% confidence
                      </span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{a.action}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{a.summary}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      <span className="font-mono font-bold">{a.linkedIssue}</span>
                    </div>
                    {a.linkedDocument && (
                      <div className="flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        <span className="font-mono font-bold">{a.linkedDocument}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono">{a.timestamp}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmAction({ approval: a, action: "approve" })}
                    className="flex items-center gap-1.5 border-2 border-emerald-900 bg-emerald-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-900 transition-colors hover:bg-emerald-900 hover:text-white"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => setConfirmAction({ approval: a, action: "reject" })}
                    className="flex items-center gap-1.5 border-2 border-red-900 bg-red-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-900 transition-colors hover:bg-red-900 hover:text-white"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="border-3 border-dashed border-foreground/30 bg-muted/50 p-8 text-center">
              <CheckCircle className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-2 text-sm font-bold text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground">No pending approvals</p>
            </div>
          )}
        </div>
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
            Processed ({processed.length})
          </h2>
          <div className="space-y-2">
            {processed.map((a) => (
              <div
                key={a.id}
                className={`flex items-center justify-between border-2 p-4 ${
                  a.status === "approved"
                    ? "border-emerald-900/30 bg-emerald-50"
                    : "border-red-900/30 bg-red-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {a.status === "approved" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-700" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-foreground">{a.action}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{a.id}</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    a.status === "approved" ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="border-3 border-foreground rounded-none shadow-[8px_8px_0px_0px] shadow-foreground/20">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              Confirm {confirmAction?.action === "approve" ? "Approval" : "Rejection"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This action will be logged in the audit trail.
            </DialogDescription>
          </DialogHeader>
          {confirmAction && (
            <div className="border-2 border-foreground p-4">
              <p className="text-sm font-bold text-foreground">{confirmAction.approval.action}</p>
              <p className="mt-1 text-xs text-muted-foreground">{confirmAction.approval.summary}</p>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setConfirmAction(null)}
              className="border-2 border-foreground bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors shadow-[3px_3px_0px_0px] shadow-foreground/20 ${
                confirmAction?.action === "approve"
                  ? "border-emerald-900 bg-emerald-700 text-white hover:bg-emerald-800"
                  : "border-red-900 bg-red-700 text-white hover:bg-red-800"
              }`}
            >
              Confirm {confirmAction?.action === "approve" ? "Approval" : "Rejection"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
