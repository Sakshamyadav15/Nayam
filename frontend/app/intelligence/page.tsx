"use client"

import { useState, useRef, useCallback } from "react"
import { Send, Brain, User, Sparkles, CheckCircle, XCircle, Loader2, Mic, MicOff, AudioLines } from "lucide-react"
import { useApiData } from "@/hooks/use-api-data"
import { sendAgentQuery, fetchAgents, fetchPendingApprovals, reviewAction, transcribeAudio } from "@/lib/services"
import type { AgentInfo, Approval } from "@/lib/types"

interface Message {
  id: number
  role: "user" | "ai"
  content: string
  confidence?: number
  actions?: string[]
}

export default function IntelligencePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "ai",
      content: "Welcome to the NAYAM Intelligence Co-Pilot. Ask me anything about governance data, risk analysis, or ward intelligence.",
      confidence: 100,
    },
  ])
  const [input, setInput] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [isSending, setIsSending] = useState(false)

  // ── Voice Recording State ──────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        if (audioBlob.size < 100) return

        setIsTranscribing(true)
        try {
          const result = await transcribeAudio(audioBlob, "voice_query.webm")
          if (result.transcript) {
            setInput(result.transcript)
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              role: "ai" as const,
              content: "Voice transcription failed. Please check your microphone or try typing.",
              confidence: 0,
            },
          ])
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      alert("Microphone access denied. Please allow microphone permissions.")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  const { data: agentList } = useApiData<AgentInfo[]>(() => fetchAgents(), [])
  const { data: pendingApprovals, refetch: refetchApprovals } = useApiData<Approval[]>(() => fetchPendingApprovals(), [])

  // Map backend agents to UI tabs with short names.
  const agentShortName = (name: string) => name.replace(/Agent$/i, "")
  const agents = agentList && agentList.length > 0
    ? agentList.map((a) => ({ id: a.name, label: agentShortName(a.name) }))
    : [
        { id: "CitizenAgent", label: "Citizen" },
        { id: "PolicyAgent", label: "Policy" },
        { id: "OperationsAgent", label: "Operations" },
      ]

  // Default to first agent once list is loaded
  const activeAgent = selectedAgent || agents[0]?.id || null

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const userMsg: Message = {
      id: messages.length + 1,
      role: "user",
      content: input,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsSending(true)

    try {
      const response = await sendAgentQuery(input, sessionId, activeAgent || undefined)
      setSessionId(response.session_id)
      const aiMsg: Message = {
        id: messages.length + 2,
        role: "ai",
        content: response.response,
        confidence: Math.round(response.confidence * 100),
        actions: response.suggested_actions?.map((a) => {
          if (typeof a === "string") return a
          return (a as Record<string, string>).description || (a as Record<string, string>).action || "Action"
        }),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      const errorMsg: Message = {
        id: messages.length + 2,
        role: "ai",
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        confidence: 0,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsSending(false)
    }
  }

  const handleApprovalAction = async (approvalId: string, action: "approved" | "rejected") => {
    try {
      await reviewAction(approvalId, action)
      refetchApprovals()
    } catch { /* ignore */ }
  }

  return (
    <main className="flex h-[calc(100vh-3.5rem)] flex-col p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">
          Intelligence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI Co-Pilot conversational advisory interface
        </p>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Chat Area */}
        <div className="flex flex-1 flex-col border-3 border-foreground bg-card shadow-[4px_4px_0px_0px] shadow-foreground/20">
          {/* Agent Selector */}
          <div className="flex items-center gap-2 border-b-2 border-foreground px-4 py-3 overflow-x-auto">
            <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
              Agent:
            </span>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={`shrink-0 border-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeAgent === agent.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/30 bg-background text-foreground hover:border-foreground"
                }`}
              >
                {agent.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "ai" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-foreground bg-primary">
                    <Brain className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-2xl ${
                    msg.role === "user"
                      ? "border-2 border-foreground bg-muted p-3"
                      : "border-2 border-foreground bg-card p-3"
                  }`}
                >
                  {msg.role === "ai" && msg.confidence && (
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        AI Response
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {msg.confidence}% confidence
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
                  {msg.actions && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.actions.map((action) => (
                        <button
                          key={action}
                          className="flex items-center gap-1.5 border-2 border-primary/50 bg-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-foreground bg-muted">
                    <User className="h-4 w-4 text-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t-2 border-foreground p-4">
            {isTranscribing && (
              <div className="mb-2 flex items-center gap-2 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="font-bold uppercase tracking-widest">Transcribing audio...</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center border-2 border-foreground bg-background px-3 py-2">
                <input
                  type="text"
                  placeholder={isRecording ? "🔴 Recording... click mic to stop" : "Ask the AI advisor..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              {/* Mic Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isSending}
                className={`flex h-10 w-10 items-center justify-center border-2 transition-colors ${
                  isRecording
                    ? "border-red-600 bg-red-600 text-white animate-pulse"
                    : "border-foreground bg-muted text-foreground hover:bg-foreground hover:text-background"
                } disabled:opacity-50`}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={isSending || isRecording}
                className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel - Insights */}
        <div className="hidden w-80 flex-col gap-4 lg:flex">
          <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
            <h3 className="text-xs font-black uppercase tracking-widest text-card-foreground mb-3">
              Active Insights
            </h3>
            <div className="space-y-3">
              {messages
                .filter((m) => m.role === "ai" && m.confidence && m.confidence > 50)
                .slice(-3)
                .map((m) => (
                  <div key={m.id} className="border-2 border-foreground/20 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {m.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{m.content.slice(0, 120)}…</p>
                  </div>
                ))}
            </div>
          </div>

          <div className="border-3 border-foreground bg-card p-4 shadow-[4px_4px_0px_0px] shadow-foreground/20">
            <h3 className="text-xs font-black uppercase tracking-widest text-card-foreground mb-3">
              Pending Actions
            </h3>
            <div className="space-y-2">
              {(pendingApprovals || []).length === 0 && (
                <p className="text-xs text-muted-foreground">No pending actions</p>
              )}
              {(pendingApprovals || []).slice(0, 3).map((approval) => (
                <div key={approval.id} className="flex items-center justify-between border-2 border-foreground/20 p-2">
                  <span className="text-xs font-semibold text-foreground line-clamp-1">{approval.action}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleApprovalAction(approval.id, "approved")}
                      className="flex h-6 w-6 items-center justify-center border border-emerald-700 bg-emerald-100 text-emerald-700 hover:bg-emerald-700 hover:text-white transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleApprovalAction(approval.id, "rejected")}
                      className="flex h-6 w-6 items-center justify-center border border-red-700 bg-red-100 text-red-700 hover:bg-red-700 hover:text-white transition-colors"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
