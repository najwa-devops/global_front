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
  BankTransaction,
  BankTransactionV2,
  DetectedFieldPattern,
  PatternStatistics,
  UserRole,
  AuthUser,
  CreateUserRequest,
  AccountingEntry,
} from "./types";
import type { JournalPeriod, JournalItem, JournalEntryRow } from "@/releve-bancaire/types";

type DynamicInvoiceBulkItemResult = {
  invoiceId: number;
  success: boolean;
  status?:
    | "VERIFY"
    | "READY_TO_TREAT"
    | "READY_TO_VALIDATE"
    | "VALIDATED"
    | "REJECTED";
  code?: string;
  error?: string;
};

export type DynamicInvoiceBulkResponse = {
  total: number;
  successCount: number;
  failedCount: number;
  results: DynamicInvoiceBulkItemResult[];
};

export type DynamicInvoiceUploadBatchItem = {
  filename: string;
  status: "success" | "error";
  invoice?: DynamicInvoiceDto;
  error?: string;
  httpStatus?: number;
};

export type DynamicInvoiceUploadBatchResponse = {
  count: number;
  successCount: number;
  errorCount: number;
  results: DynamicInvoiceUploadBatchItem[];
};

export type BackendDossierDto = {
  id: number;
  name: string;
  ice?: string;
  status?: string;
  comptableId?: number;
  comptableEmail?: string;
  fournisseurId?: number;
  fournisseurEmail?: string;
  createdAt?: string;
  exerciseStartDate?: string;
  exerciseEndDate?: string;
  invoicesCount?: number;
  bankStatementsCount?: number;
  centreMonetiqueCount?: number;
  pendingInvoicesCount?: number;
  validatedInvoicesCount?: number;
};

export type AccountingConfigDto = {
  id: number;
  journal: string;
  designation: string;
  banque: string;
  compteComptable: string;
  rib: string;
  ttcEnabled?: boolean;
};
export type UpsertAccountingConfigRequest = Omit<AccountingConfigDto, "id">;

export type DossierGeneralParamsDto = {
  dossierId?: number;
  companyName?: string;
  address?: string;
  legalForm?: string;
  rcNumber?: string;
  ifNumber?: string;
  tsc?: string;
  activity?: string;
  category?: string;
  professionalTax?: string;
  cmRate?: number | null;
  isRate?: number | null;
  ice?: string;
  cniOrResidenceCard?: string;
  legalRepresentative?: string;
  capital?: number | null;
  subjectToRas?: boolean;
  individualPerson?: boolean;
  hasFiscalRegularityCertificate?: boolean;
};

const rawApiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
const API_BASE_URL = rawApiBaseUrl === "/api" ? "" : rawApiBaseUrl;
const patternStatusOverrides = new Map<
  number,
  "PENDING" | "APPROVED" | "REJECTED"
>();
export const isBankApiEnabled =
  process.env.NEXT_PUBLIC_ENABLE_BANK_API === "true";

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const fromQuery = Number(
    new URLSearchParams(window.location.search).get("dossierId"),
  );
  if (Number.isFinite(fromQuery) && fromQuery > 0) {
    window.localStorage.setItem("currentDossierId", String(fromQuery));
    return fromQuery;
  }
  const storageKeys = ["currentDossierId", "selectedDossierId", "dossierId"];
  for (const key of storageKeys) {
    const local = Number(window.localStorage.getItem(key));
    if (Number.isFinite(local) && local > 0) return local;
    const session = Number(window.sessionStorage.getItem(key));
    if (Number.isFinite(session) && session > 0) return session;
  }
  return undefined;
}

function getPathFilename(pathOrName: string): string {
  if (!pathOrName) return "";
  return pathOrName.split(/[\\/]/).filter(Boolean).pop() || pathOrName;
}

function normalizeTierPayload<T extends CreateTierRequest | UpdateTierRequest>(
  payload: T,
): T {
  const normalizeCode = (value?: string) => {
    if (value == null) return undefined;
    const normalized = value.trim().replace(/\s+/g, "");
    return normalized ? normalized.toUpperCase() : undefined;
  };
  const normalizeIdentifier = (value?: string) => {
    if (value == null) return undefined;
    const normalized = value.trim().replace(/\s+/g, "");
    return normalized || undefined;
  };
  const normalizeText = (value?: string) => {
    if (value == null) return undefined;
    const normalized = value.trim();
    return normalized || undefined;
  };

  return {
    ...payload,
    libelle: normalizeText(payload.libelle),
    activity: normalizeText(payload.activity),
    tierNumber: normalizeCode(payload.tierNumber),
    collectifAccount: normalizeCode(payload.collectifAccount),
    ifNumber: normalizeIdentifier(payload.ifNumber),
    ice: normalizeIdentifier(payload.ice),
    rcNumber: normalizeIdentifier(payload.rcNumber),
    defaultChargeAccount: normalizeCode(payload.defaultChargeAccount),
    tvaAccount: normalizeCode(payload.tvaAccount),
  } as T;
}

