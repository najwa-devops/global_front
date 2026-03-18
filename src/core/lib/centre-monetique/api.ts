import {
  CentreMonetiqueBatchDetail,
  CentreMonetiqueBatchSummary,
  CentreMonetiqueUploadResponse,
} from "./types"

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "") === "/api" ? "" : RAW_API_BASE_URL.replace(/\/$/, "")

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

export async function uploadCentreMonetique(
  file: File,
  year?: number,
  structure: "AUTO" | "CMI" | "BARID_BANK" = "AUTO"
): Promise<CentreMonetiqueUploadResponse> {
  const formData = new FormData()
  formData.append("file", file)
  if (year) formData.append("year", String(year))
  formData.append("structure", structure)

  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/upload`, {
    method: "POST",
    body: formData,
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getCentreMonetiqueBatches(limit = 50): Promise<CentreMonetiqueBatchSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique?limit=${limit}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.batches || []
}

export async function getCentreMonetiqueBatchById(id: number, includeRawOcr = false): Promise<CentreMonetiqueBatchDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}?includeRawOcr=${includeRawOcr}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function reprocessCentreMonetique(
  id: number,
  year?: number,
  structure: "AUTO" | "CMI" | "BARID_BANK" = "AUTO"
): Promise<CentreMonetiqueUploadResponse> {
  const queryParts: string[] = []
  if (year) queryParts.push(`year=${year}`)
  if (structure) queryParts.push(`structure=${encodeURIComponent(structure)}`)
  const query = queryParts.length ? `?${queryParts.join("&")}` : ""
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}/reprocess${query}`, {
    method: "POST",
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function deleteCentreMonetiqueBatch(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}`, {
    method: "DELETE",
  })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function saveCentreMonetiqueRows(
  id: number,
  rows: CentreMonetiqueBatchDetail["rows"]
): Promise<CentreMonetiqueUploadResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v2/centre-monetique/${id}/rows`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows || []),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export function getCentreMonetiqueFileUrl(id: number): string {
  return `${API_BASE_URL}/api/v2/centre-monetique/${id}/file`
}
