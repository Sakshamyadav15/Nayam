"use client"

import { User, Shield, Bell, Database, Globe, Key } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export default function SettingsPage() {
  const { user } = useAuth()
  return (
    <main className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform configuration and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Profile Settings */}
        <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-widest text-card-foreground">
              Profile Settings
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Display Name
              </label>
              <input
                type="text"
                defaultValue={user?.name || ""}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Role
              </label>
              <input
                type="text"
                defaultValue={user?.role || "staff"}
                disabled
                className="mt-1 w-full border-2 border-foreground/30 bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                defaultValue={user?.email || ""}
                className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-widest text-card-foreground">
              Security
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-2 border-foreground/20 p-3">
              <div>
                <p className="text-sm font-bold text-foreground">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Secure your account with 2FA</p>
              </div>
              <div className="flex h-6 w-11 cursor-pointer items-center rounded-none border-2 border-emerald-900 bg-emerald-500 px-0.5">
                <div className="h-4 w-4 translate-x-5 bg-white border border-emerald-900 transition-transform" />
              </div>
            </div>
            <div className="flex items-center justify-between border-2 border-foreground/20 p-3">
              <div>
                <p className="text-sm font-bold text-foreground">Session Timeout</p>
                <p className="text-xs text-muted-foreground">Auto-lock after inactivity</p>
              </div>
              <select className="border-2 border-foreground bg-background px-3 py-1 text-xs font-bold text-foreground">
                <option>15 minutes</option>
                <option>30 minutes</option>
                <option>1 hour</option>
              </select>
            </div>
            <div className="flex items-center justify-between border-2 border-foreground/20 p-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-bold text-foreground">API Keys</p>
                  <p className="text-xs text-muted-foreground">2 active keys</p>
                </div>
              </div>
              <button className="border-2 border-foreground bg-background px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-muted transition-colors">
                Manage
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-widest text-card-foreground">
              Notifications
            </h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Critical Issue Alerts", desc: "Immediate notification for critical escalations", enabled: true },
              { label: "Approval Requests", desc: "Notify when new approvals are pending", enabled: true },
              { label: "AI Insights", desc: "Daily AI intelligence digest", enabled: true },
              { label: "System Alerts", desc: "Infrastructure and performance alerts", enabled: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-2 border-foreground/20 p-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <div
                  className={`flex h-6 w-11 cursor-pointer items-center border-2 px-0.5 ${
                    item.enabled
                      ? "border-emerald-900 bg-emerald-500"
                      : "border-foreground/30 bg-muted"
                  }`}
                >
                  <div
                    className={`h-4 w-4 border transition-transform ${
                      item.enabled
                        ? "translate-x-5 bg-white border-emerald-900"
                        : "translate-x-0 bg-white border-foreground/30"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System */}
        <div className="border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-widest text-card-foreground">
              System
            </h3>
          </div>
          <div className="space-y-3">
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Version</p>
              <p className="mt-1 text-sm font-mono font-bold text-foreground">NAYAM v2.4.1</p>
            </div>
            <div className="border-2 border-foreground/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Environment</p>
              <p className="mt-1 text-sm font-bold text-foreground">Production</p>
            </div>
            <div className="border-2 border-foreground/20 p-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Region</p>
                  <p className="mt-1 text-sm font-bold text-foreground">Asia Pacific (Mumbai)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="border-3 border-foreground bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[4px_4px_0px_0px] shadow-foreground/20 transition-all hover:shadow-[6px_6px_0px_0px] hover:-translate-x-0.5 hover:-translate-y-0.5">
          Save Changes
        </button>
      </div>
    </main>
  )
}
