/**
 * NAYAM — useApiData Hook
 *
 * Generic data-fetching hook with loading, error, and refetch support.
 * Replaces static mock-data imports with real API calls.
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { ApiError, getToken } from "@/lib/api"

interface UseApiDataResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // Don't fetch if there's no token yet (user not logged in)
    if (!getToken()) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // Token expired or invalid — set error, let AuthGuard handle redirect
          setError("Session expired. Please log in again.")
          return
        }
        setError(err.detail)
      } else {
        setError("An unexpected error occurred")
      }
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