function url(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullPath = `${API_BASE_URL}${normalizedPath}`;
  if (!query) return fullPath;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v) !== "") {
      params.set(k, String(v));
    }
  }

  const qs = params.toString();
  if (!qs) return fullPath;
  return `${fullPath}${fullPath.includes("?") ? "&" : "?"}${qs}`;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  query?: Record<string, string | number | boolean | undefined | null>,
): Promise<T> {
  const response = await fetch(url(path, query), {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      message = data?.error || data?.message || message;
    } catch {
      // no-op
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function normalizeInvoiceStatus(
  status: string | undefined,
): DynamicInvoiceDto["status"] {
  const s = String(status || "").toUpperCase();
  if (s === "VERIFY" || s === "TO_VERIFY") return "VERIFY";
  if (s === "ACCOUNTED") return "VALIDATED";
  if (s === "READY_TO_TREAT" || s === "PENDING" || s === "PROCESSING")
    return "READY_TO_TREAT";
  if (s === "RECALCULATED") return "READY_TO_VALIDATE";
  if (s === "OUT_OF_PERIOD") return "READY_TO_VALIDATE";
  if (s === "DUPLICATE") return "REJECTED";
  if (s === "READY_TO_VALIDATE" || s === "TREATED" || s === "PROCESSED")
    return "READY_TO_VALIDATE";
  if (s === "VALIDATED") return "VALIDATED";
  if (s === "REJECTED" || s === "ERROR") return "REJECTED";
  return "READY_TO_TREAT";
}

export function normalizeStatus(status: any): string {
  const s = String(status || "").toUpperCase();
  if (s === "VERIFY" || s === "TO_VERIFY") return "to_verify";
  if (s === "READY_TO_TREAT" || s === "PENDING") return "pending";
  if (s === "PROCESSING") return "processing";
  if (s === "RECALCULATED") return "treated";
  if (s === "OUT_OF_PERIOD") return "treated";
  if (s === "ACCOUNTED") return "validated";
  if (s === "DUPLICATE") return "error";
  if (s === "TREATED" || s === "PROCESSED") return "treated";
  if (s === "READY_TO_VALIDATE") return "ready_to_validate";
  if (s === "VALIDATED") return "validated";
  if (s === "REJECTED" || s === "ERROR") return "error";
  return "pending";
}

export async function parseApiError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type");
  try {
    if (contentType && contentType.includes("application/json")) {
      const errorData = (await response.json()) as any;
      const code = errorData?.code || errorData?.errorCode;
      const message =
        errorData?.error || errorData?.message || response.statusText;
      return code ? `${message} (${code})` : message;
    }

    const text = await response.text();
    if (text.includes("<html>")) {
      const match = text.match(/<title>(.*?)<\/title>/i);
      return match
        ? `Server Error: ${match[1]}`
        : "Server Error (HTML response)";
    }
    return text || response.statusText;
  } catch {
    return response.statusText;
  }
}

export function getFileUrl(filePath: string, invoiceId?: number): string {
  const filename = getPathFilename(filePath);
  const dossierId = getCurrentDossierId();
  return url(`/api/dynamic-invoices/files/${encodeURIComponent(filename)}`, {
    dossierId,
    invoiceId,
  });
}

export function getDynamicInvoicePdfUrl(
  filePath: string,
  invoiceId?: number,
): string {
  return getFileUrl(filePath, invoiceId);
}

export function getSalesInvoicePdfUrl(
  invoiceId: number,
  dossierId?: number,
): string {
  const resolvedDossierId = dossierId || getCurrentDossierId();
  return url(`/api/sales/invoices/${invoiceId}/download`, {
    dossierId: resolvedDossierId,
  });
}

function mapInvoice(raw: any): DynamicInvoiceDto {
  return {
    ...raw,
    status: raw?.status,
  } as DynamicInvoiceDto;
}

/** Maps the flat SalesInvoiceResponse from backend into a DynamicInvoiceDto-compatible shape. */
function mapSalesStatusToBackend(status: string | undefined): string {
  switch ((status || "").toUpperCase()) {
    case "VALIDATED":
      return "VALIDATED";
    case "ACCOUNTED":
      return "ACCOUNTED";
    case "EXTRACTED":
      return "READY_TO_VALIDATE";
    case "PROCESSING":
      return "PROCESSING";
    case "ERROR":
      return "ERROR";
    default:
      return "PENDING";
  }
}

function mapSalesInvoiceResponse(raw: any): DynamicInvoiceDto {
  // Sales backend mainly returns extracted values inside fieldsData.
  // Read those first, then keep flat-property fallbacks for older responses.
  const salesFieldKeys = [
    "clientName", "clientIce", "invoiceNumber", "invoiceDate",
    "totalHt", "totalTva", "totalTtc", "tvaRate", "isAvoir",
    "tierNumber", "displayAccount", "chargeAccount", "tvaAccount",
    "supplier", "ice", "ifNumber", "rcNumber", "amountHT", "tva", "amountTTC",
    "collectifAccount", "activity",
  ];
  const rawFieldsData =
    raw.fieldsData && typeof raw.fieldsData === "object" ? raw.fieldsData : {};
  const fieldsData: Record<string, any> = { ...rawFieldsData };
  for (const key of salesFieldKeys) {
    if (
      fieldsData[key] === undefined &&
      raw[key] !== undefined &&
      raw[key] !== null
    ) {
      fieldsData[key] = raw[key];
    }
  }

  // Compatibility aliases for shared UI components and sales defaults.
  fieldsData.clientName =
    fieldsData.clientName ?? fieldsData.supplier ?? raw.clientName ?? raw.tierName ?? "";
  fieldsData.clientIce =
    fieldsData.clientIce ?? fieldsData.ice ?? raw.clientIce ?? "";
  fieldsData.supplier =
    fieldsData.supplier ?? fieldsData.clientName ?? raw.tierName ?? raw.clientName ?? "";
  fieldsData.ice =
    fieldsData.ice ?? fieldsData.clientIce ?? raw.clientIce ?? "";
  fieldsData.totalHt = fieldsData.totalHt ?? fieldsData.amountHT ?? raw.totalHt;
  fieldsData.totalTva = fieldsData.totalTva ?? fieldsData.tva ?? raw.totalTva;
  fieldsData.totalTtc = fieldsData.totalTtc ?? fieldsData.amountTTC ?? raw.totalTtc;
  fieldsData.amountHT = fieldsData.amountHT ?? fieldsData.totalHt ?? raw.totalHt;
  fieldsData.tva = fieldsData.tva ?? fieldsData.totalTva ?? raw.totalTva;
  fieldsData.amountTTC = fieldsData.amountTTC ?? fieldsData.totalTtc ?? raw.totalTtc;
  fieldsData.tvaRate = fieldsData.tvaRate ?? raw.tvaRate;

  return {
    id: raw.id,
    filename: raw.filename || "",
    originalName: raw.filename,
    filePath: raw.filePath || "",
    fileSize: raw.fileSize || 0,
    dossierId: raw.dossierId,
    fieldsData,
    status: mapSalesStatusToBackend(raw.status) as any,
    missingFields: raw.missingFields || [],
    lowConfidenceFields: raw.lowConfidenceFields || [],
    overallConfidence: raw.ocrConfidence,
    averageConfidence: raw.ocrConfidence,
    isAvoir: raw.isAvoir,
    accounted: raw.accounted,
    accountedAt: raw.accountedAt,
    accountedBy: raw.accountedBy,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt,
    validatedAt: raw.validatedAt,
    validatedBy: raw.validatedBy,
    canValidate: raw.status === "EXTRACTED",
    canCreateTemplate: false,
    templateDetected: false,
  } as DynamicInvoiceDto;
}

function unwrapApiData<T = any>(payload: any): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    ("success" in payload || "timestamp" in payload)
  ) {
    return payload.data as T;
  }
  return payload as T;
}

function mapBankStatus(
  status: string | undefined,
): LocalBankStatement["status"] {
  const s = String(status || "").toUpperCase();
  if (s === "COMPTABILISE" || s === "COMPTABILISÉ") return "COMPTABILISE";
  if (s === "READY_TO_VALIDATE" || s === "PRET_A_VALIDER") return "READY_TO_VALIDATE";
  if (s.includes("VALID")) return "VALIDATED";
  if (s.includes("PENDING") || s.includes("ATTENTE")) return "PENDING";
  if (s.includes("PROCESS") || s.includes("COURS")) return "PROCESSING";
  if (
    s.includes("ERROR") ||
    s.includes("ERREUR") ||
    s.includes("DUPLIQUE") ||
    s.includes("VIDE")
  )
    return s.includes("DUPLIQUE") ? "DUPLIQUE" : s.includes("VIDE") ? "VIDE" : "ERROR";
  return "TREATED";
}

function mapBankStatement(raw: any): LocalBankStatement {
  const transactions = Array.isArray(raw?.transactions) ? raw.transactions : [];
  const firstTx = transactions[0] || {};
  const fields = [
    {
      key: "dateOperation",
      label: "Date Opération",
      value: firstTx.dateOperation || firstTx.date || "",
      type: "date" as const,
    },
    {
      key: "dateValeur",
      label: "Date Valeur",
      value: firstTx.dateValeur || "",
      type: "date" as const,
    },
    {
      key: "libelle",
      label: "Libellé",
      value: firstTx.libelle || firstTx.description || "",
      type: "text" as const,
    },
    {
      key: "debit",
      label: "Débit",
      value: firstTx.debit ?? "",
      type: "number" as const,
    },
    {
      key: "credit",
      label: "Crédit",
      value: firstTx.credit ?? "",
      type: "number" as const,
    },
    { key: "rib", label: "RIB", value: raw?.rib || "", type: "text" as const },
    {
      key: "bankName",
      label: "Banque",
      value: raw?.bankName || "",
      type: "text" as const,
    },
  ];

  const filename =
    raw?.filename || raw?.originalName || `statement-${raw?.id || "unknown"}`;

  return {
    ...(raw || {}),
    id: Number(raw?.id),
    filename,
    originalName: raw?.originalName || filename,
    filePath: raw?.filePath || filename,
    fileSize: Number(raw?.fileSize || 0),
    displayStatus: String(raw?.status || raw?.statusCode || "").toUpperCase(),
    fileUrl: url(
      `/api/v2/bank-statements/files/${encodeURIComponent(filename)}`,
    ),
    fields,
    status: mapBankStatus(raw?.statusCode || raw?.status),
    createdAt: new Date(raw?.createdAt || Date.now()),
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : undefined,
    metadata: raw?.metadata,
    insertedEntries:
      raw?.insertedEntries != null ? Number(raw.insertedEntries) : undefined,
    syncedRows: raw?.syncedRows != null ? Number(raw.syncedRows) : undefined,
    simulationId: raw?.simulationId ?? null,
    verificationStatus: raw?.verificationStatus ?? null,
    duplicateOfId:
      raw?.duplicateOfId != null ? Number(raw.duplicateOfId) : null,
    isDuplicate: Boolean(raw?.isDuplicate || raw?.duplicateOfId || raw?.alertType === "danger"),
  } as LocalBankStatement;
}

