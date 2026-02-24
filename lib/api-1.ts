import {
  DynamicInvoiceDto,
  DynamicTemplateDto,
  DynamicExtractionResponse,
  CreateDynamicTemplateRequest,
  UpdateDynamicTemplateRequest,
  Account,
  CreateAccountRequest,
  UpdateAccountRequest,
  Tier,
  CreateTierRequest,
  UpdateTierRequest,
  LocalBankStatement,
  BankStatementV2,
  BankTransactionV2,
  BankStatementStats,
  BankOption
} from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8089"

type ApiEnvelope<T> = {
  success: boolean
  data: T
  error?: string
  code?: string
  details?: unknown
  timestamp?: string
}

export type DynamicInvoiceBulkItemResult = {
  invoiceId: number
  success: boolean
  status?: "VERIFY" | "READY_TO_TREAT" | "READY_TO_VALIDATE" | "VALIDATED" | "REJECTED"
  code?: string
  error?: string
  details?: unknown
}

export type DynamicInvoiceBulkResponse = {
  total: number
  successCount: number
  failedCount: number
  results: DynamicInvoiceBulkItemResult[]
}

export type AccountingConfigDto = {
  id: number
  journal: string
  designation: string
  banque: string
  compteComptable: string
  rib: string
}

export type UpsertAccountingConfigRequest = Omit<AccountingConfigDto, "id">

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token")
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

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

// ============================================
// HELPERS
// ============================================

export function normalizeStatus(status: any): string {
  if (!status) return "pending"
  const s = String(status).toUpperCase()
  if (s === "VERIFY" || s === "TO_VERIFY") return "to_verify"
  if (s === "READY_TO_TREAT" || s === "PENDING") return "pending"
  if (s === "PROCESSING") return "processing"
  if (s === "TREATED" || s === "PROCESSED") return "treated"
  if (s === "READY_TO_VALIDATE") return "ready_to_validate"
  if (s === "VALIDATED") return "validated"
  if (s === "REJECTED" || s === "ERROR") return "error"
  return "pending"
}

export async function parseApiError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type")
  try {
    if (contentType && contentType.includes("application/json")) {
      const errorData = await response.json() as any
      const code = errorData.code || errorData.errorCode
      const message = errorData.error || errorData.message || response.statusText
      return code ? `${message} (${code})` : message
    } else {
      const text = await response.text()
      if (text.includes("<html>")) {
        const match = text.match(/<title>(.*?)<\/title>/i)
        return match ? `Server Error: ${match[1]}` : `Server Error (HTML response)`
      }
      return text || response.statusText
    }
  } catch {
    return response.statusText
  }
}

export function getFileUrl(filePath: string): string {
  if (!filePath) return ""
  const filename = filePath.split(/[/\\]/).pop() || "file"
  return `${API_BASE_URL}/api/dynamic-invoices/files/${encodeURIComponent(filename)}`
}

export function getDynamicInvoicePdfUrl(filePath: string): string {
  return getFileUrl(filePath)
}

// ============================================
// DYNAMIC INVOICES API
// ============================================

export async function uploadDynamicInvoice(file: File, dossierId?: number): Promise<DynamicInvoiceDto> {
  const formData = new FormData()
  formData.append("file", file)
  if (dossierId !== undefined && dossierId !== null) {
    formData.append("dossierId", String(dossierId))
  }

  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/upload`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function processDynamicInvoice(id: number): Promise<DynamicInvoiceDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${id}/process`, {
    method: "POST",
    headers: { "Accept": "application/json" }
  })

  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getDynamicInvoiceById(id: number): Promise<DynamicInvoiceDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${id}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function validateDynamicInvoice(id: number): Promise<DynamicInvoiceDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${id}/validate`, { method: "POST" })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function updateDynamicInvoiceFields(id: number, fields: Record<string, any>): Promise<DynamicInvoiceDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${id}/fields`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })

  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getAllDynamicInvoices(status?: string, templateId?: number, limit: number = 50): Promise<DynamicInvoiceDto[]> {
  const params = new URLSearchParams()
  if (status) params.append("status", status)
  if (templateId) params.append("templateId", String(templateId))
  params.append("limit", String(limit))

  const url = `${API_BASE_URL}/api/dynamic-invoices?${params.toString()}`
  const response = await apiFetch(url)
  if (!response.ok) {
    const errorMsg = await parseApiError(response)
    console.error(`[API] getAllDynamicInvoices failed (${response.status}):`, errorMsg)
    throw new Error(errorMsg)
  }
  const data = await response.json()
  return data.invoices || []
}

