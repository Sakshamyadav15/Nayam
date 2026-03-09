/**
 * NAYAM — AuthGuard Component
 *
 * Client-side route protection. Wraps authenticated pages
 * and redirects to /login if no token is found.
 */

"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/login") {
      router.replace("/login")
    }
  }, [isLoading, isAuthenticated, pathname, router])

  // While restoring session from localStorage, show a loading spinner.
  // Both server and client render this (isLoading starts true), so no
  // hydration mismatch.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground font-bold text-lg animate-pulse">
            N
          </div>
          <p className="text-sm text-muted-foreground font-mono">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && pathname !== "/login") {
    return null
  }

  return <>{children}</>
}