export async function uploadDynamicInvoice(
  file: File,
  dossierId?: number,
  engine?: "ALPHA_AGENT" | "DEFAULT",
): Promise<DynamicInvoiceDto> {
  const formData = new FormData();
  formData.append("file", file);
  const resolvedDossierId = dossierId || getCurrentDossierId();
  if (resolvedDossierId) {
    formData.append("dossierId", String(resolvedDossierId));
  }
  if (engine && engine !== "DEFAULT") {
    formData.append("engine", engine);
    formData.append("ocrMode", "EVOLEO_AI");
    formData.append("useAlphaAgent", "true");
  }
  const result = await request<any>("/api/dynamic-invoices/upload", {
    method: "POST",
    body: formData,
  });
  return mapInvoice(result);
}

export async function uploadDynamicInvoicesBatch(
  files: File[],
  dossierId?: number,
  engine?: "ALPHA_AGENT" | "DEFAULT",
): Promise<DynamicInvoiceUploadBatchResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const resolvedDossierId = dossierId || getCurrentDossierId();
  if (resolvedDossierId) {
    formData.append("dossierId", String(resolvedDossierId));
  }
  if (engine && engine !== "DEFAULT") {
    formData.append("engine", engine);
    formData.append("ocrMode", "EVOLEO_AI");
    formData.append("useAlphaAgent", "true");
  }

  const result = await request<any>("/api/dynamic-invoices/upload/batch", {
    method: "POST",
    body: formData,
  });

  const mappedResults: DynamicInvoiceUploadBatchItem[] = Array.isArray(result?.results)
    ? result.results.map((item: any) => ({
        filename: String(item?.filename || "unknown"),
        status: item?.status === "success" ? "success" : "error",
        invoice: item?.invoice ? mapInvoice(item.invoice) : undefined,
        error: item?.error ? String(item.error) : undefined,
        httpStatus:
          item?.httpStatus != null ? Number(item.httpStatus) : undefined,
      }))
    : [];

  return {
    count: Number(result?.count || mappedResults.length),
    successCount: Number(result?.successCount || 0),
    errorCount: Number(result?.errorCount || 0),
    results: mappedResults,
  };
}

export async function processDynamicInvoice(
  id: number,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(
    `/api/dynamic-invoices/${id}/process`,
    { method: "POST" },
    { dossierId },
  );
  return mapInvoice(result);
}

export async function getDynamicInvoiceById(
  id: number,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/dynamic-invoices/${id}`, undefined, {
    dossierId,
  });
  return mapInvoice(result);
}

export async function validateDynamicInvoice(
  id: number,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(
    `/api/dynamic-invoices/${id}/validate`,
    { method: "POST" },
    { dossierId },
  );
  return mapInvoice(result?.invoice || result);
}

export async function updateDynamicInvoiceFields(
  id: number,
  fields: Record<string, any>,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(
    `/api/dynamic-invoices/${id}/fields`,
    {
      method: "PUT",
      body: JSON.stringify(fields),
    },
    { dossierId },
  );
  return mapInvoice(result);
}

export async function extractDynamicInvoiceField(
  id: number,
  fieldName: string,
): Promise<{
  success: boolean;
  invoiceId: number;
  fieldName: string;
  result: {
    value: any;
    confidence?: number;
    detectionMethod?: string;
    validated?: boolean;
    validationError?: string;
  };
}> {
  const dossierId = getCurrentDossierId();
  return request<{
    success: boolean;
    invoiceId: number;
    fieldName: string;
    result: {
      value: any;
      confidence?: number;
      detectionMethod?: string;
      validated?: boolean;
      validationError?: string;
    };
  }>(
    `/api/dynamic-invoices/${id}/extract-field`,
    {
      method: "POST",
      body: JSON.stringify({ fieldName }),
    },
    { dossierId },
  );
}

export async function checkDynamicInvoiceDuplicate(params: {
  supplier: string;
  invoiceNumber?: string;
  filename?: string;
}): Promise<{ exists: boolean; matchedBy?: "invoiceNumber" | "filename" }> {
  const dossierId = getCurrentDossierId();
  const payload = await request<{
    success: boolean;
    data?: { exists?: boolean; matchedBy?: "invoiceNumber" | "filename" };
  }>("/api/dynamic-invoices/check-duplicate", undefined, {
    dossierId,
    supplier: params.supplier,
    invoiceNumber: params.invoiceNumber,
    filename: params.filename,
  });
  return {
    exists: Boolean(payload?.data?.exists),
    matchedBy: payload?.data?.matchedBy,
  };
}

export async function getAllDynamicInvoices(
  status?: string,
  templateId?: number,
  limit: number = 50,
  dossierIdArg?: number,
): Promise<DynamicInvoiceDto[]> {
  const dossierId = dossierIdArg || getCurrentDossierId();
  const result = await request<{ invoices?: any[] }>(
    "/api/dynamic-invoices",
    undefined,
    {
      status,
      templateId,
      limit,
      dossierId,
    },
  );
  return (result?.invoices || []).map(mapInvoice);
}

/**
 * Get invoice list for navigation (lightweight, IDs only or minimal data)
 * Note: This is a lightweight version that doesn't map full invoice objects
 */
export async function getDynamicInvoicesForNavigation(
  options?: {
    dossierId?: number;
    status?: string[];
    type?: 'achat' | 'vente';
  }
): Promise<{ id: number; invoiceNumber?: string }[]> {
  try {
    const dossierId = options?.dossierId || getCurrentDossierId();

    const result = await request<{ invoices?: any[] }>(
      "/api/dynamic-invoices",
      undefined,
      {
        dossierId,
        limit: 1000, // High limit for navigation
      },
    );

    if (!result?.invoices) {
      return [];
    }

    return result.invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.fieldsData?.invoiceNumber || inv.invoiceNumber,
    }));
  } catch (error) {
    // Silent fail - navigation buttons will just be hidden
    console.warn("Navigation: Unable to load invoice list. Navigation buttons will be disabled.");
    return [];
  }
}

export async function deleteDynamicInvoice(id: number): Promise<void> {
  const dossierId = getCurrentDossierId();
  await request<void>(
    `/api/dynamic-invoices/${id}`,
    { method: "DELETE" },
    { dossierId },
  );
}

export async function updateInvoiceStatus(
  id: number | string,
  status: string,
): Promise<any> {
  const normalized = normalizeInvoiceStatus(status);
  const dossierId = getCurrentDossierId();

  if (normalized === "READY_TO_TREAT") {
    return request<any>(
      `/api/dynamic-invoices/${id}/client-validate`,
      { method: "POST" },
      { dossierId },
    );
  }

  throw new Error(
    "Backend does not expose generic status update for this workflow state",
  );
}

export async function clientValidateInvoice(id: number): Promise<any> {
  const dossierId = getCurrentDossierId();
  return request<any>(
    `/api/dynamic-invoices/${id}/client-validate`,
    { method: "POST" },
    { dossierId },
  );
}

export async function bulkDeleteInvoices(ids: number[]): Promise<any> {
  const dossierId = getCurrentDossierId();
  return request<any>(
    "/api/dynamic-invoices/bulk/delete",
    {
      method: "POST",
      body: JSON.stringify({ ids }),
    },
    { dossierId },
  );
}

export async function getDynamicInvoiceStats(): Promise<any> {
  const dossierId = getCurrentDossierId();
  return request<any>("/api/dynamic-invoices/stats", undefined, { dossierId });
}

export async function processDynamicInvoicesBulk(
  invoiceIds: number[],
): Promise<DynamicInvoiceBulkResponse> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(
    "/api/dynamic-invoices/bulk/process",
    {
      method: "POST",
      body: JSON.stringify({ ids: invoiceIds }),
    },
    { dossierId },
  );

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
  };
}

export async function reprocessDynamicInvoicesBulk(
  invoiceIds: number[],
): Promise<DynamicInvoiceBulkResponse> {
  return processDynamicInvoicesBulk(invoiceIds);
}

export async function getDynamicAvailableSignatures(id: number): Promise<any> {
  const dossierId = getCurrentDossierId();
  return request<any>(
    `/api/dynamic-invoices/${id}/available-signatures`,
    undefined,
    { dossierId },
  );
}

export async function linkTierToDynamicInvoice(
  invoiceId: number,
  tierId: number,
): Promise<{ success: boolean; message: string; invoice: DynamicInvoiceDto }> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(
    `/api/dynamic-invoices/${invoiceId}/link-tier`,
    {
      method: "POST",
      body: JSON.stringify({ tierId }),
    },
    { dossierId },
  );

  return {
    success: Boolean(result?.success),
    message: result?.message || "Tier linked",
    invoice: mapInvoice(result?.invoice || {}),
  };
}

export async function linkTierToSalesInvoice(
  invoiceId: number,
  tierId: number,
): Promise<{ success: boolean; message: string; invoice: DynamicInvoiceDto }> {
  const dossierId = getCurrentDossierId();
  const result = unwrapApiData<any>(
    await request<any>(
      `/api/sales/invoices/${invoiceId}/link-tier`,
      {
        method: "POST",
        body: JSON.stringify({ tierId }),
      },
      { dossierId },
    ),
  );

  return {
    success: Boolean(result?.success),
    message: result?.message || "Tier linked",
    invoice: mapSalesInvoiceResponse(result?.invoice || result),
  };
}

export async function getAllTemplates(): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>("/api/dynamic-templates");
}

export async function getTemplateById(id: number): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>(`/api/dynamic-templates/${id}`);
}

export async function createDynamicTemplate(
  requestPayload: CreateDynamicTemplateRequest,
): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>("/api/dynamic-templates", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  });
}

export async function updateTemplate(
  id: number,
  requestPayload: CreateDynamicTemplateRequest,
): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>(`/api/dynamic-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(requestPayload),
  });
}

