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
  DetectedFieldPattern,
  PatternStatistics,
  UserRole,
  AuthUser,
  CreateUserRequest,
  AccountingEntry,
} from "./types"

type DynamicInvoiceBulkItemResult = {
  invoiceId: number
  success: boolean
  status?: "VERIFY" | "READY_TO_TREAT" | "READY_TO_VALIDATE" | "VALIDATED" | "REJECTED"
  code?: string
  error?: string
}

export type DynamicInvoiceBulkResponse = {
  total: number
  successCount: number
  failedCount: number
  results: DynamicInvoiceBulkItemResult[]
}

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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://172.20.1.3:8089").replace(/\/$/, "")
const patternStatusOverrides = new Map<number, "PENDING" | "APPROVED" | "REJECTED">()
export const isBankApiEnabled = process.env.NEXT_PUBLIC_ENABLE_BANK_API === "true"

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined
  const raw = window.localStorage.getItem("currentDossierId")
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

function getPathFilename(pathOrName: string): string {
  if (!pathOrName) return ""
  return pathOrName.split(/[\\/]/).filter(Boolean).pop() || pathOrName
}

function url(path: string, query?: Record<string, string | number | boolean | undefined | null>): string {
  const u = new URL(`${API_BASE_URL}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && String(v) !== "") {
        u.searchParams.set(k, String(v))
      }
    }
  }
  return u.toString()
}

async function request<T>(
  path: string,
  init?: RequestInit,
  query?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
  const response = await fetch(url(path, query), {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const data = await response.json()
      message = data?.error || data?.message || message
    } catch {
      // no-op
    }
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function normalizeInvoiceStatus(status: string | undefined): DynamicInvoiceDto["status"] {
  const s = String(status || "").toUpperCase()
  if (s === "VERIFY" || s === "TO_VERIFY") return "VERIFY"
  if (s === "READY_TO_TREAT" || s === "PENDING" || s === "PROCESSING") return "READY_TO_TREAT"
  if (s === "READY_TO_VALIDATE" || s === "TREATED" || s === "PROCESSED") return "READY_TO_VALIDATE"
  if (s === "VALIDATED") return "VALIDATED"
  if (s === "REJECTED" || s === "ERROR") return "REJECTED"
  return "READY_TO_TREAT"
}

export function normalizeStatus(status: any): string {
  const s = String(status || "").toUpperCase()
  if (s === "VERIFY" || s === "TO_VERIFY") return "to_verify"
  if (s === "READY_TO_TREAT" || s === "PENDING") return "pending"
  if (s === "PROCESSING") return "processing"
  if (s === "TREATED" || s === "PROCESSED") return "treated"
  if (s === "READY_TO_VALIDATE") return "ready_to_validate"
  if (s === "VALIDATED") return "validated"
  if (s === "REJECTED" || s === "ERROR") return "error"
  return "pending"
}

export function getFileUrl(filePath: string, invoiceId?: number): string {
  const filename = getPathFilename(filePath)
  const dossierId = getCurrentDossierId()
  return url(`/api/dynamic-invoices/files/${encodeURIComponent(filename)}`, { dossierId, invoiceId })
}

export function getDynamicInvoicePdfUrl(filePath: string, invoiceId?: number): string {
  return getFileUrl(filePath, invoiceId)
}

function mapInvoice(raw: any): DynamicInvoiceDto {
  return {
    ...raw,
    status: raw?.status,
  } as DynamicInvoiceDto
}

function mapBankStatus(status: string | undefined): LocalBankStatement["status"] {
  const s = String(status || "").toUpperCase()
  if (s === "READY_TO_VALIDATE") return "treated"
  if (s.includes("VALID")) return "validated"
  if (s.includes("PENDING") || s.includes("ATTENTE")) return "pending"
  if (s.includes("PROCESS") || s.includes("COURS")) return "processing"
  if (s.includes("ERROR") || s.includes("ERREUR") || s.includes("DUPLIQUE") || s.includes("VIDE")) return "error"
  return "treated"
}

function mapBankStatement(raw: any): LocalBankStatement {
  const transactions = Array.isArray(raw?.transactions) ? raw.transactions : []
  const firstTx = transactions[0] || {}
  const fields = [
    { key: "dateOperation", label: "Date Opération", value: firstTx.dateOperation || firstTx.date || "", type: "date" as const },
    { key: "dateValeur", label: "Date Valeur", value: firstTx.dateValeur || "", type: "date" as const },
    { key: "libelle", label: "Libellé", value: firstTx.libelle || firstTx.description || "", type: "text" as const },
    { key: "debit", label: "Débit", value: firstTx.debit ?? "", type: "number" as const },
    { key: "credit", label: "Crédit", value: firstTx.credit ?? "", type: "number" as const },
    { key: "rib", label: "RIB", value: raw?.rib || "", type: "text" as const },
    { key: "bankName", label: "Banque", value: raw?.bankName || "", type: "text" as const },
  ]

  const filename = raw?.filename || raw?.originalName || `statement-${raw?.id || "unknown"}`

  return {
    ...(raw || {}),
    id: Number(raw?.id),
    filename,
    originalName: raw?.originalName,
    filePath: raw?.filePath || filename,
    fileSize: Number(raw?.fileSize || 0),
    fileUrl: url(`/api/v2/bank-statements/files/${encodeURIComponent(filename)}`),
    fields,
    status: mapBankStatus(raw?.statusCode || raw?.status),
    createdAt: new Date(raw?.createdAt || Date.now()),
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : undefined,
  } as LocalBankStatement
}

export async function uploadDynamicInvoice(file: File, dossierId?: number): Promise<DynamicInvoiceDto> {
  const formData = new FormData()
  formData.append("file", file)
  const resolvedDossierId = dossierId || getCurrentDossierId()
  if (resolvedDossierId) {
    formData.append("dossierId", String(resolvedDossierId))
  }
  const result = await request<any>("/api/dynamic-invoices/upload", { method: "POST", body: formData })
  return mapInvoice(result)
}

export async function processDynamicInvoice(id: number): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId()
  const result = await request<any>(`/api/dynamic-invoices/${id}/process`, { method: "POST" }, { dossierId })
  return mapInvoice(result)
}

export async function getDynamicInvoiceById(id: number): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId()
  const result = await request<any>(`/api/dynamic-invoices/${id}`, undefined, { dossierId })
  return mapInvoice(result)
}

export async function validateDynamicInvoice(id: number): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId()
  const result = await request<any>(`/api/dynamic-invoices/${id}/validate`, { method: "POST" }, { dossierId })
  return mapInvoice(result?.invoice || result)
}

export async function updateDynamicInvoiceFields(id: number, fields: Record<string, any>): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId()
  const result = await request<any>(`/api/dynamic-invoices/${id}/fields`, {
    method: "PUT",
    body: JSON.stringify(fields),
  }, { dossierId })
  return mapInvoice(result)
}

export async function getAllDynamicInvoices(status?: string, templateId?: number, limit: number = 50): Promise<DynamicInvoiceDto[]> {
  const dossierId = getCurrentDossierId()
  const result = await request<{ invoices?: any[] }>("/api/dynamic-invoices", undefined, {
    status,
    templateId,
    limit,
    dossierId,
  })
  return (result?.invoices || []).map(mapInvoice)
}

export async function deleteDynamicInvoice(id: number): Promise<void> {
  const dossierId = getCurrentDossierId()
  await request<void>(`/api/dynamic-invoices/${id}`, { method: "DELETE" }, { dossierId })
}

export async function updateInvoiceStatus(id: number | string, status: string): Promise<any> {
  const normalized = normalizeInvoiceStatus(status)
  const dossierId = getCurrentDossierId()

  if (normalized === "READY_TO_TREAT") {
    return request<any>(`/api/dynamic-invoices/${id}/client-validate`, { method: "POST" }, { dossierId })
  }

  throw new Error("Backend does not expose generic status update for this workflow state")
}

export async function clientValidateInvoice(id: number): Promise<any> {
  const dossierId = getCurrentDossierId()
  return request<any>(`/api/dynamic-invoices/${id}/client-validate`, { method: "POST" }, { dossierId })
}

export async function bulkDeleteInvoices(ids: number[]): Promise<any> {
  const dossierId = getCurrentDossierId()
  return request<any>("/api/dynamic-invoices/bulk/delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  }, { dossierId })
}

export async function getDynamicInvoiceStats(): Promise<any> {
  const dossierId = getCurrentDossierId()
  return request<any>("/api/dynamic-invoices/stats", undefined, { dossierId })
}

export async function processDynamicInvoicesBulk(invoiceIds: number[]): Promise<DynamicInvoiceBulkResponse> {
  const dossierId = getCurrentDossierId()
  const result = await request<any>("/api/dynamic-invoices/bulk/process", {
    method: "POST",
    body: JSON.stringify({ ids: invoiceIds }),
  }, { dossierId })

  return {
    total: Number(result?.count || invoiceIds.length),
    successCount: Number(result?.successCount || 0),
    failedCount: Number(result?.errorCount || 0),
    results: (result?.results || []).map((r: any) => ({
      invoiceId: Number(r?.id || r?.invoiceId),
      success: r?.status === "success",
      status: r?.invoice?.status,
      error: r?.error,
    })),
  }
}

export async function reprocessDynamicInvoicesBulk(invoiceIds: number[]): Promise<DynamicInvoiceBulkResponse> {
  return processDynamicInvoicesBulk(invoiceIds)
}

export async function getDynamicAvailableSignatures(id: number): Promise<any> {
  const dossierId = getCurrentDossierId()
  return request<any>(`/api/dynamic-invoices/${id}/available-signatures`, undefined, { dossierId })
}

export async function linkTierToDynamicInvoice(invoiceId: number, tierId: number): Promise<{ success: boolean; message: string; invoice: DynamicInvoiceDto }> {
  const dossierId = getCurrentDossierId()
  const result = await request<any>(`/api/dynamic-invoices/${invoiceId}/link-tier`, {
    method: "POST",
    body: JSON.stringify({ tierId }),
  }, { dossierId })

  return {
    success: Boolean(result?.success),
    message: result?.message || "Tier linked",
    invoice: mapInvoice(result?.invoice || {}),
  }
}

export async function getAllTemplates(): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>("/api/dynamic-templates")
}

export async function getTemplateById(id: number): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>(`/api/dynamic-templates/${id}`)
}

export async function createDynamicTemplate(requestPayload: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>("/api/dynamic-templates", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  })
}

export async function updateTemplate(id: number, requestPayload: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>(`/api/dynamic-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(requestPayload),
  })
}

