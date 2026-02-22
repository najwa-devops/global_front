import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { DynamicInvoiceDto, DynamicInvoice, DynamicInvoiceField, DynamicInvoiceStatus, BackendInvoiceStatus, FieldPosition } from "./types"
import { DEFAULT_FIELDS } from "./types"
import { getFileUrl } from "./api"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================
// HELPER : EXTRACTION VALEURS V1/V2
// ============================================

/**
 * Extrait la valeur d'un champ, compatible V1 et V2
 * 
 * V1: valeur simple (string, number)
 * V2: objet {value, position}
 * 
 * @param field - Champ à extraire
 * @returns La valeur extraite ou null
 */
export function extractFieldValue(field: any): string | null {
  // V1: Valeur simple
  if (typeof field === 'string' || typeof field === 'number') {
    return String(field)
  }

  // V2: Objet {value, position}
  if (field && typeof field === 'object' && 'value' in field) {
    return field.value !== null && field.value !== undefined ? String(field.value) : null
  }

  return null
}

/**
 * Extrait la position d'un champ V2
 * 
 * @param field - Champ à extraire
 * @returns La position ou undefined
 */
export function extractFieldPosition(field: any): { x: number; y: number; width: number; height: number } | undefined {
  if (field && typeof field === 'object' && 'position' in field && field.position) {
    return field.position
  }
  return undefined
}

/**
 * Verifie si des champs ont des positions (V2)
 * 
 * @param fieldsData - Données des champs
 * @returns true si au moins 3 champs ont des positions
 */
export function hasFieldsWithPositions(fieldsData: Record<string, any>): boolean {
  let count = 0
  const businessFields = ['invoiceNumber', 'supplier', 'ice', 'if', 'rcNumber', 'invoiceDate', 'amountHT', 'tva', 'amountTTC']

  for (const fieldName of businessFields) {
    const field = fieldsData[fieldName]
    if (field && typeof field === 'object' && field.position) {
      count++
    }
  }

  return count >= 3
}

// ============================================
// HELPER : NORMALISER LES STATUTS
// ============================================

/**
 * Convertit un statut backend (MAJUSCULE) en statut frontend (minuscule)
 */
export function normalizeStatus(status: any): DynamicInvoiceStatus {
  if (!status) return "pending"

  const statusStr = String(status).toUpperCase()

  const statusMap: Record<string, DynamicInvoiceStatus> = {
    "VERIFY": "to_verify",
    "READY_TO_TREAT": "pending",
    "READY_TO_VALIDATE": "ready_to_validate",
    "VALIDATED": "validated",
    "REJECTED": "error",
    "PENDING": "pending",
    "PROCESSING": "processing",
    "TREATED": "treated",
    "ERROR": "error"
  }

  const normalized = statusMap[statusStr as BackendInvoiceStatus] || "pending"

  console.log(`Normalisation status: ${statusStr} → ${normalized}`)

  return normalized
}

export function toWorkflowStatus(status: any): "VERIFY" | "READY_TO_TREAT" | "READY_TO_VALIDATE" | "VALIDATED" | "REJECTED" {
  const s = String(status || "").toUpperCase()

  if (s === "VERIFY" || s === "TO_VERIFY") return "VERIFY"
  if (s === "READY_TO_TREAT" || s === "PENDING" || s === "PROCESSING") return "READY_TO_TREAT"
  if (s === "READY_TO_VALIDATE" || s === "TREATED" || s === "PROCESSED") return "READY_TO_VALIDATE"
  if (s === "VALIDATED") return "VALIDATED"
  if (s === "REJECTED" || s === "ERROR") return "REJECTED"

  return "READY_TO_TREAT"
}

// ============================================
// CONVERSIONS API - LOCAL
// ============================================