export async function patchTemplate(
  id: number,
  requestPayload: UpdateDynamicTemplateRequest,
): Promise<DynamicTemplateDto> {
  return request<DynamicTemplateDto>(`/api/dynamic-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(requestPayload),
  });
}

export async function deactivateTemplate(id: number): Promise<void> {
  await request<void>(`/api/dynamic-templates/${id}`, { method: "DELETE" });
}

export async function searchTemplates(
  name: string,
): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>(
    "/api/dynamic-templates/search",
    undefined,
    { name },
  );
}

export async function getTemplatesBySupplierType(
  supplierType: string,
): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>(
    `/api/dynamic-templates/by-supplier-type/${encodeURIComponent(supplierType)}`,
  );
}

export async function getReliableTemplates(): Promise<DynamicTemplateDto[]> {
  return request<DynamicTemplateDto[]>("/api/dynamic-templates/reliable");
}

export async function getTemplatesBySupplier(supplier: string): Promise<any> {
  return request<any>("/api/dynamic-templates/by-supplier", undefined, {
    supplier,
  });
}

export async function extractWithTemplate(
  invoiceId: number,
  templateId?: number,
): Promise<DynamicExtractionResponse> {
  const dossierId = getCurrentDossierId();
  return request<DynamicExtractionResponse>(
    `/api/dynamic-templates/extract/${invoiceId}`,
    {
      method: "POST",
    },
    {
      templateId,
      dossierId,
    },
  );
}

export async function extractFromFile(
  file: File,
  templateId?: number,
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  if (templateId) formData.append("templateId", String(templateId));
  return request<any>("/api/dynamic-templates/extract-file", {
    method: "POST",
    body: formData,
  });
}

export async function testTemplate(
  templateId: number,
  ocrText: string,
): Promise<any> {
  return request<any>(`/api/dynamic-templates/${templateId}/test`, {
    method: "POST",
    body: JSON.stringify({ ocrText }),
  });
}

export async function detectTemplate(ocrText: string): Promise<any> {
  return request<any>("/api/dynamic-templates/detect", {
    method: "POST",
    body: JSON.stringify({ ocrText }),
  });
}

export async function getAccounts(
  activeOnly: boolean = true,
): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>(
    "/api/v2/accounting/accounts",
    undefined,
    { activeOnly },
  );
  return result?.accounts || [];
}

export async function getAccountOptions(): Promise<Account[]> {
  try {
    const result = await request<{ accounts?: Array<{ code: string; libelle: string }> }>(
      "/api/v2/accounting/accounts/options",
    );
    return (result?.accounts || []).map((account, index) => ({
      id: index + 1,
      code: account.code,
      libelle: account.libelle,
      classe: Number(account.code?.charAt(0) || 0),
      active: true,
    }));
  } catch {
    return getAccounts(true);
  }
}

export async function getAccountById(id: number): Promise<Account> {
  const result = await request<{ account: Account }>(
    `/api/v2/accounting/accounts/${id}`,
  );
  return result.account;
}

export async function getAccountByCode(code: string): Promise<Account | null> {
  const result = await request<{ account?: Account }>(
    `/api/v2/accounting/accounts/by-code/${encodeURIComponent(code)}`,
  );
  return result?.account || null;
}

export async function searchAccounts(query: string): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>(
    "/api/v2/accounting/accounts/search",
    undefined,
    { query },
  );
  return result?.accounts || [];
}

export async function getAccountsByClasse(classe: number): Promise<Account[]> {
  const result = await request<{ accounts?: Account[] }>(
    `/api/v2/accounting/accounts/by-classe/${classe}`,
  );
  return result?.accounts || [];
}

export async function getChargeAccounts(): Promise<Account[]> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ accounts?: Account[] }>(
    "/api/v2/accounting/accounts/charges",
    undefined,
    { dossierId },
  );
  return result?.accounts || [];
}

export async function getTvaAccounts(): Promise<Account[]> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ accounts?: Account[] }>(
    "/api/v2/accounting/accounts/tva",
    undefined,
    { dossierId },
  );
  return result?.accounts || [];
}

export async function getFournisseurAccounts(): Promise<Account[]> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ accounts?: Account[] }>(
    "/api/v2/accounting/accounts/fournisseurs",
    undefined,
    { dossierId },
  );
  return result?.accounts || [];
}

export async function createAccount(
  requestPayload: CreateAccountRequest,
): Promise<Account> {
  const result = await request<{ account: Account }>(
    "/api/accounting/accounts",
    {
      method: "POST",
      body: JSON.stringify(requestPayload),
    },
  );
  return result.account;
}

export async function updateAccount(
  id: number,
  requestPayload: UpdateAccountRequest,
): Promise<Account> {
  const result = await request<{ account: Account }>(
    `/api/accounting/accounts/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(requestPayload),
    },
  );
  return result.account;
}

export async function deactivateAccount(id: number): Promise<void> {
  await request<void>(`/api/accounting/accounts/${id}`, { method: "DELETE" });
}

export async function activateAccount(id: number): Promise<void> {
  await request<void>(`/api/accounting/accounts/${id}/activate`, {
    method: "PATCH",
  });
}

export async function importAccounts(
  requests: CreateAccountRequest[],
): Promise<any> {
  return request<any>("/api/accounting/accounts/import", {
    method: "POST",
    body: JSON.stringify(requests),
  });
}

export async function getAllTiers(activeOnly: boolean = true): Promise<Tier[]> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ tiers?: Tier[] }>(
    "/api/accounting/tiers",
    undefined,
    { activeOnly, dossierId },
  );
  return result?.tiers || [];
}

export async function getTierById(id: number): Promise<Tier> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ tier: Tier }>(
    `/api/accounting/tiers/${id}`,
    undefined,
    { dossierId },
  );
  return result.tier;
}

export async function getTierByTierNumber(
  tierNumber: string,
): Promise<Tier | null> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ tier?: Tier }>(
    `/api/accounting/tiers/by-tier-number/${encodeURIComponent(tierNumber)}`,
    undefined,
    { dossierId },
  );
  return result?.tier || null;
}

