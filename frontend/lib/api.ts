/**
 * NAYAM — API Client
 *
 * Centralized fetch wrapper with:
 *  • Automatic JWT token injection
 *  • Base URL resolution via Next.js rewrites
 *  • Typed JSON response parsing
 *  • Error handling with status codes
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1"

/** Retrieve the stored JWT token */
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("nayam_token")
}

/** Store the JWT token */
export function setToken(token: string): void {
  localStorage.setItem("nayam_token", token)
}

/** Clear the stored JWT token */
export function clearToken(): void {
  localStorage.removeItem("nayam_token")
  localStorage.removeItem("nayam_user")
}

/** API error with status code */
export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  params?: Record<string, string | number | boolean | undefined | null>
}

/** Core fetch wrapper */
async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, params, headers: extraHeaders, ...rest } = options

  // Build query string
  let url = `${API_BASE}${endpoint}`
  if (params) {
    const search = new URLSearchParams()
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== "") {
        search.set(key, String(val))
      }
    }
    const qs = search.toString()
    if (qs) url += `?${qs}`
  }

  // Headers
  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  }

  const token = getToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    body:
      body instanceof FormData
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
  })

  return handleResponse<T>(res)
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = await res.json()
      if (Array.isArray(err.detail)) {
        // FastAPI validation errors return an array of objects
        detail = err.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join("; ")
      } else {
        detail = err.detail || err.message || detail
      }
    } catch { }
    throw new ApiError(res.status, detail)
  }

  // Handle empty responses (204 No Content)
  if (res.status === 204) return {} as T

  return res.json() as Promise<T>
}

// ── Convenience Methods ─────────────────────────────────────────────

export const api = {
  get: <T>(endpoint: string, params?: FetchOptions["params"]) =>
    apiFetch<T>(endpoint, { method: "GET", params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: "PATCH", body }),

  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: "DELETE" }),

  upload: <T>(endpoint: string, formData: FormData) =>
    apiFetch<T>(endpoint, { method: "POST", body: formData }),
}