export function dynamicInvoiceDtoToLocal(dto: DynamicInvoiceDto): DynamicInvoice {
  const ocrText = dto.rawOcrText || dto.extractedText
  const fields = dto.fieldsData
    ? ParseBackendFieldsData(dto.fieldsData, DEFAULT_FIELDS, dto, ocrText)
    : DEFAULT_FIELDS.map((field) => ({ ...field }))

  const technicalFields = [
    "pendingFields", "warnings", "suggestedCorrections", "status",
    "footerExtractionForced", "footerExtractionDate", "footerFieldsFound",
    "iceSource", "iceAddedDate", "iceAddedBy",
    "canCreateTemplate", "canValidate", "templateName", "templateVersion",
    "detectedIce", "detectedIf", "detectedSupplier",
    "fileType", "processed", "processingDate", "extractionTimestamp",
    "extractionVersion", "extractionMethod",
    "missingFields", "lowConfidenceFields", "overallConfidence",
    "averageConfidence", "allFieldsFound", "templateDetected"
  ]

  // Champs dynamiques
  if (dto.fieldsData) {
    Object.keys(dto.fieldsData).forEach((key) => {
      const isMetadata = technicalFields.includes(key)
      const isDefaultField = DEFAULT_FIELDS.some((f) => f.key === key)

      if (!isMetadata && !isDefaultField) {
        const fieldData = dto.fieldsData[key]
        let value: any = ""
        let position = undefined
        let confidence = undefined
        let normalizedValue = undefined

        if (typeof fieldData === "object" && fieldData !== null && "value" in fieldData) {
          value = fieldData.value
          position = fieldData.position
          confidence = fieldData.confidence
          normalizedValue = fieldData.normalizedValue
        } else {
          value = fieldData
        }

        fields.push({
          key,
          label: key,
          value: value || "",
          normalizedValue,
          type: typeof value === "number" ? "number" : "text",
          detected: true,
          position,
          confidence,
        })
      }
    })
  }

  return {
    id: dto.id,
    filename: dto.filename,
    originalName: dto.originalName,
    filePath: dto.filePath,
    fileSize: dto.fileSize,
    fileUrl: getFileUrl(dto.filePath || dto.filename, dto.id),
    extractedText: dto.extractedText,
    headerText: dto.headerRawText || dto.fieldsData?.headerRawText,
    footerText: dto.footerRawText || dto.fieldsData?.footerRawText,
    fields,
    pendingFields: dto.fieldsData?.pendingFields || dto.pendingFields || [],
    missingFields: dto.fieldsData?.missingFields || [],
    lowConfidenceFields: dto.fieldsData?.lowConfidenceFields || [],
    autoFilledFields: dto.autoFilledFields || dto.fieldsData?.autoFilledFields || [],
    warnings: dto.fieldsData?.warnings || [],
    suggestedCorrections: dto.fieldsData?.suggestedCorrections || {},
    status: normalizeStatus(dto.status),
    templateId: dto.templateId,
    templateName: dto.fieldsData?.templateName,
    templateVersion: dto.fieldsData?.templateVersion,
    canCreateTemplate: dto.canCreateTemplate || dto.fieldsData?.canCreateTemplate || false,
    canValidate: dto.canValidate || dto.fieldsData?.canValidate || false,
    // Extraction metadata
    extractionMethod: dto.fieldsData?.extractionMethod || dto.extractionMethod,
    templateDetected: dto.fieldsData?.templateDetected || dto.templateDetected || false,
    overallConfidence: dto.fieldsData?.overallConfidence || dto.overallConfidence,
    averageConfidence: dto.fieldsData?.averageConfidence || dto.averageConfidence,
    allFieldsFound: dto.fieldsData?.allFieldsFound || dto.allFieldsFound,
    tier: dto.tier,
    clientValidated: dto.clientValidated ?? dto.fieldsData?.clientValidated,
    clientValidatedAt: dto.clientValidatedAt ? new Date(dto.clientValidatedAt) : undefined,
    clientValidatedBy: dto.clientValidatedBy,
    accounted: dto.accounted ?? dto.fieldsData?.accounted,
    accountedAt: dto.accountedAt ? new Date(dto.accountedAt) : undefined,
    accountedBy: dto.accountedBy,
    isAvoir: dto.isAvoir,
    createdAt: new Date(dto.createdAt),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
  }
}

export function dynamicInvoiceToUpdateDto(invoice: DynamicInvoice): Record<string, any> {
  const fields: Record<string, any> = {}

  invoice.fields.forEach((field) => {
    if (field.value !== null && field.value !== "") {
      fields[field.key] = field.value
    }
  })

  return fields
}

// Alias pour compatibilité avec les pages héritées
export const invoiceDtoToLocal = dynamicInvoiceDtoToLocal
export const localInvoiceToUpdateDto = dynamicInvoiceToUpdateDto

// ============================================
// FORMATAGE
// ============================================

export function formatAmount(amount: number | string | null): string {
  if (amount === null || amount === undefined || amount === "") {
    return "-"
  }
  const num = typeof amount === "string" ? Number.parseFloat(amount) : amount
  if (isNaN(num)) {
    return "-"
  }
  return `${num.toFixed(2)} DH`
}