export async function getTierByIce(
  ice: string,
  dossierId?: number,
): Promise<Tier | null> {
  try {
    const resolvedDossierId = dossierId || getCurrentDossierId();
    const normalizedIce = ice?.trim().replace(/\s+/g, "");
    const result = await request<{ tier?: Tier }>(
      `/api/accounting/tiers/by-ice/${encodeURIComponent(normalizedIce)}`,
      undefined,
      { dossierId: resolvedDossierId },
    );
    return result?.tier || null;
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export async function getTierByIfNumber(
  ifNumber: string,
  dossierId?: number,
): Promise<Tier | null> {
  try {
    const resolvedDossierId = dossierId || getCurrentDossierId();
    const result = await request<{ tier?: Tier }>(
      `/api/accounting/tiers/by-if/${encodeURIComponent(ifNumber)}`,
      undefined,
      { dossierId: resolvedDossierId },
    );
    return result?.tier || null;
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export async function searchTiers(query: string): Promise<Tier[]> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ tiers?: Tier[] }>(
    "/api/accounting/tiers/search",
    undefined,
    { query, dossierId },
  );
  return result?.tiers || [];
}

export async function createTier(
  requestPayload: CreateTierRequest,
): Promise<Tier> {
  const dossierId = getCurrentDossierId();
  const payload = normalizeTierPayload(requestPayload);
  const result = unwrapApiData<any>(
    await request<any>(
      "/api/accounting/tiers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      { dossierId },
    ),
  );
  return result?.tier || result;
}

export async function updateTier(
  id: number,
  requestPayload: UpdateTierRequest,
): Promise<Tier> {
  const dossierId = getCurrentDossierId();
  const payload = normalizeTierPayload(requestPayload);
  const result = unwrapApiData<any>(
    await request<any>(
      `/api/accounting/tiers/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
      { dossierId },
    ),
  );
  return result?.tier || result;
}

export async function deactivateTier(id: number): Promise<void> {
  const dossierId = getCurrentDossierId();
  await request<void>(
    `/api/accounting/tiers/${id}`,
    { method: "DELETE" },
    { dossierId },
  );
}

export async function activateTier(id: number): Promise<void> {
  const dossierId = getCurrentDossierId();
  await request<void>(
    `/api/accounting/tiers/${id}/activate`,
    { method: "PATCH" },
    { dossierId },
  );
}

export async function getAccountingConfigs(): Promise<AccountingConfigDto[]> {
  const result = await request<any>("/api/v2/accounting-configs");
  return result?.configs || result || [];
}

export async function createAccountingConfig(
  requestPayload: UpsertAccountingConfigRequest,
): Promise<AccountingConfigDto> {
  return request<AccountingConfigDto>("/api/v2/accounting-configs", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  });
}

export async function updateAccountingConfig(
  id: number,
  requestPayload: UpsertAccountingConfigRequest,
): Promise<AccountingConfigDto> {
  return request<AccountingConfigDto>(`/api/v2/accounting-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(requestPayload),
  });
}

export async function deleteAccountingConfig(id: number): Promise<void> {
  await request<void>(`/api/v2/accounting-configs/${id}`, {
    method: "DELETE",
  });
}

export async function getAccountingConfigBanks(): Promise<string[]> {
  const result = await request<any>("/api/v2/accounting-configs/banks");
  return result?.banks || [];
}

export async function getGeneralParams(): Promise<DossierGeneralParamsDto> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ params?: DossierGeneralParamsDto }>(
    "/api/settings/general-params",
    undefined,
    { dossierId },
  );
  return result?.params || {};
}

export async function saveGeneralParams(
  requestPayload: DossierGeneralParamsDto,
): Promise<DossierGeneralParamsDto> {
  const dossierId = getCurrentDossierId();
  const result = await request<{ params?: DossierGeneralParamsDto }>(
    "/api/settings/general-params",
    {
      method: "PUT",
      body: JSON.stringify(requestPayload),
    },
    { dossierId },
  );
  return result?.params || {};
}

// Journal comptable
export async function getAccountingEntries(): Promise<AccountingEntry[]> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(
    "/api/accounting/journal/entries",
    undefined,
    { dossierId },
  );
  if (Array.isArray(result)) return result as AccountingEntry[];
  if (Array.isArray(result?.entries))
    return result.entries as AccountingEntry[];
  return [];
}

export async function rebuildAccountingEntries(
  invoiceId: number,
): Promise<{ message: string; entries: AccountingEntry[] }> {
  const dossierId = getCurrentDossierId();
  return request<{ message: string; entries: AccountingEntry[] }>(
    `/api/accounting/journal/entries/rebuild/${invoiceId}`,
    { method: "POST" },
    { dossierId },
  );
}

export async function accountInvoiceEntries(
  invoiceId: number,
): Promise<{ message: string; entries: AccountingEntry[] }> {
  const dossierId = getCurrentDossierId();
  return request<{ message: string; entries: AccountingEntry[] }>(
    `/api/accounting/journal/entries/from-invoice/${invoiceId}`,
    { method: "POST" },
    { dossierId },
  );
}

export async function uploadBankStatement(
  file: File,
  bankType?: string,
  allowedBanks?: string[],
): Promise<LocalBankStatement> {
  if (!(file instanceof File)) {
    throw new Error("Upload invalide: aucun fichier bancaire valide n'a été transmis.");
  }
  const formData = new FormData();
  formData.append("file", file);
  const dossierId = getCurrentDossierId();
  if (dossierId) {
    formData.append("dossierId", String(dossierId));
  }
  if (bankType && bankType !== "AUTO") {
    formData.append("bankType", bankType);
  }
  if (allowedBanks && allowedBanks.length > 0) {
    allowedBanks.forEach((bank) => formData.append("allowedBanks", bank));
  }
  const result = await request<any>("/api/v2/bank-statements/upload", {
    method: "POST",
    body: formData,
  });
  return mapBankStatement(result);
}

type BankStatementsQuery = {
  status?: string;
  limit?: number;
  dossierId?: number;
};

export async function getAllBankStatements(
  statusOrQuery?: string | BankStatementsQuery,
  limitArg: number = 50,
): Promise<LocalBankStatement[]> {
  const status =
    typeof statusOrQuery === "string" ? statusOrQuery : statusOrQuery?.status;
  const limit =
    typeof statusOrQuery === "object" ? (statusOrQuery?.limit ?? 50) : limitArg;
  const dossierId =
    typeof statusOrQuery === "object"
      ? (statusOrQuery?.dossierId || getCurrentDossierId())
      : getCurrentDossierId();
  const result = await request<{ statements?: any[] }>(
    "/api/v2/bank-statements",
    undefined,
    { status, limit, dossierId },
  );
  return (result?.statements || []).map(mapBankStatement);
}

export async function getBankStatementById(
  id: number,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}`, undefined, { dossierId });
  return mapBankStatement(result);
}

export async function processBankStatement(
  id: number,
  allowedBanks?: string[],
  bankType?: string,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const query =
    allowedBanks && allowedBanks.length > 0
      ? { allowedBanks: allowedBanks.join(","), dossierId, ...(bankType && bankType !== "AUTO" ? { bankType } : {}) }
      : { dossierId, ...(bankType && bankType !== "AUTO" ? { bankType } : {}) };

  await request<any>(
    `/api/v2/bank-statements/${id}/process`,
    { method: "POST" },
    query,
  );
  const refreshed = await request<any>(`/api/v2/bank-statements/${id}`, undefined, { dossierId });
  return mapBankStatement(refreshed);
}

export async function validateBankStatement(
  id: number,
  _fields?: any,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}/validate`, {
    method: "POST",
  }, { dossierId });
  return mapBankStatement(result?.statement || result);
}

