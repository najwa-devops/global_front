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
} from "./types"
import { MOCK_ACCOUNTS, MOCK_TIERS } from "@/src/mock/data.mock"

type ApiEnvelope<T> = { success: boolean; data: T; error?: string; code?: string }

export type DynamicInvoiceBulkItemResult = {
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

const nowIso = () => new Date().toISOString()
let nextInvoiceId = 1000
let nextTemplateId = 100
let nextAccountId = 100
let nextTierId = 100
let nextStatementId = 1000
let nextDossierId = 100

let invoices: DynamicInvoiceDto[] = [
  {
    id: 1,
    filename: "fac-001.pdf",
    filePath: "static/fac-001.pdf",
    fileSize: 120000,
    fieldsData: { invoiceNumber: "FAC-001", supplier: "Maroc Tech SARL", invoiceDate: "2025-01-25", amountHT: "10000", tva: "2500", amountTTC: "12500", ice: "001234567890012", ifNumber: "98765432" },
    status: "VERIFY",
    createdAt: "2025-01-25T10:00:00.000Z",
    dossierId: 1,
  },
  {
    id: 2,
    filename: "fac-002.pdf",
    filePath: "static/fac-002.pdf",
    fileSize: 98000,
    fieldsData: { invoiceNumber: "FAC-002", supplier: "Imprimerie Atlas", invoiceDate: "2025-02-20", amountHT: "3750", tva: "750", amountTTC: "4500", ice: "002233445566778", ifNumber: "11223344" },
    status: "READY_TO_TREAT",
    createdAt: "2025-02-20T10:00:00.000Z",
    dossierId: 2,
  },
  {
    id: 3,
    filename: "fac-003.pdf",
    filePath: "static/fac-003.pdf",
    fileSize: 111000,
    fieldsData: { invoiceNumber: "FAC-003", supplier: "Agro Maroc SA", invoiceDate: "2025-03-18", amountHT: "15416.67", tva: "3083.33", amountTTC: "18500" },
    status: "VALIDATED",
    createdAt: "2025-03-18T10:00:00.000Z",
    dossierId: 3,
  },
]

let templates: DynamicTemplateDto[] = [
  { id: 1, templateName: "Template Maroc Tech", supplierType: "MAROC_TECH", signature: { type: "ICE", value: "001234567890012" }, fieldDefinitions: [{ fieldName: "invoiceNumber", labels: ["Facture"], fieldType: "TEXT", required: true }], active: true, version: 1, usageCount: 10, successCount: 9, successRate: 90, reliable: true, createdAt: nowIso() },
]

let accounts: Account[] = MOCK_ACCOUNTS.map((a) => ({ ...a }))
let tiers: Tier[] = MOCK_TIERS.map((t) => ({ ...t }))

let statements: LocalBankStatement[] = [
  { id: 1, filename: "releve-jan.pdf", filePath: "static/releve-jan.pdf", fileSize: 78000, fields: [{ key: "period", label: "Periode", value: "Janvier 2025", type: "text" }], status: "pending", createdAt: new Date("2025-02-01"), updatedAt: new Date("2025-02-01") },
  { id: 2, filename: "releve-fev.pdf", filePath: "static/releve-fev.pdf", fileSize: 81000, fields: [{ key: "period", label: "Periode", value: "Fevrier 2025", type: "text" }], status: "validated", createdAt: new Date("2025-03-01"), updatedAt: new Date("2025-03-01") },
]

let dossiers: BackendDossierDto[] = [
  { id: 1, name: "Dossier SARL Maroc Tech", comptableId: 1, comptableEmail: "comptable@example.com", fournisseurId: 10, fournisseurEmail: "contact@maroctech.ma", status: "ACTIVE", createdAt: "2025-01-20", invoicesCount: 18, pendingInvoicesCount: 3, validatedInvoicesCount: 15, bankStatementsCount: 6 },
  { id: 2, name: "Dossier Imprimerie Atlas", comptableId: 1, comptableEmail: "comptable@example.com", fournisseurId: 11, fournisseurEmail: "atlas@imprimerie.ma", status: "ACTIVE", createdAt: "2025-02-05", invoicesCount: 22, pendingInvoicesCount: 5, validatedInvoicesCount: 17, bankStatementsCount: 8 },
]

let patterns: DetectedFieldPattern[] = [
  { patternId: 1, invoiceId: 1, invoiceNumber: "FAC-001", fieldName: "invoiceNumber", fieldLabel: "N Facture", patternText: "FAC-[0-9]+", status: "PENDING", detectedAt: nowIso() },
]

function toBackendStatus(status?: string): DynamicInvoiceDto["status"] {
  const s = String(status || "").toUpperCase()
  if (s === "TO_VERIFY" || s === "VERIFY") return "VERIFY"
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

export async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiEnvelope<unknown>
    return data.error || response.statusText
  } catch {
    return response.statusText
  }
}