export async function patchTemplate(id: number, requestPayload: UpdateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>(`/api/dynamic-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(requestPayload),
  })
}

export async function deactivateTemplate(id: number): Promise<void> {
  await request<void>(`/api/dynamic-templates/${id}`, { method: "DELETE" })
}

export async function searchTemplates(name: string): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>("/api/dynamic-templates/search", undefined, { name })
}

export async function getTemplatesBySupplierType(supplierType: string): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>(`/api/dynamic-templates/by-supplier-type/${encodeURIComponent(supplierType)}`)
}

export async function getReliableTemplates(): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>("/api/dynamic-templates/reliable")
}

export async function getTemplatesBySupplier(supplier: string): Promise<any> {
  return request<any>("/api/dynamic-templates/by-supplier", undefined, { supplier })
}

export async function extractWithTemplate(invoiceId: number, templateId?: number): Promise<DynamicExtractionResponse> {
  const dossierId = getCurrentDossierId()
  return request<DynamicExtractionResponse>(`/api/dynamic-templates/extract/${invoiceId}`, {
    method: "POST",
  }, {
    templateId,
    dossierId,
  })
}

export async function extractFromFile(file: File, templateId?: number): Promise<any> {
  const formData = new FormData()
  formData.append("file", file)
  if (templateId) formData.append("templateId", String(templateId))
  return request<any>("/api/dynamic-templates/extract-file", { method: "POST", body: formData })
}

export async function testTemplate(templateId: number, ocrText: string): Promise<any> {
  return request<any>(`/api/dynamic-templates/${templateId}/test`, {
    method: "POST",
    body: JSON.stringify({ ocrText }),
  })
}

export async function detectTemplate(ocrText: string): Promise<any> {
  return request<any>("/api/dynamic-templates/detect", {
    method: "POST",
    body: JSON.stringify({ ocrText }),
  })
}

export async function getAccounts(activeOnly: boolean = true): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>("/api/accounting/accounts", undefined, { activeOnly })
  return result?.accounts || []
}

export async function getAccountById(id: number): Promise<Account> {
  const result = await request<{ account: Account }>(`/api/accounting/accounts/${id}`)
  return result.account
}

export async function getAccountByCode(code: string): Promise<Account | null> {
  const result = await request<{ account?: Account }>(`/api/accounting/accounts/by-code/${encodeURIComponent(code)}`)
  return result?.account || null
}

export async function searchAccounts(query: string): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>("/api/accounting/accounts/search", undefined, { query })
  return result?.accounts || []
}

export async function getAccountsByClasse(classe: number): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>(`/api/accounting/accounts/by-classe/${classe}`)
  return result?.accounts || []
}

export async function getChargeAccounts(): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>("/api/accounting/accounts/charges")
  return result?.accounts || []
}

export async function getTvaAccounts(): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>("/api/accounting/accounts/tva")
  return result?.accounts || []
}

export async function getFournisseurAccounts(): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>("/api/accounting/accounts/fournisseurs")
  return result?.accounts || []
}

export async function createAccount(requestPayload: CreateAccountRequest): Promise<Account> {
  const result = await request<{ account: Account }>("/api/accounting/accounts", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  })
  return result.account
}

export async function updateAccount(id: number, requestPayload: UpdateAccountRequest): Promise<Account> {
  const result = await request<{ account: Account }>(`/api/accounting/accounts/${id}`, {
    method: "PUT",
    body: JSON.stringify(requestPayload),
  })
  return result.account
}

export async function deactivateAccount(id: number): Promise<void> {
  await request<void>(`/api/accounting/accounts/${id}`, { method: "DELETE" })
}

export async function activateAccount(id: number): Promise<void> {
  await request<void>(`/api/accounting/accounts/${id}/activate`, { method: "PATCH" })
}

export async function importAccounts(requests: CreateAccountRequest[]): Promise<any> {
  return request<any>("/api/accounting/accounts/import", {
    method: "POST",
    body: JSON.stringify(requests),
  })
}

export async function getAllTiers(activeOnly: boolean = true): Promise<Tier[]> {
  const dossierId = getCurrentDossierId()
  const result = await request<{ tiers?: Tier[] }>("/api/accounting/tiers", undefined, { activeOnly, dossierId })
  return result?.tiers || []
}

export async function getTierById(id: number): Promise<Tier> {
  const dossierId = getCurrentDossierId()
  const result = await request<{ tier: Tier }>(`/api/accounting/tiers/${id}`, undefined, { dossierId })
  return result.tier
}

export async function getTierByTierNumber(tierNumber: string): Promise<Tier | null> {
  const dossierId = getCurrentDossierId()
  const result = await request<{ tier?: Tier }>(`/api/accounting/tiers/by-tier-number/${encodeURIComponent(tierNumber)}`, undefined, { dossierId })
  return result?.tier || null
}

export async function getTierByIce(ice: string): Promise<Tier | null> {
  try {
    const dossierId = getCurrentDossierId()
    const result = await request<{ tier?: Tier }>(`/api/accounting/tiers/by-ice/${encodeURIComponent(ice)}`, undefined, { dossierId })
    return result?.tier || null
  } catch (error: any) {
    if (error?.status === 404) return null
    throw error
  }
}

export async function getTierByIfNumber(ifNumber: string): Promise<Tier | null> {
  try {
    const dossierId = getCurrentDossierId()
    const result = await request<{ tier?: Tier }>(`/api/accounting/tiers/by-if/${encodeURIComponent(ifNumber)}`, undefined, { dossierId })
    return result?.tier || null
  } catch (error: any) {
    if (error?.status === 404) return null
    throw error
  }
}

export async function searchTiers(query: string): Promise<Tier[]> {
  const dossierId = getCurrentDossierId()
  const result = await request<{ tiers?: Tier[] }>("/api/accounting/tiers/search", undefined, { query, dossierId })
  return result?.tiers || []
}

export async function createTier(requestPayload: CreateTierRequest): Promise<Tier> {
  const dossierId = getCurrentDossierId()
  const result = await request<{ tier: Tier }>("/api/accounting/tiers", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  }, { dossierId })
  return result.tier
}

export async function updateTier(id: number, requestPayload: UpdateTierRequest): Promise<Tier> {
  const dossierId = getCurrentDossierId()
  const result = await request<{ tier: Tier }>(`/api/accounting/tiers/${id}`, {
    method: "PUT",
    body: JSON.stringify(requestPayload),
  }, { dossierId })
  return result.tier
}

export async function deactivateTier(id: number): Promise<void> {
  const dossierId = getCurrentDossierId()
  await request<void>(`/api/accounting/tiers/${id}`, { method: "DELETE" }, { dossierId })
}

export async function activateTier(id: number): Promise<void> {
  const dossierId = getCurrentDossierId()
  await request<void>(`/api/accounting/tiers/${id}/activate`, { method: "PATCH" }, { dossierId })
}

// Journal comptable
export async function getAccountingEntries(): Promise<AccountingEntry[]> {
  const dossierId = getCurrentDossierId()
  const result = await request<any>("/api/accounting/journal/entries", undefined, { dossierId })
  if (Array.isArray(result)) return result as AccountingEntry[]
  if (Array.isArray(result?.entries)) return result.entries as AccountingEntry[]
  return []
}

export async function rebuildAccountingEntries(invoiceId: number): Promise<{ message: string; entries: AccountingEntry[] }> {
  const dossierId = getCurrentDossierId()
  return request<{ message: string; entries: AccountingEntry[] }>(
    `/api/accounting/journal/entries/rebuild/${invoiceId}`,
    { method: "POST" },
    { dossierId }
  )
}

export async function uploadBankStatement(file: File): Promise<LocalBankStatement> {
  const formData = new FormData()
  formData.append("file", file)
  const result = await request<any>("/api/v2/bank-statements/upload", {
    method: "POST",
    body: formData,
  })
  return mapBankStatement(result)
}

export async function getAllBankStatements(status?: string, limit: number = 50): Promise<LocalBankStatement[]> {
  const result = await request<{ statements?: any[] }>("/api/v2/bank-statements", undefined, { status, limit })
  return (result?.statements || []).map(mapBankStatement)
}

export async function getBankStatementById(id: number): Promise<LocalBankStatement> {
  const result = await request<any>(`/api/v2/bank-statements/${id}`)
  return mapBankStatement(result)
}

export async function validateBankStatement(id: number, _fields: any): Promise<LocalBankStatement> {
  const result = await request<any>(`/api/v2/bank-statements/${id}/validate`, { method: "POST" })
  return mapBankStatement(result?.statement || result)
}

export async function deleteBankStatement(id: number): Promise<void> {
  await request<void>(`/api/v2/bank-statements/${id}`, { method: "DELETE" })
}

// ============================================
// AUTH / UTILISATEURS
// ============================================

export async function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me")
}

export async function listUsers(): Promise<AuthUser[]> {
  return request<AuthUser[]>("/api/auth/users")
}

export async function createUser(requestPayload: CreateUserRequest): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  })
}

export async function deactivateUser(id: number): Promise<void> {
  await request<void>(`/api/auth/users/${id}`, { method: "DELETE" })
}

export async function updateUserRole(id: number, role: UserRole): Promise<AuthUser> {
  return request<AuthUser>(`/api/auth/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  })
}