export async function clientValidateBankStatement(
  id: number,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}/client-validate`, {
    method: "POST",
  }, { dossierId });
  return mapBankStatement(result?.statement || result);
}

export async function updateBankStatementStatus(
  id: number,
  status: string,
  updatedBy?: string,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, updatedBy }),
  }, { dossierId });
  const statement = mapBankStatement(result?.statement || result);
  if (result && typeof result === "object") {
    statement.insertedEntries =
      result?.insertedEntries != null ? Number(result.insertedEntries) : undefined;
    statement.syncedRows =
      result?.syncedRows != null ? Number(result.syncedRows) : undefined;
    statement.simulationId = result?.simulationId ?? null;
    statement.metadata = {
      ...(statement.metadata || {}),
      message: result?.message,
    };
  }
  return statement;
}

export async function updateBankStatementTtcRule(
  id: number,
  applyTtcRule: boolean,
  reprocess: boolean = true,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}/ttc-rule`, {
    method: "PUT",
    body: JSON.stringify({ enabled: applyTtcRule, applyTtcRule, reprocess }),
  }, { dossierId });
  return mapBankStatement(result?.statement || result);
}

export async function updateBankStatementFraisRule(
  id: number,
  applyFraisRule: boolean,
  reprocess: boolean = true,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}/frais-rule`, {
    method: "PUT",
    body: JSON.stringify({ enabled: applyFraisRule, applyFraisRule, reprocess }),
  }, { dossierId });
  return mapBankStatement(result?.statement || result);
}

export async function updateBankStatementAgiosRule(
  id: number,
  applyAgiosRule: boolean,
  reprocess: boolean = true,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}/agios-rule`, {
    method: "PUT",
    body: JSON.stringify({ enabled: applyAgiosRule, applyAgiosRule, reprocess }),
  }, { dossierId });
  return mapBankStatement(result?.statement || result);
}

export async function updateBankStatementPackageRule(
  id: number,
  applyPackageRule: boolean,
  reprocess: boolean = true,
): Promise<LocalBankStatement> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(`/api/v2/bank-statements/${id}/package-rule`, {
    method: "PUT",
    body: JSON.stringify({ enabled: applyPackageRule, applyPackageRule, reprocess }),
  }, { dossierId });
  return mapBankStatement(result?.statement || result);
}

export async function deleteBankStatement(id: number): Promise<void> {
  const dossierId = getCurrentDossierId();
  await request<void>(`/api/v2/bank-statements/${id}`, { method: "DELETE" }, { dossierId });
}

export async function deleteAllBankStatements(): Promise<void> {
  await request<void>("/api/v2/bank-statements/all", { method: "DELETE" });
}

export async function getBankStatementStats(): Promise<any> {
  return request<any>("/api/v2/bank-statements/stats", undefined, {
    _t: Date.now(),
  });
}

export async function retryFailedBankStatementPages(
  id: number,
  allowedBanks?: string[],
  bankType?: string,
): Promise<any> {
  const dossierId = getCurrentDossierId();
  const query =
    allowedBanks && allowedBanks.length > 0
      ? {
          allowedBanks: allowedBanks.join(","),
          dossierId,
          ...(bankType && bankType !== "AUTO" ? { bankType } : {}),
        }
      : { dossierId, ...(bankType && bankType !== "AUTO" ? { bankType } : {}) };

  return request<any>(
    `/api/v2/bank-statements/${id}/retry-failed`,
    {
      method: "POST",
    },
    query,
  );
}

export async function getBankOptions(): Promise<{
  count: number;
  options: any[];
}> {
  const result = await request<any>("/api/v2/bank-statements/bank-options");
  return {
    count: Number(result?.count || 0),
    options: Array.isArray(result?.options) ? result.options : [],
  };
}

export async function getTransactionsByStatementId(
  statementId: number,
): Promise<BankTransactionV2[]> {
  const dossierId = getCurrentDossierId();
  const result = await request<any>(
    `/api/v2/bank-transactions/statement/${statementId}`,
    undefined,
    { dossierId },
  );
  if (Array.isArray(result)) return result as BankTransactionV2[];
  return (result?.transactions || result || []) as BankTransactionV2[];
}

