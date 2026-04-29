// ============================================
// API RESPONSE TYPES (V2)
// ============================================

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
    code?: string;
    errorCode?: string;
    details?: unknown;
    timestamp: string;
}

// Role map keeps runtime values for API payloads and guards while also providing a strict union type.
export const UserRole = {
    SUPER_ADMIN: "SUPER_ADMIN",
    ADMIN: "ADMIN",
    COMPTABLE: "COMPTABLE",
    CLIENT: "CLIENT",
    FOURNISSEUR: "FOURNISSEUR",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
    id: number;
    email: string;
    name: string;
    username?: string;
    displayName?: string;
    role: UserRole;
    active: boolean;
    password?: string; // Optional for mock authentication
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface LoginRequest {
    email?: string;
    username?: string;
    password?: string;
}

export interface CreateComptableRequest {
    username: string;
    password: string;
    displayName?: string;
}

export interface ComptableAdminDto {
    id: number;
    username: string;
    email: string;
    displayName?: string | null;
    role: "COMPTABLE";
    active: boolean;
}

// ============================================
// GEOMETRIC TYPES
// ============================================

export interface FieldPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    isEstimated?: boolean;
}

// ============================================
// INVOICE FIELD TYPES
// ============================================

export interface InvoiceField {
    key: string;
    label: string;
    value: string | number | null;
    normalizedValue?: string | number | null;
    type: "text" | "number" | "date";
    position?: FieldPosition;
    required?: boolean;
    detected?: boolean;
    confidence?: number;
    hasEstimatedPosition?: boolean;
}

export type InvoiceStatus =
    | "VERIFY"
    | "READY_TO_TREAT"
    | "READY_TO_VALIDATE"
    | "VALIDATED"
    | "REJECTED"
    | "pending"
    | "processing"
    | "treated"
    | "ready_to_validate"
    | "validated"
    | "error"
    | "to_verify";
export type BackendInvoiceStatus = "VERIFY" | "READY_TO_TREAT" | "READY_TO_VALIDATE" | "VALIDATED" | "REJECTED" | "PENDING" | "PROCESSING" | "TREATED" | "ERROR" | "TO_VERIFY";

// ============================================
// ACCOUNTING TYPES
// ============================================

export interface Account {
    id: number;
    code: string;
    libelle: string;
    classe: number;
    active: boolean;
    xCom?: string;
    delai?: number;
    ville?: string;
    adresse?: string;
    activite?: string;
    cdClt?: number;
    cdFrs?: number;
    typeCmpt?: string;
    numcat?: number;
    idF?: string;
    cod?: string;
    cnss?: string;
    tp?: string;
    ice?: string;
    rc?: string;
    rib?: string;
    tva?: string;
    charge?: string;
    classeName?: string;
    tvaRate?: number;
    taxCode?: string;
    isFournisseurAccount?: boolean;
    isChargeAccount?: boolean;
    isTvaAccount?: boolean;
    displayWithTva?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
}

export interface CreateAccountRequest {
    code: string;
    libelle: string;
    classe: number;
    active?: boolean;
    tvaRate?: number;
    taxCode?: string;
    xCom?: string;
    delai?: number;
    ville?: string;
    adresse?: string;
    activite?: string;
    cdClt?: number;
    cdFrs?: number;
    typeCmpt?: string;
    numcat?: number;
    idF?: string;
    cod?: string;
    cnss?: string;
    tp?: string;
    ice?: string;
    rc?: string;
    rib?: string;
    tva?: string;
    charge?: string;
    createdBy?: string;
    updatedBy?: string;
}

export interface UpdateAccountRequest {
    libelle?: string;
    active?: boolean;
    tvaRate?: number;
    taxCode?: string;
    xCom?: string;
    delai?: number;
    ville?: string;
    adresse?: string;
    activite?: string;
    cdClt?: number;
    cdFrs?: number;
    typeCmpt?: string;
    numcat?: number;
    idF?: string;
    cod?: string;
    cnss?: string;
    tp?: string;
    ice?: string;
    rc?: string;
    rib?: string;
    tva?: string;
    charge?: string;
    createdBy?: string;
    updatedBy?: string;
}

