import { CmExpansion, RapprochementResult } from "./types"

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "") === "/api" ? "" : RAW_API_BASE_URL.replace(/\/$/, "")

type ApiEnvelope<T> = {
  success: boolean
  data: T
  error?: string
  code?: string
  details?: unknown
  timestamp?: string
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  const response = await fetch(input, { ...init, headers })

  if (!response.ok) return response

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return response

  try {
    const body = await response.clone().json() as ApiEnvelope<unknown> | unknown
    if (body && typeof body === "object" && "success" in (body as Record<string, unknown>) && "data" in (body as Record<string, unknown>)) {
      const envelope = body as ApiEnvelope<unknown>
      if (envelope.success) {
        return new Response(JSON.stringify(envelope.data), {
          status: response.status,
          statusText: response.statusText,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify(envelope), {
        status: response.status >= 400 ? response.status : 400,
        statusText: "Business Error",
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch {
    return response
  }

  return response
}

async function parseApiError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type")
  const fallback = `HTTP ${response.status} ${response.statusText || ""}`.trim()
  try {
    if (contentType && contentType.includes("application/json")) {
      const errorData = await response.json() as any
      const code = errorData.code || errorData.errorCode
      const message = errorData.error || errorData.message || fallback
      return code ? `${message} (${code})` : message
    }
    const text = await response.text()
    return text || fallback
  } catch {
    return fallback
  }
}

export async function getRapprochement(id: number): Promise<RapprochementResult> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}/rapprochement`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getCmExpansionsForStatement(statementId: number): Promise<CmExpansion[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/centre-monetique/statement/${statementId}/expansions`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}