export async function updateBankTransaction(
  id: number,
  updates: Partial<BankTransactionV2>,
): Promise<BankTransactionV2> {
  const result = await request<any>(`/api/v2/bank-transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return (result?.transaction || result) as BankTransactionV2;
}

export async function createBankTransaction(payload: {
  statementId: number;
  transactionIndex?: number | undefined;
  dateOperation: string;
  dateValeur?: string | undefined;
  libelle: string;
  compte?: string | undefined;
  categorie?: string | undefined;
  sens?: "DEBIT" | "CREDIT" | undefined;
  debit?: number | undefined;
  credit?: number | undefined;
  isLinked?: boolean | undefined;
  cmApplied?: boolean | undefined;
}): Promise<BankTransactionV2> {
  const result = await request<any>("/api/v2/bank-transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return (result?.transaction || result) as BankTransactionV2;
}

export async function simulateComptabilisation(statementId: number): Promise<any> {
  const dossierId = getCurrentDossierId();
  return request<any>(
    `/api/v2/bank-statements/${statementId}/accounting/simulate`,
    {
      method: "POST",
    },
    { dossierId },
  );
}

export async function confirmComptabilisation(simulationId: string): Promise<any> {
  const dossierId = getCurrentDossierId();
  return request<any>(
    "/api/v2/bank-statements/accounting/confirm",
    {
      method: "POST",
      body: JSON.stringify({ simulationId }),
    },
    { dossierId },
  );
}

// ============================================
// AUTH / UTILISATEURS
// ============================================

export async function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me");
}

export async function getClientDashboard(dossierId?: number): Promise<any> {
  const resolvedDossierId = dossierId || getCurrentDossierId();
  return request<any>("/api/client/dashboard", undefined, { dossierId: resolvedDossierId });
}

export async function listUsers(): Promise<AuthUser[]> {
  return request<AuthUser[]>("/api/auth/users");
}

export async function createUser(
  requestPayload: CreateUserRequest,
): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  });
}

export async function deactivateUser(id: number): Promise<void> {
  await request<void>(`/api/auth/users/${id}`, { method: "DELETE" });
}

export async function updateUserRole(
  id: number,
  role: UserRole,
): Promise<AuthUser> {
  return request<AuthUser>(`/api/auth/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateUserActive(
  id: number,
  active: boolean,
): Promise<AuthUser> {
  return request<AuthUser>(`/api/auth/users/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function getDossiers(): Promise<BackendDossierDto[]> {
  const dossiers = await request<any[]>("/api/dossiers");
  return (dossiers || []).map((d) => ({
    id: d.id,
    name: d.name,
    ice: d.ice,
    status: d.active ? "ACTIVE" : "INACTIVE",
    comptableId: d.comptableId,
    fournisseurId: d.clientId,
    fournisseurEmail: d.fournisseurEmail ?? d.clientUsername,
    comptableEmail: d.comptableEmail ?? d.comptableUsername,
    createdAt: d.createdAt,
    exerciseStartDate: d.exerciseStartDate,
    exerciseEndDate: d.exerciseEndDate,
    invoicesCount: d.invoicesCount || 0,
    bankStatementsCount: d.bankStatementsCount || 0,
    centreMonetiqueCount: d.centreMonetiqueCount || 0,
    pendingInvoicesCount: d.pendingInvoicesCount || 0,
    validatedInvoicesCount: d.validatedInvoicesCount || 0,
  }));
}

export async function createDossier(payload: {
  nom: string;
  fournisseurEmail: string;
  comptableId?: number;
  password?: string;
  exerciseStartDate?: string;
  exerciseEndDate?: string;
}): Promise<any> {
  const username = payload.fournisseurEmail.trim();
  const displayName = username.split("@")[0] || username;
  const createPayload = {
    dossierName: payload.nom,
    clientUsername: username,
    clientPassword: payload.password,
    clientDisplayName: displayName,
    exerciseStartDate: payload.exerciseStartDate,
    exerciseEndDate: payload.exerciseEndDate,
    ...(payload.comptableId ? { comptableId: payload.comptableId } : {}),
  };

  const mapResult = (result: any) => ({
    success: true,
    dossier: {
      id: result?.id,
      name: result?.name || payload.nom,
      fournisseurEmail: username,
      comptableId: result?.comptableId,
      fournisseurId: result?.clientId,
    },
  });

  try {
    const result = await request<any>("/api/dossiers", {
      method: "POST",
      body: JSON.stringify(createPayload),
    });
    return mapResult(result);
  } catch (error: any) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("client_invalid")) {
      throw error;
    }

    let users: any[] = [];
    try {
      users = await request<any[]>("/api/auth/users");
    } catch {
      throw error;
    }

    const existingClient = (users || []).find((u) => {
      const sameUsername =
        String(u?.username || "").toLowerCase() === username.toLowerCase();
      const isClient = String(u?.role || "").toUpperCase() === "CLIENT";
      return sameUsername && isClient;
    });

    if (!existingClient?.id) {
      throw error;
    }

    const retryResult = await request<any>("/api/dossiers", {
      method: "POST",
      body: JSON.stringify({
        dossierName: payload.nom,
        clientId: existingClient.id,
        exerciseStartDate: payload.exerciseStartDate,
        exerciseEndDate: payload.exerciseEndDate,
        ...(payload.comptableId ? { comptableId: payload.comptableId } : {}),
      }),
    });
    return mapResult(retryResult);
  }
}

export async function deleteDossier(id: number): Promise<void> {
  await request<void>(`/api/dossiers/${id}`, { method: "DELETE" });
}

export async function changeDossierComptable(dossierId: number, comptableId: number): Promise<void> {
  await request<void>(`/api/dossiers/${dossierId}/comptable`, {
    method: "PATCH",
    body: JSON.stringify({ comptableId }),
  });
}

export async function getAllPatterns(): Promise<DetectedFieldPattern[]> {
  const data = await request<any[]>("/api/field-patterns");
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
  }));
}

export async function getPatternStatistics(): Promise<PatternStatistics> {
  const patterns = await getAllPatterns();
  const totalPatterns = patterns.length;
  const pendingPatterns = patterns.filter((p) => p.status === "PENDING").length;
  const approvedPatterns = patterns.filter(
    (p) => p.status === "APPROVED",
  ).length;
  const rejectedPatterns = patterns.filter(
    (p) => p.status === "REJECTED",
  ).length;
  const approvalRate =
    totalPatterns > 0 ? (approvedPatterns / totalPatterns) * 100 : 0;
  const patternsByField: Record<string, number> = {};

  for (const pattern of patterns) {
    patternsByField[pattern.fieldName] =
      (patternsByField[pattern.fieldName] || 0) + 1;
  }

  return {
    totalPatterns,
    pendingPatterns,
    approvedPatterns,
    rejectedPatterns,
    approvalRate,
    patternsByField,
  };
}

export async function approvePattern(patternId: number): Promise<void> {
  patternStatusOverrides.set(patternId, "APPROVED");
}

export async function rejectPattern(patternId: number): Promise<void> {
  patternStatusOverrides.set(patternId, "REJECTED");
}

// ============================================
// SALES (VENTE) INVOICE FUNCTIONS
// ============================================

export async function uploadSalesInvoice(
  file: File,
  dossierId?: number,
  engine?: "ALPHA_AGENT" | "DEFAULT",
): Promise<DynamicInvoiceDto> {
  const formData = new FormData();
  formData.append("file", file);
  const resolvedDossierId = dossierId || getCurrentDossierId();
  if (resolvedDossierId) {
    formData.append("dossierId", String(resolvedDossierId));
  }
  if (engine && engine !== "DEFAULT") {
    formData.append("engine", engine);
    formData.append("ocrMode", "EVOLEO_AI");
    formData.append("useAlphaAgent", "true");
  }
  const result = unwrapApiData<any>(
    await request<any>("/api/sales/invoices/upload", {
      method: "POST",
      body: formData,
    }),
  );
  return mapSalesInvoiceResponse(result?.invoice || result);
}

// ============================================
// LEGACY MINI COMPATIBILITY (non /api)
// ============================================

export async function legacyScanInvoice(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/scan`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function legacyAlphaOcr(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/alpha`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function legacyVenteScan(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/vente`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function getSalesInvoicesByDossier(
  dossierId: number,
  status?: string,
): Promise<DynamicInvoiceDto[]> {
  const normalizedStatus = String(status || "").toUpperCase();
  const backendStatuses = (() => {
    if (!normalizedStatus) return [undefined];
    if (normalizedStatus === "ACCOUNTED") return ["VALIDATED"];
    if (normalizedStatus === "VERIFY" || normalizedStatus === "TO_VERIFY")
      return ["PENDING"];
    if (normalizedStatus === "READY_TO_TREAT")
      return ["PENDING", "PROCESSING"];
    if (normalizedStatus === "READY_TO_VALIDATE")
      return ["TREATED", "READY_TO_VALIDATE"];
    if (normalizedStatus === "REJECTED") return ["ERROR"];
    if (normalizedStatus === "PROCESSED") return ["TREATED"];
    return [normalizedStatus];
  })();

  const fetchSalesInvoices = async (
    requestedStatus?: string,
    withLimit: boolean = true,
  ): Promise<any[]> => {
    const result = unwrapApiData<any>(
      await request<any>("/api/sales/invoices", undefined, {
        dossierId,
        status: requestedStatus,
        limit: withLimit ? 200 : undefined,
      }),
    );
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.invoices)) return result.invoices;
    if (Array.isArray(result?.content)) return result.content;
    return [];
  };

  try {
    const batches = await Promise.all(
      backendStatuses.map((s) => fetchSalesInvoices(s, true)),
    );
    const deduped = new Map<number, DynamicInvoiceDto>();
    for (const batch of batches) {
      for (const row of batch) {
        const mapped = mapSalesInvoiceResponse(row);
        if (Number.isFinite(Number(mapped.id))) {
          deduped.set(Number(mapped.id), mapped);
        }
      }
    }
    const invoices = Array.from(deduped.values());
    if (normalizedStatus === "ACCOUNTED") {
      return invoices.filter((invoice) =>
        Boolean(invoice.accounted || invoice.accountedAt),
      );
    }
    return invoices;
  } catch (error: any) {
    if (error?.status !== 500) {
      throw error;
    }

    const fallbackStatuses = backendStatuses.some((s) => Boolean(s))
      ? backendStatuses
      : [
          "PENDING",
          "PROCESSING",
          "TREATED",
          "READY_TO_VALIDATE",
          "VALIDATED",
          "ERROR",
        ];

    const batches = await Promise.all(
      fallbackStatuses.map((s) => fetchSalesInvoices(s, false).catch(() => [])),
    );

    const deduped = new Map<number, DynamicInvoiceDto>();
    for (const batch of batches) {
      for (const row of batch) {
        const mapped = mapSalesInvoiceResponse(row);
        if (Number.isFinite(Number(mapped.id))) {
          deduped.set(Number(mapped.id), mapped);
        }
      }
    }

    const invoices = Array.from(deduped.values());
    if (normalizedStatus === "ACCOUNTED") {
      return invoices.filter((invoice) =>
        Boolean(invoice.accounted || invoice.accountedAt),
      );
    }
    return invoices;
  }
}

export async function getSalesPendingInvoices(
  dossierId: number,
): Promise<DynamicInvoiceDto[]> {
  const pendingStatuses = [
    "PENDING",
    "READY_TO_TREAT",
    "TREATED",
    "READY_TO_VALIDATE",
    "PROCESSING",
    "ERROR",
  ];
  const batches = await Promise.all(
    pendingStatuses.map((status) =>
      getSalesInvoicesByDossier(dossierId, status).catch(() => []),
    ),
  );
  const deduped = new Map<number, DynamicInvoiceDto>();
  for (const batch of batches) {
    for (const invoice of batch) {
      deduped.set(Number(invoice.id), invoice);
    }
  }
  return Array.from(deduped.values());
}

export async function getSalesScannedInvoices(
  dossierId: number,
): Promise<DynamicInvoiceDto[]> {
  const scannedStatuses = [
    "PENDING",
    "READY_TO_TREAT",
    "TREATED",
    "READY_TO_VALIDATE",
    "VALIDATED",
    "PROCESSING",
    "ERROR",
  ];
  const batches = await Promise.all(
    scannedStatuses.map((status) =>
      getSalesInvoicesByDossier(dossierId, status).catch(() => []),
    ),
  );
  const deduped = new Map<number, DynamicInvoiceDto>();
  for (const batch of batches) {
    for (const invoice of batch) {
      deduped.set(Number(invoice.id), invoice);
    }
  }
  return Array.from(deduped.values());
}

export async function getSalesInvoiceById(
  id: number,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = unwrapApiData<any>(
    await request<any>(`/api/sales/invoices/${id}`, undefined, {
      dossierId,
    }),
  );
  return mapSalesInvoiceResponse(result);
}

export async function processSalesInvoice(
  id: number,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = unwrapApiData<any>(
    await request<any>(
      `/api/sales/invoices/${id}/reprocess`,
      { method: "POST" },
      { dossierId },
    ),
  );
  return mapSalesInvoiceResponse(result?.invoice || result);
}

export async function updateSalesInvoiceFields(
  id: number,
  fields: Record<string, any>,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = unwrapApiData<any>(
    await request<any>(
      `/api/sales/invoices/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(fields),
      },
      { dossierId },
    ),
  );
  return mapSalesInvoiceResponse(result);
}

export async function validateSalesInvoice(
  id: number,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = unwrapApiData<any>(
    await request<any>(
      `/api/sales/invoices/${id}/validate`,
      { method: "POST" },
      { dossierId },
    ),
  );
  return mapSalesInvoiceResponse(result?.invoice || result);
}

export async function clientValidateSalesInvoice(id: number): Promise<any> {
  const dossierId = getCurrentDossierId();
  return request<any>(
    `/api/sales/invoices/${id}/client-validate`,
    { method: "POST" },
    { dossierId },
  );
}

export async function deleteSalesInvoice(id: number): Promise<void> {
  const dossierId = getCurrentDossierId();
  await request<void>(
    `/api/sales/invoices/${id}`,
    { method: "DELETE" },
    { dossierId },
  );
}

export async function updateSalesInvoiceStatus(
  id: number | string,
  status: string,
): Promise<any> {
  const normalized = normalizeInvoiceStatus(status);
  const dossierId = getCurrentDossierId();

  if (normalized === "READY_TO_TREAT") {
    return request<any>(
      `/api/sales/invoices/${id}/client-validate`,
      { method: "POST" },
      { dossierId },
    );
  }

  throw new Error(
    "Backend sales n'expose pas de mise a jour generique pour ce statut",
  );
}

export async function accountSalesInvoice(
  id: number,
): Promise<DynamicInvoiceDto> {
  const dossierId = getCurrentDossierId();
  const result = unwrapApiData<any>(
    await request<any>(
      `/api/sales/invoices/${id}/account`,
      { method: "POST" },
      { dossierId },
    ),
  );
  return mapSalesInvoiceResponse(result?.invoice || result);
}

export async function getSalesJournalEntries(
  dossierId?: number,
): Promise<AccountingEntry[]> {
  const resolvedDossierId = dossierId || getCurrentDossierId();
  const result = await request<any>("/api/sales/invoices/journal", undefined, {
    dossierId: resolvedDossierId,
  });
  return (result?.entries || []) as AccountingEntry[];
}

export async function getSalesInvoiceStats(
  dossierId?: number,
): Promise<Record<string, number>> {
  const resolvedDossierId = dossierId || getCurrentDossierId();
  return request<any>("/api/sales/invoices/stats", undefined, {
    dossierId: resolvedDossierId,
  });
}

// ─── Journal (Relevé Bancaire) ────────────────────────────────────────────────

export async function getJournalPeriods(): Promise<JournalPeriod[]> {
  const data = await request<any>("/api/v2/journals/periods");
  return data.periods || data || [];
}

export async function getJournalList(period?: string): Promise<JournalItem[]> {
  const data = await request<any>("/api/v2/journals", undefined, period ? { period } : undefined);
  return data.journals || data || [];
}

export async function exportJournal(statementId: number): Promise<Response> {
  const response = await fetch(url(`/api/v2/journals/${statementId}/export`), {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

export async function printJournal(statementId: number): Promise<Response> {
  const response = await fetch(url(`/api/v2/journals/${statementId}/print`), {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

export async function getJournalEntries(statementId: number): Promise<JournalEntryRow[]> {
  const data = await request<any>(`/api/v2/journals/${statementId}/entries`);
  return data.entries || data || [];
}

export const api = {
  uploadDynamicInvoice,
  uploadDynamicInvoicesBatch,
  processDynamicInvoice,
  getDynamicInvoiceById,
  validateDynamicInvoice,
  updateDynamicInvoiceFields,
  extractDynamicInvoiceField,
  checkDynamicInvoiceDuplicate,
  getAllDynamicInvoices,
  deleteDynamicInvoice,
  clientValidateInvoice,
  bulkDeleteInvoices,
  getDynamicInvoiceStats,
  processDynamicInvoicesBulk,
  reprocessDynamicInvoicesBulk,
  getDynamicAvailableSignatures,
  linkTierToDynamicInvoice,
  linkTierToSalesInvoice,
  getCurrentUser,
  getClientDashboard,
  listUsers,
  createUser,
  deactivateUser,
  updateUserRole,
  updateUserActive,
  getDossiers,
  createDossier,
  deleteDossier,
  changeDossierComptable,
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
  getAccountOptions,
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
  getGeneralParams,
  saveGeneralParams,
  getAccountingEntries,
  accountInvoiceEntries,
  rebuildAccountingEntries,
  uploadBankStatement,
  getAllBankStatements,
  getBankStatementById,
  processBankStatement,
  validateBankStatement,
  clientValidateBankStatement,
  updateBankStatementStatus,
  updateBankStatementTtcRule,
  updateBankStatementFraisRule,
  updateBankStatementAgiosRule,
  updateBankStatementPackageRule,
  deleteBankStatement,
  deleteAllBankStatements,
  getBankStatementStats,
  retryFailedBankStatementPages,
  getBankOptions,
  getTransactionsByStatementId,
  updateBankTransaction,
  createBankTransaction,
  simulateComptabilisation,
  confirmComptabilisation,
  getAllPatterns,
  getPatternStatistics,
  approvePattern,
  rejectPattern,
  getFileUrl,
  getDynamicInvoicePdfUrl,
  uploadInvoice: uploadDynamicInvoice,
  uploadInvoicesBatch: uploadDynamicInvoicesBatch,
  processInvoice: processDynamicInvoice,
  getInvoiceById: getDynamicInvoiceById,
  validateInvoice: validateDynamicInvoice,
  updateInvoiceFields: updateDynamicInvoiceFields,
  extractInvoiceField: extractDynamicInvoiceField,
  checkDuplicateInvoice: checkDynamicInvoiceDuplicate,
  getAllInvoices: getAllDynamicInvoices,
  deleteInvoice: deleteDynamicInvoice,
  getInvoiceStats: getDynamicInvoiceStats,
  getAvailableSignatures: getDynamicAvailableSignatures,
  linkTierToInvoice: linkTierToDynamicInvoice,
  getInvoicePdfUrl: getDynamicInvoicePdfUrl,
  accountInvoice: accountInvoiceEntries,
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
  // Sales (Vente) invoices
  uploadSalesInvoice,
  getSalesInvoicesByDossier,
  getSalesPendingInvoices,
  getSalesScannedInvoices,
  getSalesInvoiceById,
  processSalesInvoice,
  updateSalesInvoiceFields,
  validateSalesInvoice,
  clientValidateSalesInvoice,
  updateSalesInvoiceStatus,
  deleteSalesInvoice,
  accountSalesInvoice,
  getSalesJournalEntries,
  getSalesInvoiceStats,
  getSalesInvoicePdfUrl,
  // Journal bancaire
  getJournalPeriods,
  getJournalList,
  exportJournal,
  printJournal,
  getJournalEntries,
};