export interface Tier {
    id: number;
    libelle: string;
    activity?: string;
    auxiliaireMode: boolean;
    tierNumber: string;
    collectifAccount?: string;
    displayAccount?: string;
    ifNumber?: string;
    ice?: string;
    rcNumber?: string;
    defaultChargeAccount?: string;
    tvaAccount?: string;
    defaultTvaRate?: number;
    active: boolean;
    hasAccountingConfig?: boolean;
    hasTvaConfiguration?: boolean;
    tvaDisplayFormat?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateTierRequest {
    libelle: string;
    activity?: string;
    auxiliaireMode: boolean;
    tierNumber: string;
    collectifAccount?: string;
    ifNumber?: string;
    ice?: string;
    rcNumber?: string;
    defaultChargeAccount?: string;
    tvaAccount?: string;
    defaultTvaRate?: number;
    active?: boolean;
}

export interface UpdateTierRequest {
    libelle?: string;
    activity?: string;
    tierNumber?: string;
    collectifAccount?: string;
    ifNumber?: string;
    ice?: string;
    rcNumber?: string;
    defaultChargeAccount?: string;
    tvaAccount?: string;
    defaultTvaRate?: number;
    taxCode?: string;
    active?: boolean;
}

// ============================================
// BANK STATEMENT TYPES
// ============================================

export interface BankStatementField {
    key: string;
    label: string;
    value: string | number | null;
    type: "text" | "number" | "date";
    position?: FieldPosition;
}

export interface LocalBankStatement {
    id: number;
    filename: string;
    originalName?: string;
    filePath: string;
    fileSize: number;
    fileUrl?: string;
    fields: BankStatementField[];
    status: "pending" | "processing" | "treated" | "validated" | "error";
    isProcessing?: boolean;
    createdAt: string;
    updatedAt?: string;
}

// ============================================
// INVOICE DTO TYPES
// ============================================

export interface InvoiceDto {
    id: number;
    filename: string;
    originalName?: string;
    filePath: string;
    fileSize: number;
    extractedText?: string;
    rawOcrText?: string;
    fieldsData: Record<string, any>;
    pendingFields?: string[];
    missingFields?: string[];
    lowConfidenceFields?: string[];
    autoFilledFields?: string[];
    overallConfidence?: number;
    averageConfidence?: number;
    templateId?: number;
    templateName?: string;
    extractionMethod?: "DYNAMIC_TEMPLATE" | "PATTERNS" | "ALPHA_AGENT" | "MANUAL" | "NONE";
    status?: BackendInvoiceStatus;
    createdAt: string;
    updatedAt?: string;
    validatedAt?: string;
    validatedBy?: string;
    templateDetected?: boolean;
    allFieldsFound?: boolean;
    canValidate?: boolean;
    canCreateTemplate?: boolean;
    tier?: Tier;
    dossierId?: number;
}

// ============================================
// EXTRACTION TYPES
// ============================================

export interface ExtractedFieldResponse {
    value: string;
    normalizedValue?: any;
    confidence: number;
    detectionMethod: string;
    validated: boolean;
    validationError?: string;
}

export interface DynamicExtractionResponse {
    success: boolean;
    message: string;
    invoiceId?: number;
    templateId?: number;
    templateName?: string;
    extractedFields: Record<string, ExtractedFieldResponse>;
    missingFields: string[];
    lowConfidenceFields: string[];
    overallConfidence: number;
    extractedCount: number;
    totalFields: number;
    isComplete: boolean;
    extractionDurationMs?: number;
    rawOcrText?: string;
    extractedText?: string;
    extractionMethod?: "DYNAMIC_TEMPLATE" | "PATTERNS" | "ALPHA_AGENT" | "MANUAL" | "NONE";
    status?: string;
    autoFilledFields?: string[];
}

// ============================================
// TEMPLATE TYPES
// ============================================

export interface DynamicSignature {
    type: "ICE" | "IF" | "RC" | "SUPPLIER";
    value: string;
}

export type DynamicFieldType = "TEXT" | "NUMBER" | "DATE" | "CURRENCY" | "IDENTIFIER";

export interface DynamicFieldDefinition {
    fieldName: string;
    labels: string[];
    regexPattern?: string;
    fieldType: DynamicFieldType;
    detectionMethod?: string;
    required?: boolean;
    confidenceThreshold?: number;
    defaultValue?: string;
    searchZone?: "HEADER" | "BODY" | "FOOTER" | "ALL";
    extractionOrder?: number;
    description?: string;
}

export interface FixedSupplierData {
    ice?: string;
    ifNumber?: string;
    rcNumber?: string;
    supplier?: string;
    address?: string;
    phone?: string;
    email?: string;
    city?: string;
    postalCode?: string;
}

export interface DynamicTemplateDto {
    id: number;
    templateName: string;
    supplierType: string;
    signature: DynamicSignature;
    fieldDefinitions: DynamicFieldDefinition[];
    fixedSupplierData?: FixedSupplierData;
    active: boolean;
    version: number;
    description?: string;
    usageCount: number;
    successCount: number;
    successRate: number;
    reliable: boolean;
    lastUsedAt?: string;
    createdAt: string;
    createdBy?: string;
}

export interface CreateDynamicTemplateRequest {
    templateName: string;
    supplierType: string;
    signature: DynamicSignature;
    fieldDefinitions: DynamicFieldDefinition[];
    fixedSupplierData?: FixedSupplierData;
    description?: string;
    createdBy?: string;
}

// ============================================
// PATTERN TYPES
// ============================================

export interface FieldPattern {
    id?: number;
    fieldName: string;
    patternRegex: string;
    priority: number;
    description?: string;
    active: boolean;
    createdAt?: string;
}
