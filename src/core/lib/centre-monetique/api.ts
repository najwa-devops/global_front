import {
  CentreMonetiqueBatchDetail,
  CentreMonetiqueBatchSummary,
  CentreMonetiqueRapprochementResult,
  CmExpansion,
  CentreMonetiqueUploadResponse,
} from "./types"

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "") === "/api" ? "" : RAW_API_BASE_URL.replace(/\/$/, "")

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined
  const fromQuery = Number(
    new URLSearchParams(window.location.search).get("dossierId")
  )
  if (Number.isFinite(fromQuery) && fromQuery > 0) {
    window.localStorage.setItem("currentDossierId", String(fromQuery))
    return fromQuery
  }
  const raw = window.localStorage.getItem("currentDossierId")
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    localStorage.removeItem("auth_user")
    window.location.href = "/login"
  }
}

async function parseApiError(response: Response): Promise<string> {
  if (response.status === 401) {
    redirectToLogin()
    return "Session expirée. Redirection vers la page de connexion..."
  }
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

export async function uploadCentreMonetique(
  file: File,
  year?: number,
  structure: "AUTO" | "CMI" | "BARID_BANK" | "AMEX" | "VPS" = "AUTO",
  rib?: string,
  dossierId?: number // Paramètre optionnel pour forcer un dossier spécifique
): Promise<CentreMonetiqueUploadResponse> {
  const formData = new FormData()
  formData.append("file", file)
  if (year) formData.append("year", String(year))
  formData.append("structure", structure)
  if (rib && rib.trim()) formData.append("rib", rib.trim())
  
  // Priorité 1: dossierId passé en paramètre
  // Priorité 2: dossierId de la session/storage
  const effectiveDossierId = dossierId ?? getCurrentDossierId()
  if (effectiveDossierId) formData.append("dossierId", String(effectiveDossierId))

  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getCentreMonetiqueBatches(limit = 50): Promise<CentreMonetiqueBatchSummary[]> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams({ limit: String(limit) })
  if (dossierId) params.append("dossierId", String(dossierId))
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique?${params.toString()}`, { credentials: "include" })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.batches || []
}

export async function getCentreMonetiqueBatchById(id: number, includeRawOcr = false): Promise<CentreMonetiqueBatchDetail> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams({ includeRawOcr: String(includeRawOcr) })
  if (dossierId) params.append("dossierId", String(dossierId))
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}?${params.toString()}`, { credentials: "include" })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function reprocessCentreMonetique(
  id: number,
  year?: number,
  structure: "AUTO" | "CMI" | "BARID_BANK" | "AMEX" | "VPS" = "AUTO"
): Promise<CentreMonetiqueUploadResponse> {
  const params = new URLSearchParams()
  if (year) params.append("year", String(year))
  if (structure) params.append("structure", structure)
  const dossierId = getCurrentDossierId()
  if (dossierId) params.append("dossierId", String(dossierId))
  const query = params.toString() ? `?${params.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}/reprocess${query}`, {
    method: "POST",
    credentials: "include",
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function deleteCentreMonetiqueBatch(id: number): Promise<void> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams()
  if (dossierId) params.append("dossierId", String(dossierId))
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}?${params.toString()}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function clientValidateCentreMonetiqueBatch(id: number): Promise<CentreMonetiqueBatchDetail> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams()
  if (dossierId) params.append("dossierId", String(dossierId))
  const query = params.toString() ? `?${params.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}/client-validate${query}`, {
    method: "POST",
    credentials: "include",
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.batch || data
}

export async function saveCentreMonetiqueRows(
  id: number,
  rows: CentreMonetiqueBatchDetail["rows"]
): Promise<CentreMonetiqueUploadResponse> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams()
  if (dossierId) params.append("dossierId", String(dossierId))
  const query = params.toString() ? `?${params.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}/rows${query}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows || []),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export function getCentreMonetiqueFileUrl(id: number): string {
  return `${API_BASE_URL}/api/v2/centre-monetique/${id}/file`
}

export async function updateCentreMonetiqueBatchRib(id: number, rib: string): Promise<CentreMonetiqueBatchDetail> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams()
  if (dossierId) params.append("dossierId", String(dossierId))
  const query = params.toString() ? `?${params.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}/rib${query}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rib }),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getCentreMonetiqueRapprochement(
  batchId: number
): Promise<CentreMonetiqueRapprochementResult> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams()
  if (dossierId) params.append("dossierId", String(dossierId))
  const query = params.toString() ? `?${params.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${batchId}/rapprochement${query}`, { credentials: "include" })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getCmExpansionsForStatement(statementId: number): Promise<CmExpansion[]> {
  const dossierId = getCurrentDossierId()
  const params = new URLSearchParams()
  if (dossierId) params.append("dossierId", String(dossierId))
  const query = params.toString() ? `?${params.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/statement/${statementId}/expansions${query}`, { credentials: "include" })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return Array.isArray(data) ? data : []
}