export function formatDate(date: Date | string | null): string {
  if (!date) {
    return "-"
  }
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) {
    return "-"
  }
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) {
    return "-"
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ============================================
// EXPORT
// ============================================

export function exportInvoicesToCsv(invoices: DynamicInvoice[], filename: string) {
  if (typeof window === "undefined") return
  const headers = [
    "id",
    "filename",
    "invoiceNumber",
    "supplier",
    "invoiceDate",
    "amountHT",
    "tva",
    "amountTTC",
    "status",
  ]

  const rows = invoices.map((invoice) => {
    const field = (key: string) =>
      invoice.fields.find((f) => f.key === key)?.value ?? ""
    return [
      invoice.id,
      invoice.filename,
      String(field("invoiceNumber") ?? ""),
      String(field("supplier") ?? ""),
      String(field("invoiceDate") ?? ""),
      String(field("amountHT") ?? ""),
      String(field("tva") ?? ""),
      String(field("amountTTC") ?? ""),
      invoice.status || "",
    ]
  })

  const escapeCsv = (value: any) => {
    const str = String(value ?? "")
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replace(/"/g, "\"\"")}"`
    }
    return str
  }

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ============================================
// VALIDATION
// ============================================

export function isDynamicInvoiceComplete(invoice: DynamicInvoice): boolean {
  const requiredFields = invoice.fields.filter((f) => f.required)
  return requiredFields.every((f) => f.value !== null && f.value !== "")
}

export const isInvoiceComplete = isDynamicInvoiceComplete

export function validateAmounts(
  ht: number,
  tva: number,
  ttc: number,
): {
  valid: boolean
  message?: string
  suggestedTTC?: number
} {
  const calculatedTTC = Math.round((ht + tva) * 100) / 100
  const isValid = Math.abs(ttc - calculatedTTC) < 0.01

  if (!isValid) {
    return {
      valid: false,
      message: `Le TTC (${ttc}) ne correspond pas à HT + TVA (${calculatedTTC})`,
      suggestedTTC: calculatedTTC,
    }
  }

  return { valid: true }
}

// ============================================
// RECHERCHE ET FILTRAGE
// ============================================

export function filterDynamicInvoices(invoices: DynamicInvoice[], searchTerm: string): DynamicInvoice[] {
  if (!searchTerm.trim()) {
    return invoices
  }

  const term = searchTerm.toLowerCase()

  return invoices.filter((invoice) => {
    const invoiceNumber = invoice.fields
      .find((f) => f.key === "invoiceNumber")
      ?.value?.toString()
      .toLowerCase()
    if (invoiceNumber?.includes(term)) {
      return true
    }

    const supplier = invoice.fields
      .find((f) => f.key === "supplier")
      ?.value?.toString()
      .toLowerCase()
    if (supplier?.includes(term)) {
      return true
    }

    if (invoice.filename.toLowerCase().includes(term)) {
      return true
    }

    return false
  })
}

export function sortDynamicInvoices(
  invoices: DynamicInvoice[],
  sortBy: "date" | "amount" | "status" | "filename",
  order: "asc" | "desc" = "desc",
): DynamicInvoice[] {
  const sorted = [...invoices].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return a.createdAt.getTime() - b.createdAt.getTime()
      case "amount": {
        const amountA = a.fields.find((f) => f.key === "amountTTC")?.value || 0
        const amountB = b.fields.find((f) => f.key === "amountTTC")?.value || 0
        return Number(amountA) - Number(amountB)
      }
      case "status":
        return (a.status || "pending").localeCompare(b.status || "pending")
      case "filename":
        return a.filename.localeCompare(b.filename)
      default:
        return 0
    }
  })

  return order === "desc" ? sorted.reverse() : sorted
}

/**
 * Estime la position d'un champ sur le document
 * en recherchant sa valeur dans le texte OCR brut.
 * Utilise une heuristique basée sur la position dans les lignes.
 */
export function estimateFieldPosition(
  fieldValue: string,
  ocrText: string
): FieldPosition | undefined {
  if (!fieldValue || !ocrText || String(fieldValue).length < 2) return undefined

  const text = ocrText.toLowerCase()
  const val = String(fieldValue).toLowerCase().trim()

  const index = text.indexOf(val)
  if (index === -1) return undefined

  const lines = ocrText.split('\n')
  let currentPos = 0
  let targetLine = 0
  let targetCharInLine = 0

  for (let i = 0; i < lines.length; i++) {
    if (currentPos + lines[i].length >= index) {
      targetLine = i
      targetCharInLine = index - currentPos
      break
    }
    currentPos += lines[i].length + 1
  }

  // Héuristique de positionnement (en %)
  const totalLines = Math.max(lines.length, 30)
  const lineLength = Math.max(lines[targetLine]?.length || 1, 60) // Base min de 60 pour éviter les sauts brutaux
  const y = (targetLine / totalLines) * 100
  const x = (targetCharInLine / lineLength) * 100

  return {
    x: Math.min(Math.max(x, 5), 85),
    y: Math.min(Math.max(y, 2), 95),
    width: Math.min(Math.max(val.length * 0.8, 10), 40),
    height: 2.5,
    isEstimated: true
  }
}