export function getFileUrl(_filePath: string): string { return "/placeholder.jpg" }
export function getDynamicInvoicePdfUrl(filePath: string): string { return getFileUrl(filePath) }

export async function uploadDynamicInvoice(file: File, dossierId?: number): Promise<DynamicInvoiceDto> {
  const invoice: DynamicInvoiceDto = { id: ++nextInvoiceId, filename: file.name, originalName: file.name, filePath: `static/${file.name}`, fileSize: file.size || 0, fieldsData: { invoiceNumber: `INV-${nextInvoiceId}`, supplier: "Nouveau fournisseur", amountHT: "0", tva: "0", amountTTC: "0", invoiceDate: nowIso().slice(0, 10) }, status: "READY_TO_TREAT", createdAt: nowIso(), dossierId }
  invoices = [invoice, ...invoices]
  return invoice
}
export async function processDynamicInvoice(id: number): Promise<DynamicInvoiceDto> { const i = invoices.find((x) => x.id === id); if (!i) throw new Error("Facture introuvable"); i.status = "READY_TO_VALIDATE"; i.updatedAt = nowIso(); return i }
export async function getDynamicInvoiceById(id: number): Promise<DynamicInvoiceDto> { const i = invoices.find((x) => x.id === id); if (!i) throw new Error("Facture introuvable"); return i }
export async function validateDynamicInvoice(id: number): Promise<DynamicInvoiceDto> { const i = await getDynamicInvoiceById(id); i.status = "VALIDATED"; i.validatedAt = nowIso(); i.validatedBy = "comptable@example.com"; return i }
export async function updateDynamicInvoiceFields(id: number, fields: Record<string, any>): Promise<DynamicInvoiceDto> { const i = await getDynamicInvoiceById(id); i.fieldsData = { ...(i.fieldsData || {}), ...fields }; i.updatedAt = nowIso(); return i }
export async function getAllDynamicInvoices(status?: string, templateId?: number, limit: number = 50): Promise<DynamicInvoiceDto[]> { let data = [...invoices]; if (status) data = data.filter((i) => toBackendStatus(i.status) === toBackendStatus(status)); if (templateId) data = data.filter((i) => i.templateId === templateId); return data.slice(0, limit) }
export async function deleteDynamicInvoice(id: number): Promise<void> { invoices = invoices.filter((i) => i.id !== id) }
export async function updateInvoiceStatus(id: number | string, status: string): Promise<any> { const i = await getDynamicInvoiceById(Number(id)); i.status = toBackendStatus(status); return i }
export async function getDynamicInvoiceStats(): Promise<any> { const all = invoices.map((i) => toBackendStatus(i.status)); return { total: all.length, verify: all.filter((s) => s === "VERIFY").length, readyToTreat: all.filter((s) => s === "READY_TO_TREAT").length, readyToValidate: all.filter((s) => s === "READY_TO_VALIDATE").length, validated: all.filter((s) => s === "VALIDATED").length, rejected: all.filter((s) => s === "REJECTED").length } }
export async function processDynamicInvoicesBulk(invoiceIds: number[]): Promise<DynamicInvoiceBulkResponse> { const results = await Promise.all(invoiceIds.map(async (id) => { try { const i = await processDynamicInvoice(id); return { invoiceId: id, success: true, status: i.status } as DynamicInvoiceBulkItemResult } catch { return { invoiceId: id, success: false, code: "NOT_FOUND", error: "Facture introuvable" } } })); return { total: results.length, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length, results } }
export async function reprocessDynamicInvoicesBulk(invoiceIds: number[]): Promise<DynamicInvoiceBulkResponse> { return processDynamicInvoicesBulk(invoiceIds) }
export async function getDynamicAvailableSignatures(_id: number): Promise<any> { return [{ type: "ICE", value: "001234567890012", confidence: 0.95 }] }
export async function linkTierToDynamicInvoice(invoiceId: number, tierId: number): Promise<{ success: boolean; message: string; invoice: DynamicInvoiceDto }> { const i = await getDynamicInvoiceById(invoiceId); const t = tiers.find((x) => x.id === tierId); if (!t) throw new Error("Tier introuvable"); i.tier = t; i.fieldsData = { ...(i.fieldsData || {}), tierNumber: t.tierNumber }; return { success: true, message: "Tier linked", invoice: i } }