export async function updateUserActive(id: number, active: boolean): Promise<AuthUser> {
  return request<AuthUser>(`/api/auth/users/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  })
}

export async function getDossiers(): Promise<BackendDossierDto[]> {
  const dossiers = await request<any[]>("/api/dossiers")
  return (dossiers || []).map((d) => ({
    id: d.id,
    name: d.name,
    status: d.active ? "ACTIVE" : "INACTIVE",
    comptableId: d.comptableId,
    fournisseurId: d.clientId,
    fournisseurEmail: d.clientUsername,
    comptableEmail: d.comptableUsername,
    createdAt: d.createdAt,
    invoicesCount: d.invoicesCount || 0,
    bankStatementsCount: d.bankStatementsCount || 0,
    pendingInvoicesCount: d.pendingInvoicesCount || 0,
    validatedInvoicesCount: d.validatedInvoicesCount || 0,
  }))
}

export async function createDossier(payload: { nom: string; fournisseurEmail: string }): Promise<any> {
  const username = payload.fournisseurEmail.trim()
  const displayName = username.split("@")[0] || username
  const result = await request<any>("/api/dossiers", {
    method: "POST",
    body: JSON.stringify({
      dossierName: payload.nom,
      clientUsername: username,
      clientPassword: "ChangeMe123!",
      clientDisplayName: displayName,
    }),
  })

  return {
    success: true,
    dossier: {
      id: result?.id,
      name: result?.name || payload.nom,
      fournisseurEmail: username,
      comptableId: result?.comptableId,
      fournisseurId: result?.clientId,
    },
  }
}

export async function deleteDossier(id: number): Promise<void> {
  await request<void>(`/api/dossiers/${id}`, { method: "DELETE" })
}

export async function getAllPatterns(): Promise<DetectedFieldPattern[]> {
  const data = await request<any[]>("/api/field-patterns")
  return (data || []).map((p) => ({
    patternId: Number(p.id),
    invoiceId: 0,
    invoiceNumber: "",
    fieldName: p.fieldName,
    fieldLabel: p.fieldName,
    patternText: p.patternRegex,
    fieldValue: "",
    status: patternStatusOverrides.get(Number(p.id)) || "APPROVED",
    detectedAt: new Date().toISOString(),
    approvedAt: undefined,
    approvedBy: undefined,
  }))
}

export async function getPatternStatistics(): Promise<PatternStatistics> {
  const patterns = await getAllPatterns()
  const totalPatterns = patterns.length
  const pendingPatterns = patterns.filter((p) => p.status === "PENDING").length
  const approvedPatterns = patterns.filter((p) => p.status === "APPROVED").length
  const rejectedPatterns = patterns.filter((p) => p.status === "REJECTED").length
  const approvalRate = totalPatterns > 0 ? (approvedPatterns / totalPatterns) * 100 : 0
  const patternsByField: Record<string, number> = {}

  for (const pattern of patterns) {
    patternsByField[pattern.fieldName] = (patternsByField[pattern.fieldName] || 0) + 1
  }

  return {
    totalPatterns,
    pendingPatterns,
    approvedPatterns,
    rejectedPatterns,
    approvalRate,
    patternsByField,
  }
}

export async function approvePattern(patternId: number): Promise<void> {
  patternStatusOverrides.set(patternId, "APPROVED")
}

export async function rejectPattern(patternId: number): Promise<void> {
  patternStatusOverrides.set(patternId, "REJECTED")
}

export const api = {
  uploadDynamicInvoice,
  processDynamicInvoice,
  getDynamicInvoiceById,
  validateDynamicInvoice,
  updateDynamicInvoiceFields,
  getAllDynamicInvoices,
  deleteDynamicInvoice,
  clientValidateInvoice,
  bulkDeleteInvoices,
  getDynamicInvoiceStats,
  processDynamicInvoicesBulk,
  reprocessDynamicInvoicesBulk,
  getDynamicAvailableSignatures,
  linkTierToDynamicInvoice,
  getCurrentUser,
  listUsers,
  createUser,
  deactivateUser,
  updateUserRole,
  updateUserActive,
  getDossiers,
  createDossier,
  deleteDossier,
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
  extractWithTemplate,
  extractFromFile,
  testTemplate,
  detectTemplate,
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
  getTierById,
  getTierByTierNumber,
  getTierByIfNumber,
  getTierByIce,
  searchTiers,
  createTier,
  updateTier,
  deactivateTier,
  activateTier,
  getAccountingEntries,
  rebuildAccountingEntries,
  uploadBankStatement,
  getAllBankStatements,
  getBankStatementById,
  validateBankStatement,
  deleteBankStatement,
  getAllPatterns,
  getPatternStatistics,
  approvePattern,
  rejectPattern,
  getFileUrl,
  getDynamicInvoicePdfUrl,
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
  updateInvoiceStatus,
  isBankApiEnabled,
}
