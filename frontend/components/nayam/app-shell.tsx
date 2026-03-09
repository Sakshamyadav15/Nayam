/**
 * NAYAM — App Shell
 *
 * Wraps the app with AuthProvider and conditionally renders
 * the sidebar/topbar for authenticated routes, or a bare layout for /login.
 * Shows a hero video splash on first visit.
 */

"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { AuthProvider } from "@/lib/auth-context"
import { AuthGuard } from "@/components/nayam/auth-guard"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/nayam/app-sidebar"
import { Topbar } from "@/components/nayam/topbar"

function HeroSplash({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      <video
        autoPlay
        muted
        playsInline
        onEnded={onFinish}
        className="h-full w-full object-cover"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <button
        onClick={onFinish}
        className="absolute bottom-8 right-8 rounded border border-white/30 bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
      >
        Skip
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const [showSplash, setShowSplash] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("nayam_splash_shown")) {
      setShowSplash(true)
    }
  }, [])

  const handleSplashFinish = () => {
    setShowSplash(false)
    sessionStorage.setItem("nayam_splash_shown", "1")
  }

  return (
    <AuthProvider>
      {showSplash && <HeroSplash onFinish={handleSplashFinish} />}
      {isLoginPage ? (
        // Bare layout for login — no sidebar, no topbar, no auth guard
        <>{children}</>
      ) : (
        // Protected layout with sidebar and topbar
        <AuthGuard>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <Topbar />
              <div className="flex-1 overflow-auto">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </AuthGuard>
      )}
    </AuthProvider>
  )
}