export async function getAllTemplates(): Promise<DynamicTemplateDto[]> { return [...templates] }
export async function getTemplateById(id: number): Promise<DynamicTemplateDto> { const t = templates.find((x) => x.id === id); if (!t) throw new Error("Template introuvable"); return t }
export async function createDynamicTemplate(request: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> { const t: DynamicTemplateDto = { id: ++nextTemplateId, templateName: request.templateName, supplierType: request.supplierType, signature: request.signature, fieldDefinitions: request.fieldDefinitions, fixedSupplierData: request.fixedSupplierData, active: true, version: 1, description: request.description, usageCount: 0, successCount: 0, successRate: 0, reliable: false, createdAt: nowIso(), createdBy: request.createdBy }; templates = [t, ...templates]; return t }
export async function updateTemplate(id: number, request: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> { const t = await getTemplateById(id); Object.assign(t, request); return t }
export async function patchTemplate(id: number, request: UpdateDynamicTemplateRequest): Promise<DynamicTemplateDto> { const t = await getTemplateById(id); Object.assign(t, request); return t }
export async function deactivateTemplate(id: number): Promise<void> { const t = await getTemplateById(id); t.active = false }
export async function searchTemplates(name: string): Promise<DynamicTemplateDto[]> { const q = name.toLowerCase(); return templates.filter((t) => t.templateName.toLowerCase().includes(q)) }
export async function getTemplatesBySupplierType(supplierType: string): Promise<DynamicTemplateDto[]> { const q = supplierType.toLowerCase(); return templates.filter((t) => t.supplierType.toLowerCase().includes(q)) }
export async function getReliableTemplates(): Promise<DynamicTemplateDto[]> { return templates.filter((t) => t.reliable) }
export async function getTemplatesBySupplier(supplier: string): Promise<any> { const q = supplier.toLowerCase(); return templates.filter((t) => (t.fixedSupplierData?.supplier || "").toLowerCase().includes(q)) }

export async function extractWithTemplate(invoiceId: number, templateId?: number): Promise<DynamicExtractionResponse> { const i = await getDynamicInvoiceById(invoiceId); const extractedFields: Record<string, any> = {}; Object.entries(i.fieldsData || {}).forEach(([k, v]) => { extractedFields[k] = { value: String(v), confidence: 0.9, detectionMethod: "STATIC_MOCK", validated: true } }); return { success: true, message: "Extraction statique", invoiceId: i.id, templateId, templateName: templateId ? templates.find((t) => t.id === templateId)?.templateName : i.templateName, extractedFields, missingFields: [], lowConfidenceFields: [], overallConfidence: 0.9, extractedCount: Object.keys(extractedFields).length, totalFields: Object.keys(extractedFields).length, isComplete: true, extractionMethod: "DYNAMIC_TEMPLATE", status: i.status } }
export async function extractFromFile(file: File, templateId?: number): Promise<any> { const inv = await uploadDynamicInvoice(file); return extractWithTemplate(inv.id, templateId) }
export async function testTemplate(templateId: number, _ocrText: string): Promise<any> { return { success: !!templates.find((t) => t.id === templateId), templateId } }
export async function detectTemplate(_ocrText: string): Promise<any> { return { detected: templates.length > 0, templateId: templates[0]?.id, templateName: templates[0]?.templateName, confidence: 0.88 } }

export async function getAccounts(activeOnly: boolean = true): Promise<Account[]> { return activeOnly ? accounts.filter((a) => a.active) : [...accounts] }
export async function getAccountById(id: number): Promise<Account> { const a = accounts.find((x) => x.id === id); if (!a) throw new Error("Compte introuvable"); return a }
export async function getAccountByCode(code: string): Promise<Account | null> { return accounts.find((a) => a.code === code) || null }
export async function searchAccounts(query: string): Promise<Account[]> { const q = query.toLowerCase(); return accounts.filter((a) => a.code.includes(query) || a.libelle.toLowerCase().includes(q)) }
export async function getAccountsByClasse(classe: number): Promise<Account[]> { return accounts.filter((a) => a.classe === classe) }
export async function getChargeAccounts(): Promise<Account[]> { const a = await getAccounts(true); return a.filter((x) => x.isChargeAccount || x.classe === 6 || x.code.startsWith("6")) }
export async function getTvaAccounts(): Promise<Account[]> { const a = await getAccounts(true); return a.filter((x) => x.isTvaAccount || x.code.startsWith("3455") || x.code.startsWith("4455")) }
export async function getFournisseurAccounts(): Promise<Account[]> { const a = await getAccounts(true); return a.filter((x) => x.isFournisseurAccount || x.code.startsWith("4411")) }
export async function createAccount(request: CreateAccountRequest): Promise<Account> { const a: Account = { id: ++nextAccountId, code: request.code, libelle: request.libelle, active: request.active ?? true, classe: Number(request.code.charAt(0)) || 0, tvaRate: request.tvaRate, taxCode: request.taxCode }; accounts = [a, ...accounts]; return a }
export async function updateAccount(id: number, request: UpdateAccountRequest): Promise<Account> { const a = await getAccountById(id); Object.assign(a, request); return a }
export async function deactivateAccount(id: number): Promise<void> { const a = await getAccountById(id); a.active = false }
export async function activateAccount(id: number): Promise<void> { const a = await getAccountById(id); a.active = true }
export async function importAccounts(requests: CreateAccountRequest[]): Promise<any> { const created = await Promise.all(requests.map((r) => createAccount(r))); return { imported: created.length, accounts: created } }

export async function getAllTiers(activeOnly: boolean = true): Promise<Tier[]> { return activeOnly ? tiers.filter((t) => t.active) : [...tiers] }
export async function getTierById(id: number): Promise<Tier> { const t = tiers.find((x) => x.id === id); if (!t) throw new Error("Tier introuvable"); return t }
export async function getTierByTierNumber(tierNumber: string): Promise<Tier | null> { return tiers.find((t) => t.tierNumber === tierNumber) || null }
export async function getTierByIce(ice: string): Promise<Tier | null> { return tiers.find((t) => t.ice === ice) || null }
export async function getTierByIfNumber(ifNumber: string): Promise<Tier | null> { return tiers.find((t) => t.ifNumber === ifNumber) || null }
export async function searchTiers(query: string): Promise<Tier[]> { const q = query.toLowerCase(); return tiers.filter((t) => t.libelle.toLowerCase().includes(q) || t.tierNumber.includes(query)) }
export async function createTier(request: CreateTierRequest): Promise<Tier> { const t: Tier = { id: ++nextTierId, libelle: request.libelle, auxiliaireMode: request.auxiliaireMode, tierNumber: request.tierNumber, collectifAccount: request.collectifAccount, ifNumber: request.ifNumber, ice: request.ice, rcNumber: request.rcNumber, defaultChargeAccount: request.defaultChargeAccount, tvaAccount: request.tvaAccount, defaultTvaRate: request.defaultTvaRate, active: request.active ?? true, hasAccountingConfig: true }; tiers = [t, ...tiers]; return t }
export async function updateTier(id: number, request: UpdateTierRequest): Promise<Tier> { const t = await getTierById(id); Object.assign(t, request); return t }
export async function deactivateTier(id: number): Promise<void> { const t = await getTierById(id); t.active = false }
export async function activateTier(id: number): Promise<void> { const t = await getTierById(id); t.active = true }

export async function uploadBankStatement(file: File): Promise<LocalBankStatement> { const s: LocalBankStatement = { id: ++nextStatementId, filename: file.name, originalName: file.name, filePath: `static/${file.name}`, fileSize: file.size || 0, fields: [{ key: "period", label: "Periode", value: "Nouveau releve", type: "text" }], status: "pending", createdAt: new Date(), updatedAt: new Date() }; statements = [s, ...statements]; return s }
export async function getAllBankStatements(status?: string, limit: number = 50): Promise<LocalBankStatement[]> { let data = [...statements]; if (status) data = data.filter((s) => normalizeStatus(s.status) === normalizeStatus(status)); return data.slice(0, limit) }
export async function getBankStatementById(id: number): Promise<LocalBankStatement> { const s = statements.find((x) => x.id === id); if (!s) throw new Error("Releve introuvable"); return s }
export async function validateBankStatement(id: number, fields: any): Promise<LocalBankStatement> { const s = await getBankStatementById(id); s.fields = Array.isArray(fields) ? fields : s.fields; s.status = "validated"; s.updatedAt = new Date(); return s }
export async function deleteBankStatement(id: number): Promise<void> { statements = statements.filter((s) => s.id !== id) }

export async function getDossiers(): Promise<BackendDossierDto[]> { return [...dossiers] }
export async function createDossier(payload: { nom: string; fournisseurEmail: string }): Promise<any> { const d: BackendDossierDto = { id: ++nextDossierId, name: payload.nom, status: "ACTIVE", comptableId: 1, comptableEmail: "comptable@example.com", fournisseurId: nextDossierId + 100, fournisseurEmail: payload.fournisseurEmail, createdAt: nowIso(), invoicesCount: 0, bankStatementsCount: 0, pendingInvoicesCount: 0, validatedInvoicesCount: 0 }; dossiers = [d, ...dossiers]; return { success: true, dossier: d } }
export async function deleteDossier(id: number): Promise<void> { dossiers = dossiers.filter((d) => d.id !== id); invoices = invoices.filter((i) => i.dossierId !== id) }

export async function getAllPatterns(): Promise<DetectedFieldPattern[]> { return [...patterns] }
export async function getPatternStatistics(): Promise<PatternStatistics> { const totalPatterns = patterns.length; const pendingPatterns = patterns.filter((p) => p.status === "PENDING").length; const approvedPatterns = patterns.filter((p) => p.status === "APPROVED").length; const rejectedPatterns = patterns.filter((p) => p.status === "REJECTED").length; const approvalRate = totalPatterns ? (approvedPatterns / totalPatterns) * 100 : 0; const patternsByField: Record<string, number> = {}; patterns.forEach((p) => { patternsByField[p.fieldName] = (patternsByField[p.fieldName] || 0) + 1 }); return { totalPatterns, pendingPatterns, approvedPatterns, rejectedPatterns, approvalRate, patternsByField } }
export async function approvePattern(patternId: number): Promise<void> { const p = patterns.find((x) => x.patternId === patternId); if (!p) throw new Error("Pattern introuvable"); p.status = "APPROVED"; p.approvedAt = nowIso(); p.approvedBy = "admin@example.com" }
export async function rejectPattern(patternId: number): Promise<void> { const p = patterns.find((x) => x.patternId === patternId); if (!p) throw new Error("Pattern introuvable"); p.status = "REJECTED" }

export const api = {
  uploadDynamicInvoice, processDynamicInvoice, getDynamicInvoiceById, validateDynamicInvoice, updateDynamicInvoiceFields, getAllDynamicInvoices, deleteDynamicInvoice, getDynamicInvoiceStats, processDynamicInvoicesBulk, reprocessDynamicInvoicesBulk, getDynamicAvailableSignatures, linkTierToDynamicInvoice, getDossiers, createDossier, deleteDossier,
  getAllTemplates, getTemplateById, createDynamicTemplate, updateTemplate, patchTemplate, deactivateTemplate, searchTemplates, getTemplatesBySupplierType, getReliableTemplates, getTemplatesBySupplier,
  extractWithTemplate, extractFromFile, testTemplate, detectTemplate,
  getAccounts, getAccountById, getAccountByCode, searchAccounts, getAccountsByClasse, createAccount, updateAccount, deactivateAccount, activateAccount, importAccounts, getChargeAccounts, getTvaAccounts, getFournisseurAccounts,
  getTiers: getAllTiers, getTierById, getTierByTierNumber, getTierByIfNumber, getTierByIce, searchTiers, createTier, updateTier, deactivateTier, activateTier,
  uploadBankStatement, getAllBankStatements, getBankStatementById, validateBankStatement, deleteBankStatement,
  getAllPatterns, getPatternStatistics, approvePattern, rejectPattern,
  getFileUrl, getDynamicInvoicePdfUrl,
  uploadInvoice: uploadDynamicInvoice, processInvoice: processDynamicInvoice, getInvoiceById: getDynamicInvoiceById, validateInvoice: validateDynamicInvoice, updateInvoiceFields: updateDynamicInvoiceFields, getAllInvoices: getAllDynamicInvoices, deleteInvoice: deleteDynamicInvoice, getInvoiceStats: getDynamicInvoiceStats, getAvailableSignatures: getDynamicAvailableSignatures, linkTierToInvoice: linkTierToDynamicInvoice, getInvoicePdfUrl: getDynamicInvoicePdfUrl,
  reprocessDynamic: processDynamicInvoice, processBulkDynamic: processDynamicInvoicesBulk, reprocessBulkDynamic: reprocessDynamicInvoicesBulk, updateDynamicFields: updateDynamicInvoiceFields, listDynamicInvoices: getAllDynamicInvoices, getAllDynamicTemplates: getAllTemplates, getDynamicTemplateById: getTemplateById, updateDynamicTemplate: updateTemplate, updateInvoiceStatus,
}

