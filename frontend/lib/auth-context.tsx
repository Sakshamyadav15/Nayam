/**
 * NAYAM — Auth Context Provider
 *
 * Provides authentication state across the entire app.
 * Stores JWT token and user info in localStorage.
 */

"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { getToken, setToken as storeToken, clearToken } from "@/lib/api"
import { login as apiLogin, register as apiRegister } from "@/lib/services"
import type { User } from "@/lib/types"

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => { },
  register: async () => { },
  logout: () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from localStorage after hydration (SSR-safe).
  // Both server and client start with isLoading=true → loading spinner,
  // so there is no hydration mismatch.
  useEffect(() => {
    const storedToken = getToken()
    const storedUser = localStorage.getItem("nayam_user")
    if (storedToken && storedUser) {
      try {
        setTokenState(storedToken)
        setUser(JSON.parse(storedUser))
      } catch {
        clearToken()
        localStorage.removeItem("nayam_user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password)
    storeToken(result.access_token)
    localStorage.setItem("nayam_user", JSON.stringify(result.user))
    setTokenState(result.access_token)
    setUser(result.user)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, role?: string) => {
    const result = await apiRegister(name, email, password, role)
    storeToken(result.access_token)
    localStorage.setItem("nayam_user", JSON.stringify(result.user))
    setTokenState(result.access_token)
    setUser(result.user)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
    window.location.href = "/login"
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
