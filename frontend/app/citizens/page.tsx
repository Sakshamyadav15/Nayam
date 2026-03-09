"use client"

import { useState, useMemo } from "react"
import { Search, Plus, Filter, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/nayam/status-badge"
import { useApiData } from "@/hooks/use-api-data"
import { fetchCitizens, createCitizen } from "@/lib/services"
import type { Citizen } from "@/lib/types"

export default function CitizensPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [wardFilter, setWardFilter] = useState("")
  const [riskFilter, setRiskFilter] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCitizen, setSelectedCitizen] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newContact, setNewContact] = useState("")
  const [newWard, setNewWard] = useState("")
  const [addError, setAddError] = useState("")

  const { data, isLoading, refetch } = useApiData(() => fetchCitizens({ limit: 200 }), [])
  const allCitizens: Citizen[] = data?.citizens || []

  const wards = useMemo(() => [...new Set(allCitizens.map((c) => c.ward))], [allCitizens])

  const filtered = allCitizens.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchWard = !wardFilter || c.ward === wardFilter
    const matchRisk = !riskFilter || c.riskLevel === riskFilter
    return matchSearch && matchWard && matchRisk
  })

  const citizen = selectedCitizen
    ? allCitizens.find((c) => c.id === selectedCitizen)
    : null

  const handleAddCitizen = async () => {
    if (!newName.trim() || !newContact.trim() || !newWard.trim()) {
      setAddError("All fields are required")
      return
    }
    try {
      setAddError("")
      await createCitizen({ name: newName, contact_number: newContact, ward: newWard })
      setShowAddModal(false)
      setNewName("")
      setNewContact("")
      setNewWard("")
      refetch()
    } catch {
      setAddError("Failed to add citizen")
    }
  }

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
            Citizens
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Citizen records and profile management
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 border-3 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[4px_4px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[6px_6px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          Add Citizen
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center border-2 border-foreground bg-card px-3 py-2 flex-1 max-w-sm">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Wards</option>
            {wards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="border-2 border-foreground bg-card px-3 py-2 text-xs font-bold uppercase text-foreground"
          >
            <option value="">All Risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border-3 border-foreground bg-card shadow-[4px_4px_0px_0px] shadow-foreground/20">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground bg-muted/50">
              <TableHead className="text-xs font-black uppercase tracking-widest">Name</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Contact</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Ward</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Active Issues</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Risk Level</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="border-b border-foreground/10">
                <TableCell>
                  <div>
                    <p className="text-sm font-bold text-foreground">{c.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{c.id}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono text-foreground">{c.contact}</TableCell>
                <TableCell>
                  <span className="text-sm font-semibold text-foreground">{c.ward}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-black text-foreground">{c.activeIssues}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.riskLevel} variant="risk" />
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => setSelectedCitizen(c.id)}
                    className="border-2 border-foreground bg-background px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-foreground hover:text-background"
                  >
                    View
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t-2 border-foreground px-4 py-3">
          <p className="text-xs font-bold text-muted-foreground">
            Showing {filtered.length} of {allCitizens.length} records
          </p>
          <div className="flex items-center gap-2">
            <button className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-background text-foreground transition-colors hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-foreground text-xs font-bold text-background">
              1
            </span>
            <button className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-background text-foreground transition-colors hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Citizen Profile Panel */}
      <Dialog open={!!selectedCitizen} onOpenChange={() => setSelectedCitizen(null)}>
        <DialogContent className="border-3 border-foreground rounded-none shadow-[8px_8px_0px_0px] shadow-foreground/20 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              Citizen Profile
            </DialogTitle>
          </DialogHeader>
          {citizen && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{citizen.name}</p>
                </div>
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ID</p>
                  <p className="mt-1 text-sm font-mono font-bold text-foreground">{citizen.id}</p>
                </div>
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</p>
                  <p className="mt-1 text-sm font-mono text-foreground">{citizen.contact}</p>
                </div>
                <div className="border-2 border-foreground p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ward</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{citizen.ward}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="border-2 border-foreground p-3 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Issues</p>
                  <p className="mt-1 text-2xl font-black text-foreground">{citizen.activeIssues}</p>
                </div>
                <div className="border-2 border-foreground p-3 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Risk Level</p>
                  <div className="mt-1">
                    <StatusBadge status={citizen.riskLevel} variant="risk" />
                  </div>
                </div>
              </div>
              <div className="border-2 border-foreground p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audit Trail</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">2026-02-25 14:30</span>
                    <span className="font-semibold text-foreground">Record accessed by Admin</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">2026-02-20 09:15</span>
                    <span className="font-semibold text-foreground">Contact information updated</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">2026-02-15 11:00</span>
                    <span className="font-semibold text-foreground">New issue linked: ISS-001</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Citizen Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="border-3 border-foreground rounded-none shadow-[8px_8px_0px_0px] shadow-foreground/20">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider">
              Add New Citizen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addError && (
              <p className="text-xs font-bold text-red-600 border-2 border-red-300 bg-red-50 p-2">{addError}</p>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Full Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Contact Number
              </label>
              <input
                type="text"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Ward
              </label>
              <input
                type="text"
                value={newWard}
                onChange={(e) => setNewWard(e.target.value)}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Ward 1"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowAddModal(false)}
              className="border-2 border-foreground bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCitizen}
              className="border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[5px_5px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              Add Citizen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