/**
 * Parse les données de champs depuis le backend
 * Gère les différents formats : objet {value, position} ou valeur directe
 */
export function ParseBackendFieldsData(
  fieldsData: Record<string, any>,
  defaultFields: DynamicInvoiceField[],
  invoice?: any,
  ocrText?: string
): DynamicInvoiceField[] {
  console.log("Parsing fieldsData with OCR support:", !!ocrText)

  const parsedFields = defaultFields.map((field) => {
    // CORRECTION : Le backend envoie déjà les bonnes clés (tierNumber, chargeAccount, etc.)
    // On supprime le mapping qui cassait la correspondance
    const backendKey = field.key
    let backendValue = fieldsData[backendKey]

    // Priority 1: SI Tier trouvé -> Utiliser Tier.libelle pour le champ supplier
    if (field.key === "supplier") {
      if (invoice?.tierName) {
        backendValue = invoice.tierName
      } else if (invoice?.fixedSupplierData?.supplier) {
        backendValue = invoice.fixedSupplierData.supplier
      }
    }

    // CAS 1: Valeur null ou undefined
    if (backendValue === null || backendValue === undefined) {
      return { ...field, value: "", detected: false }
    }

    // CAS 2: Objet avec {value, position, confidence, normalizedValue}
    if (typeof backendValue === "object" && backendValue !== null) {
      if ("value" in backendValue) {
        const value = backendValue.value
        let position = backendValue.position
        const confidence = backendValue.confidence
        const normalizedValue = backendValue.normalizedValue

        // NOUVEAU: Estimation si position manquante
        if (!position && ocrText && value) {
          position = estimateFieldPosition(String(value), ocrText)
        }

        return {
          ...field,
          value: value !== null && value !== undefined ? String(value) : "",
          normalizedValue: normalizedValue !== null && normalizedValue !== undefined ? normalizedValue : undefined,
          detected: value !== null && value !== "" && value !== undefined,
          position: position || field.position,
          confidence: confidence !== null && confidence !== undefined ? confidence : undefined,
          hasEstimatedPosition: position?.isEstimated || false
        }
      }
    }

    // CAS 3: Valeur directe (string, number, boolean)
    const valueStr = String(backendValue)
    let position = field.position

    if (!position && ocrText && valueStr) {
      position = estimateFieldPosition(valueStr, ocrText)
    }

    const fieldObj: DynamicInvoiceField = {
      ...field,
      value: valueStr,
      detected: true,
      position,
      hasEstimatedPosition: position?.isEstimated || false
    }

    // Si le champ fait partie de autoFilledFields, on peut le marquer spécifiquement
    if (invoice?.autoFilledFields?.includes(field.key)) {
      fieldObj.confidence = 1.0
    }

    return fieldObj
  })

  // Mapper les champs alternatifs et priorités Template
  const iceField = parsedFields.find(f => f.key === "ice")
  const ifField = parsedFields.find(f => f.key === "ifNumber")
  const supplierField = parsedFields.find(f => f.key === "supplier")

  // NOUVEAU: Si on a un template, on utilise les données fixes du fournisseur (Priorité 2 pour supplier)
  if (fieldsData.fixedSupplierData) {
    const fixed = fieldsData.fixedSupplierData
    if (iceField && (!iceField.value || iceField.value === "") && fixed.ice) {
      iceField.value = fixed.ice
      iceField.detected = true
    }
    if (ifField && (!ifField.value || ifField.value === "") && fixed.ifNumber) {
      ifField.value = fixed.ifNumber
      ifField.detected = true
    }
    if (supplierField && (!supplierField.value || supplierField.value === "") && fixed.supplier) {
      supplierField.value = fixed.supplier
      supplierField.detected = true
    }
  }

  // Fallback ICE/IF si détectés
  if (iceField && (!iceField.value || iceField.value === "") && fieldsData.detectedIce) {
    iceField.value = fieldsData.detectedIce
    iceField.detected = true
  }

  if (ifField && (!ifField.value || ifField.value === "") && fieldsData.detectedIf) {
    ifField.value = fieldsData.detectedIf
    ifField.detected = true
  }

  // Fallback OCR (Priorité 3)
  if (supplierField && (!supplierField.value || supplierField.value === "") && fieldsData.detectedSupplier) {
    supplierField.value = fieldsData.detectedSupplier
    supplierField.detected = true
  }

  return parsedFields
}