export async function deleteDynamicInvoice(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function updateInvoiceStatus(id: number | string, status: string): Promise<any> {
  let backendStatus = status
  const normalized = String(status).toLowerCase()
  if (normalized === "pending" || normalized === "to_verify" || normalized === "verify") {
    backendStatus = "READY_TO_TREAT"
  }

  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: backendStatus })
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getDynamicInvoiceStats(): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/stats`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function processDynamicInvoicesBulk(invoiceIds: number[]): Promise<DynamicInvoiceBulkResponse> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/process-bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceIds }),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function reprocessDynamicInvoicesBulk(invoiceIds: number[]): Promise<DynamicInvoiceBulkResponse> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/reprocess-bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceIds }),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getDynamicAvailableSignatures(id: number): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${id}/available-signatures`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function linkTierToDynamicInvoice(invoiceId: number, tierId: number): Promise<{ success: boolean; message: string; invoice: DynamicInvoiceDto }> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-invoices/${invoiceId}/link-tier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tierId }),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return {
    success: true,
    message: "Tier linked",
    invoice: data,
  }
}

// ============================================
// DYNAMIC TEMPLATES API
// ============================================

export async function getAllTemplates(): Promise<DynamicTemplateDto[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getTemplateById(id: number): Promise<DynamicTemplateDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/${id}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function createDynamicTemplate(request: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function updateTemplate(id: number, request: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function patchTemplate(id: number, request: UpdateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function deactivateTemplate(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function searchTemplates(name: string): Promise<DynamicTemplateDto[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/search?name=${encodeURIComponent(name)}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getTemplatesBySupplierType(supplierType: string): Promise<DynamicTemplateDto[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/by-supplier-type/${encodeURIComponent(supplierType)}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getReliableTemplates(): Promise<DynamicTemplateDto[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/reliable`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getTemplatesBySupplier(supplier: string): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/by-supplier?supplier=${encodeURIComponent(supplier)}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

// ============================================
// EXTRACTION API
// ============================================

export async function extractWithTemplate(invoiceId: number, templateId?: number): Promise<DynamicExtractionResponse> {
  const url = templateId
    ? `${API_BASE_URL}/api/dynamic-templates/extract/${invoiceId}?templateId=${templateId}`
    : `${API_BASE_URL}/api/dynamic-templates/extract/${invoiceId}`

  const response = await apiFetch(url, { method: "POST" })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()

  // Format response for consistency
  return {
    success: data.success,
    message: data.message,
    invoiceId: data.invoiceId,
    templateId: data.templateId,
    templateName: data.templateName || "DEFAULT",
    rawOcrText: data.rawOcrText || data.extractedText || "",
    extractedText: data.extractedText || "",
    extractedFields: data.extractedFields || {},
    missingFields: data.missingFields || [],
    lowConfidenceFields: data.lowConfidenceFields || [],
    overallConfidence: data.overallConfidence || 0,
    extractedCount: data.extractedCount || 0,
    totalFields: data.totalFields || 0,
    isComplete: data.isComplete || false,
    status: data.status,
    extractionMethod: data.templateId ? "DYNAMIC_TEMPLATE" : "PATTERNS"
  }
}

export async function extractFromFile(file: File, templateId?: number): Promise<any> {
  const formData = new FormData()
  formData.append("file", file)
  const url = templateId
    ? `${API_BASE_URL}/api/dynamic-templates/extract-file?templateId=${templateId}`
    : `${API_BASE_URL}/api/dynamic-templates/extract-file`

  const response = await apiFetch(url, { method: "POST", body: formData })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function testTemplate(templateId: number, ocrText: string): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/${templateId}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ocrText }),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function detectTemplate(ocrText: string): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/dynamic-templates/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ocrText }),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

// ============================================
// ACCOUNTING: ACCOUNTS
// ============================================

export async function getAccounts(activeOnly: boolean = true): Promise<Account[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts?activeOnly=${activeOnly}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.accounts || []
}

export async function getAccountById(id: number): Promise<Account> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/${id}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.account
}

export async function getAccountByCode(code: string): Promise<Account | null> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/by-code/${code}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.account
}

export async function searchAccounts(query: string): Promise<Account[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/search?query=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.accounts || []
}

export async function getAccountsByClasse(classe: number): Promise<Account[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/by-classe/${classe}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.accounts || []
}

export async function getChargeAccounts(): Promise<Account[]> {
  const accounts = await getAccounts(true)
  return accounts.filter(a => a.isChargeAccount || a.classe === 6 || a.code.startsWith("6"))
}

export async function getTvaAccounts(): Promise<Account[]> {
  const accounts = await getAccounts(true)
  return accounts.filter(a => a.isTvaAccount || a.classe === 3 || a.classe === 4 || a.code.startsWith("3455") || a.code.startsWith("4455"))
}

export async function getFournisseurAccounts(): Promise<Account[]> {
  const accounts = await getAccounts(true)
  return accounts.filter(a => a.isFournisseurAccount || a.code.startsWith("4411"))
}

export async function createAccount(request: CreateAccountRequest): Promise<Account> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.account
}

export async function updateAccount(id: number, request: UpdateAccountRequest): Promise<Account> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.account
}

export async function deactivateAccount(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function activateAccount(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/${id}/activate`, { method: "PATCH" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function importAccounts(requests: CreateAccountRequest[]): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/accounts/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

// ============================================
// ACCOUNTING: TIERS
// ============================================

export async function getAllTiers(activeOnly: boolean = true): Promise<Tier[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers?activeOnly=${activeOnly}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.tiers || []
}

export async function getTierById(id: number): Promise<Tier> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/${id}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.tier
}

export async function getTierByTierNumber(tierNumber: string): Promise<Tier | null> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/by-tier-number/${tierNumber}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.tier
}

export async function getTierByIce(ice: string): Promise<Tier | null> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/search?query=${encodeURIComponent(ice)}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  const tiers: Tier[] = data.tiers || []
  const normalized = String(ice || "").replace(/\s+/g, "")
  const exact = tiers.find((t) => String(t.ice || "").replace(/\s+/g, "") === normalized)
  return exact || null
}

export async function getTierByIfNumber(ifNumber: string): Promise<Tier | null> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/search?query=${encodeURIComponent(ifNumber)}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  const tiers: Tier[] = data.tiers || []
  const normalized = String(ifNumber || "").replace(/\s+/g, "")
  const exact = tiers.find((t) => String(t.ifNumber || "").replace(/\s+/g, "") === normalized)
  return exact || null
}

export async function searchTiers(query: string): Promise<Tier[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/search?query=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.tiers || []
}

export async function createTier(request: CreateTierRequest): Promise<Tier> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.tier
}

export async function updateTier(id: number, request: UpdateTierRequest): Promise<Tier> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.tier
}

export async function deactivateTier(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function activateTier(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/accounting/tiers/${id}/activate`, { method: "PATCH" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

// ============================================
// ACCOUNTING CONFIGS API
// ============================================

export async function getAccountingConfigs(): Promise<AccountingConfigDto[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/accounting-configs`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.configs || data || []
}

export async function createAccountingConfig(request: UpsertAccountingConfigRequest): Promise<AccountingConfigDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/accounting-configs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function updateAccountingConfig(id: number, request: UpsertAccountingConfigRequest): Promise<AccountingConfigDto> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/accounting-configs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function deleteAccountingConfig(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/accounting-configs/${id}`, {
    method: "DELETE",
  })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function getAccountingConfigBanks(): Promise<string[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/accounting-configs/banks`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.banks || []
}

// ============================================
// BANK STATEMENTS API
// ============================================

export async function uploadBankStatement(file: File, bankType?: string, allowedBanks?: string[]): Promise<BankStatementV2> {
  const formData = new FormData()
  formData.append("file", file)
  if (bankType && bankType !== "AUTO") {
    formData.append("bankType", bankType)
  }
  if (allowedBanks && allowedBanks.length > 0) {
    allowedBanks.forEach((bank) => formData.append("allowedBanks", bank))
  }

  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/upload`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function processBankStatement(id: number, allowedBanks?: string[]): Promise<BankStatementV2> {
  const query = new URLSearchParams()
  if (allowedBanks && allowedBanks.length > 0) {
    query.append("allowedBanks", allowedBanks.join(","))
  }
  const url = query.toString()
    ? `${API_BASE_URL}/api/v2/bank-statements/${id}/process?${query.toString()}`
    : `${API_BASE_URL}/api/v2/bank-statements/${id}/process`

  const response = await apiFetch(url, { method: "POST" })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getAllBankStatements(
  queryParams?: string | { status?: string; rib?: string; month?: number; year?: number; limit?: number }
): Promise<BankStatementV2[]> {
  const qs = new URLSearchParams()
  if (typeof queryParams === "string") {
    qs.append("status", queryParams)
  } else if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) qs.append(key, String(value))
    })
  }
  if (!qs.has("limit")) qs.append("limit", "1000")
  qs.append("_t", String(Date.now()))

  const url = `${API_BASE_URL}/api/v2/bank-statements?${qs.toString()}`
  const response = await apiFetch(url, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.statements || data || []
}

export async function getBankStatementById(id: number): Promise<BankStatementV2> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/${id}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function validateBankStatement(id: number, fields?: any): Promise<BankStatementV2> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/${id}/validate`, {
    method: "POST",
    headers: fields ? { "Content-Type": "application/json" } : undefined,
    body: fields ? JSON.stringify(fields) : undefined,
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function updateBankStatementStatus(
  id: number,
  status: string,
  updatedBy?: string
): Promise<BankStatementV2> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, updatedBy }),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.statement || data
}

export async function deleteBankStatement(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function deleteAllBankStatements(): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/all`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

export async function getBankStatementStats(): Promise<BankStatementStats> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/stats?_t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function retryFailedBankStatementPages(id: number): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/${id}/retry-failed`, { method: "POST" })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getBankOptions(): Promise<{ count: number; options: BankOption[] }> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-statements/bank-options`)
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function getTransactionsByStatementId(statementId: number): Promise<BankTransactionV2[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-transactions/statement/${statementId}`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.transactions || data || []
}

export async function updateBankTransaction(id: number, updates: Partial<BankTransactionV2>): Promise<BankTransactionV2> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function createBankTransaction(
  payload: {
    statementId: number
    transactionIndex?: number
    dateOperation: string
    dateValeur?: string
    libelle: string
    compte?: string
    categorie?: string
    sens?: "DEBIT" | "CREDIT"
    debit?: number
    credit?: number
    isLinked?: boolean
  }
): Promise<BankTransactionV2> {
  const response = await apiFetch(`${API_BASE_URL}/api/v2/bank-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

// ============================================
// DOSSIERS API
// ============================================

export type BackendDossierDto = {
  id: number
  name: string
  status?: string
  comptableId?: number
  comptableEmail?: string
  fournisseurId?: number
  fournisseurEmail?: string
  createdAt?: string
  invoicesCount?: number
  bankStatementsCount?: number
  pendingInvoicesCount?: number
  validatedInvoicesCount?: number
}

export async function getDossiers(): Promise<BackendDossierDto[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/dossiers`)
  if (!response.ok) throw new Error(await parseApiError(response))
  const data = await response.json()
  return data.dossiers || []
}

export async function createDossier(payload: { nom: string; fournisseurEmail: string; fournisseurPassword: string }): Promise<any> {
  const response = await apiFetch(`${API_BASE_URL}/api/dossiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseApiError(response))
  return response.json()
}

export async function deleteDossier(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/dossiers/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseApiError(response))
}

// ============================================
// UNIFIED API OBJECT
// ============================================

export const api = {
  // Dynamic Invoices
  uploadDynamicInvoice,
  processDynamicInvoice,
  getDynamicInvoiceById,
  validateDynamicInvoice,
  updateDynamicInvoiceFields,
  getAllDynamicInvoices,
  deleteDynamicInvoice,
  getDynamicInvoiceStats,
  processDynamicInvoicesBulk,
  reprocessDynamicInvoicesBulk,
  getDynamicAvailableSignatures,
  linkTierToDynamicInvoice,
  getDossiers,
  createDossier,
  deleteDossier,

  // Templates
  getAllTemplates,
  getTemplateById,
  createDynamicTemplate,
  updateTemplate,
  patchTemplate,
  deactivateTemplate,
  searchTemplates,
  getTemplatesBySupplierType,
  getReliableTemplates,
  getTemplatesBySupplier,

  // Extraction
  extractWithTemplate,
  extractFromFile,
  testTemplate,
  detectTemplate,

  // Accounting
  getAccounts,
  getAccountById,
  getAccountByCode,
  searchAccounts,
  getAccountsByClasse,
  createAccount,
  updateAccount,
  deactivateAccount,
  activateAccount,
  importAccounts,
  getChargeAccounts,
  getTvaAccounts,
  getFournisseurAccounts,

  getTiers: getAllTiers,
  getAllTiers,
  getTierById,
  getTierByTierNumber,
  getTierByIfNumber,
  getTierByIce,
  searchTiers,
  createTier,
  updateTier,
  deactivateTier,
  activateTier,
  getAccountingConfigs,
  createAccountingConfig,
  updateAccountingConfig,
  deleteAccountingConfig,
  getAccountingConfigBanks,

  // Bank Statements
  uploadBankStatement,
  processBankStatement,
  getAllBankStatements,
  getBankStatementById,
  validateBankStatement,
  updateBankStatementStatus,
  deleteBankStatement,
  deleteAllBankStatements,
  getBankStatementStats,
  retryFailedBankStatementPages,
  getBankOptions,
  getTransactionsByStatementId,
  updateBankTransaction,
  createBankTransaction,

  // Helpers
  getFileUrl,
  getDynamicInvoicePdfUrl,

  // Compatibility (Full Redirect to Dynamic)
  uploadInvoice: uploadDynamicInvoice,
  processInvoice: processDynamicInvoice,
  getInvoiceById: getDynamicInvoiceById,
  validateInvoice: validateDynamicInvoice,
  updateInvoiceFields: updateDynamicInvoiceFields,
  getAllInvoices: getAllDynamicInvoices,
  deleteInvoice: deleteDynamicInvoice,
  getInvoiceStats: getDynamicInvoiceStats,
  getAvailableSignatures: getDynamicAvailableSignatures,
  linkTierToInvoice: linkTierToDynamicInvoice,
  getInvoicePdfUrl: getDynamicInvoicePdfUrl,

  reprocessDynamic: processDynamicInvoice,
  processBulkDynamic: processDynamicInvoicesBulk,
  reprocessBulkDynamic: reprocessDynamicInvoicesBulk,
  updateDynamicFields: updateDynamicInvoiceFields,
  listDynamicInvoices: getAllDynamicInvoices,
  getAllDynamicTemplates: getAllTemplates,
  getDynamicTemplateById: getTemplateById,
  updateDynamicTemplate: updateTemplate,
  updateInvoiceStatus: updateInvoiceStatus,
}
