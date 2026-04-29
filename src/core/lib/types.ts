// ============================================
// TYPES GEOMETRIQUES
// ============================================

export interface FieldPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  isEstimated?: boolean | undefined; // Flag pour différencier les positions calculées
}

// ============================================
// TYPES CHAMPS DE FACTURE
// ============================================

export interface DynamicInvoiceField {
  key: string;
  label: string;
  value: string | number | null;
  normalizedValue?: string | number | null | undefined;
  type: "text" | "number" | "date";
  position?: FieldPosition | undefined;
  required?: boolean | undefined;
  detected?: boolean | undefined;
  confidence?: number | undefined;
  hasEstimatedPosition?: boolean | undefined; // Indicateur pour le rendu visuel
}

export const DEFAULT_FIELDS: DynamicInvoiceField[] = [
  {
    key: "invoiceNumber",
    label: "N° Facture",
    value: "",
    type: "text",
    required: true,
  },
  {
    key: "supplier",
    label: "Fournisseur",
    value: "",
    type: "text",
    required: true,
  },
  { key: "ice", label: "ICE", value: "", type: "text", required: true },
  { key: "ifNumber", label: "IF", value: "", type: "text", required: true },
  { key: "rcNumber", label: "RC", value: "", type: "text", required: true },
  {
    key: "invoiceDate",
    label: "Date",
    value: "",
    type: "date",
    required: true,
  },
  {
    key: "activity",
    label: "Activité",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "amountHT",
    label: "Montant HT",
    value: "",
    type: "number",
    required: true,
  },
  { key: "tva", label: "TVA", value: "", type: "number", required: true },
  {
    key: "amountTTC",
    label: "Montant TTC",
    value: "",
    type: "number",
    required: true,
  },
  {
    key: "amountTTCEnLettres",
    label: "Montant TTC en lettres",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "collectifAccount",
    label: "Compte Collectif",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "tierNumber",
    label: "Numero Compte",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "chargeAccount",
    label: "Compte Charge/HT",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "tvaAccount",
    label: "Compte TVA",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "tvaRate",
    label: "Taux TVA (%)",
    value: "",
    type: "number",
    required: false,
  },
];

// Default fields for VENTE (sales) invoices
export const SALES_DEFAULT_FIELDS: DynamicInvoiceField[] = [
  {
    key: "invoiceNumber",
    label: "N° Facture",
    value: "",
    type: "text",
    required: true,
  },
  {
    key: "clientName",
    label: "Client",
    value: "",
    type: "text",
    required: true,
  },
  {
    key: "clientIce",
    label: "ICE Client",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "invoiceDate",
    label: "Date",
    value: "",
    type: "date",
    required: true,
  },
  {
    key: "totalHt",
    label: "Montant HT",
    value: "",
    type: "number",
    required: true,
  },
  {
    key: "totalTva",
    label: "TVA",
    value: "",
    type: "number",
    required: false,
  },
  {
    key: "totalTtc",
    label: "Montant TTC",
    value: "",
    type: "number",
    required: true,
  },
  {
    key: "amountTTCEnLettres",
    label: "Montant TTC en lettres",
    value: "",
    type: "text",
    required: false,
  },
  {
    key: "tvaRate",
    label: "Taux TVA (%)",
    value: "",
    type: "number",
    required: false,
  },
  {
    key: "isAvoir",
    label: "Avoir ?",
    value: "",
    type: "text",
    required: false,
  },
];

// ============================================
// TYPES FACTURE LOCALE
// ============================================

export type DynamicInvoiceStatus =
  | "VERIFY"
  | "READY_TO_TREAT"
  | "READY_TO_VALIDATE"
  | "VALIDATED"
  | "ACCOUNTED"
  | "REJECTED"
  | "pending"
  | "processing"
  | "treated"
  | "ready_to_validate"
  | "validated"
  | "accounted"
  | "error"
  | "to_verify";
export type BackendInvoiceStatus =
  | "VERIFY"
  | "READY_TO_TREAT"
  | "READY_TO_VALIDATE"
  | "VALIDATED"
  | "ACCOUNTED"
  | "REJECTED"
  | "PENDING"
  | "PROCESSING"
  | "TREATED"
  | "ERROR"
  | "TO_VERIFY";

// ============================================
// AUTH / UTILISATEURS
// ============================================

export type UserRole =
  | "ADMIN"
  | "COMPTABLE"
  | "CLIENT"
  | "SUPER_ADMIN"
  | "FOURNISSEUR";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  displayName?: string;
  email?: string;
  active?: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
  displayName?: string;
}

// ============================================
// COMPTABILITE
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
    // Optional/Computed fields
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

// ============================================
// TIER (FOURNISSEUR)
// ============================================

export interface Tier {
  id: number;
  dossierId?: number | undefined;
  libelle: string;
  activity?: string | undefined;

  // Mode Auxiliaire
  auxiliaireMode: boolean;
  tierNumber: string;
  collectifAccount?: string | undefined;
  displayAccount?: string | undefined;

  // Identifiants Fiscaux
  ifNumber?: string | undefined;
  ice?: string | undefined;
  rcNumber?: string | undefined;

  // Config Comptable
  defaultChargeAccount?: string | undefined;
  tvaAccount?: string | undefined;
  defaultTvaRate?: number | undefined;
  taxCode?: string | undefined;

  active: boolean;
  hasAccountingConfig?: boolean | undefined;
  hasTvaConfiguration?: boolean | undefined;
  tvaDisplayFormat?: string | undefined;

  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface CreateTierRequest {
  libelle: string;
  activity?: string | undefined;
  auxiliaireMode: boolean;
  tierNumber: string;
  collectifAccount?: string | undefined;
  ifNumber?: string | undefined;
  ice?: string | undefined;
  rcNumber?: string | undefined;
  defaultChargeAccount?: string | undefined;
  tvaAccount?: string | undefined;
  defaultTvaRate?: number | undefined;
  active?: boolean | undefined;
}

export interface UpdateTierRequest {
  libelle?: string | undefined;
  activity?: string | undefined;
  tierNumber?: string | undefined;
  collectifAccount?: string | undefined;
  ifNumber?: string | undefined;
  ice?: string | undefined;
  rcNumber?: string | undefined;
  defaultChargeAccount?: string | undefined;
  tvaAccount?: string | undefined;
  defaultTvaRate?: number | undefined;
  taxCode?: string | undefined;
  active?: boolean | undefined;
}

export interface AccountingEntry {
  id: number;
  AC?: string | number;
  dossierId?: number;
  invoiceId?: number;
  invoiceNumber?: string;
  supplier?: string;
  journal?: string;
  accountNumber: string;
  entryDate?: string;
  debit?: number;
  credit?: number;
  label?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface AccountingJournalDefaults {
  purchaseJournal?: string;
  salesJournal?: string;
}

// ============================================
// TYPES RELEVÉ BANCAIRE
// ============================================

export interface BankStatementField {
  key: string;
  label: string;
  value: string | number | null;
  type: "text" | "number" | "date";
  position?: FieldPosition | undefined;
}

export interface BankTransaction {
  id?: number;
  date?: string;
  dateOperation?: string;
  dateValeur?: string;
  libelle?: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  confidenceScore?: number;
  flags?: string[];
  transactionIndex?: number;
  compte?: string;
  isLinked?: boolean;
  sens?: string;
  isValid?: boolean;
}

export interface BankTransactionPreview {
  id: number;
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  compte?: string;
  isLinked?: boolean;
  transactionIndex?: number;
  sens?: "DEBIT" | "CREDIT";
  isValid?: boolean;
}

export interface BankTransactionV2 {
  id: number;
  statementId: number;
  dateOperation: string;
  dateValeur: string;
  libelle: string;
  rib: string | null;
  debit: number;
  credit: number;
  sens: "DEBIT" | "CREDIT";
  compte: string;
  compteLibelle?: string | null;
  isLinked: boolean;
  cmApplied?: boolean;
  categorie: string;
  role: string;
  extractionConfidence: number;
  isValid: boolean;
  needsReview: boolean;
  reviewNotes: string | null;
  extractionErrors: string[] | null;
  lineNumber: number;
  transactionIndex?: number;
  fraisRuleApplied?: boolean;
  fraisSplitGroupId?: string | null;
  fraisSplitRole?: string | null;
  fraisOriginalAmount?: number | null;
  ruleLabel?: string | null;
}

export interface LocalBankStatement {
  id: number;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  fileUrl?: string | undefined;
  fields: BankStatementField[];
  status:
    | "pending"
    | "processing"
    | "treated"
    | "validated"
    | "error"
    | "PENDING"
    | "PROCESSING"
    | "TREATED"
    | "READY_TO_VALIDATE"
    | "VALIDATED"
    | "ERROR"
    | "PARTIAL_SUCCESS"
    | "EN_ATTENTE"
    | "EN_COURS"
    | "VALIDE"
    | "TRAITE"
    | "PRET_A_VALIDER"
    | "COMPTABILISE"
    | "COMPTABILISÉ"
    | "VIDE"
    | "DUPLIQUE"
    | "ERREUR";
  isProcessing?: boolean | undefined;
  createdAt: Date | string;
  updatedAt?: Date | string | undefined;
  statusCode?: string;
  rib?: string;
  month?: number;
  year?: number;
  bankName?: string;
  accountHolder?: string;
  openingBalance?: number | null;
  closingBalance?: number | null;
  totalCredit?: number;
  totalDebit?: number;
  totalCreditPdf?: number | null;
  totalDebitPdf?: number | null;
  balanceDifference?: number | null;
  transactionCount?: number;
  validTransactionCount?: number;
  errorTransactionCount?: number;
  overallConfidence?: number;
  continuityStatus?: string;
  displayStatus?: string;
  isBalanceValid?: boolean | null;
  isContinuityValid?: boolean;
  isLinked?: boolean;
  isCmLinked?: boolean;
  applyTtcRule?: boolean;
  applyFraisRule?: boolean;
  applyAgiosRule?: boolean;
  applyPackageRule?: boolean;
  ttcRuleAppliedCount?: number;
  hasTtcRuleApplied?: boolean;
  fraisRuleAppliedCount?: number;
  hasFraisRuleApplied?: boolean;
  agiosRuleAppliedCount?: number;
  hasAgiosRuleApplied?: boolean;
  packageRuleAppliedCount?: number;
  hasPackageRuleApplied?: boolean;
  fraisRuleWarningMessage?: string | null;
  ttcRuleWarningMessage?: string | null;
  agiosRuleWarningMessage?: string | null;
  packageRuleWarningMessage?: string | null;
  canReprocess?: boolean;
  canDelete?: boolean;
  validatedAt?: string | null;
  validatedBy?: string | null;
  rawOcrText?: string;
  cleanedOcrText?: string;
  processedPages?: number;
  totalPages?: number;
  accountedAt?: string | Date | null;
  accountedBy?: string | null;
  extractionErrors?: string[] | null;
  metadata?: Record<string, any>;
  insertedEntries?: number;
  syncedRows?: number;
  simulationId?: string | null;
  readyForValidation?: boolean;
  validationErrors?: string[] | string | null;
  verificationStatus?: string | null;
  duplicateOfId?: number | null;
  isDuplicate?: boolean;
  transactionsPreview?: BankTransactionPreview[];
  transactions?: BankTransactionV2[];
}

export type BankStatementV2 = LocalBankStatement;

export interface BankOption {
  code: string;
  label: string;
  name?: string | undefined;
  enabled?: boolean | undefined;
  mappedTo?: string | undefined;
}

export interface BankStatementStats {
  total: number;
  pending: number;
  processing: number;
  readyToValidate: number;
  validated: number;
  accounted?: number;
  error: number;
  totalRibs: number;
  invalid: number;
  averageConfidence: number;
}

export interface DynamicInvoice {
  id: number;
  dossierId?: number;
  filename: string;
  originalName?: string | undefined;
  invoiceNumber?: string | undefined;
  supplier?: string | undefined;
  filePath: string;
  fileSize: number;
  fileUrl?: string | undefined;
  extractedText?: string | undefined;
  headerText?: string | undefined;
  footerText?: string | undefined;
  rawOcrText?: string | undefined;
  cleanedOcrText?: string | undefined;
  scanned?: boolean | undefined;
  documentType?: string | undefined;
  amountsValid?: boolean | undefined;
  validationMessage?: string | undefined;
  qualityScore?: number | undefined;
  difficultyClass?: string | undefined;
  qualityFlags?: string[] | undefined;
  reviewRequired?: boolean | undefined;
  reviewReasons?: string[] | undefined;
  fieldConfidences?: Record<string, number> | undefined;
  fieldSources?: Record<string, string> | undefined;
  olmocrUsed?: boolean | undefined;
  olmocrDurationMs?: number | undefined;
  olmocrMode?: string | undefined;
  fields: DynamicInvoiceField[];
  fieldsData?: Record<string, any> | undefined;
  extractedData?: Record<string, any> | undefined;
  pendingFields?: string[] | undefined;
  missingFields?: string[] | undefined;
  lowConfidenceFields?: string[] | undefined;
  warnings?: string[] | undefined;
  suggestedCorrections?: Record<string, any> | undefined;
  status?: DynamicInvoiceStatus | undefined;
  templateId?: number | undefined;
  templateName?: string | undefined;
  templateVersion?: number | undefined;
  canCreateTemplate?: boolean | undefined;
  canValidate?: boolean | undefined;
  isProcessing?: boolean | undefined;
  extractionMethod?:
    | "DYNAMIC_TEMPLATE"
    | "PATTERNS"
    | "ALPHA_AGENT"
    | "MANUAL"
    | "NONE"
    | undefined;
  templateDetected?: boolean | undefined;
  overallConfidence?: number | undefined;
  averageConfidence?: number | undefined;
  allFieldsFound?: boolean | undefined;
  autoFilledFields?: string[] | undefined;
  tier?: Tier | undefined;
  detectedSignature?:
    | {
        type: string;
        value: string;
      }
    | undefined;
  clientValidated?: boolean;
  clientValidatedAt?: Date;
  clientValidatedBy?: string;
  accounted?: boolean;
  accountedAt?: Date;
  accountedBy?: string;
  isAvoir?: boolean;
  createdAt: Date;
  updatedAt?: Date | undefined;
  validatedAt?: Date | undefined;
  validatedBy?: string | undefined;
}

export type LocalInvoice = DynamicInvoice;

// ============================================
// TYPES TEMPLATES LOCAUX
// ============================================

export interface LocalTemplate {
  id: number;
  templateName: string;
  signatureFields: { ice?: string; if?: string };
  fieldConfig: Record<
    string,
    {
      label: string;
      type: "text" | "number" | "date";
      position?: FieldPosition;
      required?: boolean;
    }
  >;
  createdAt?: Date;
}

// ============================================
// TYPES PATTERNS DE CHAMPS (Admin)
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

// ============================================
// TYPES DYNAMIC TEMPLATES (V2)
// ============================================

export interface DynamicSignature {
  type: "ICE" | "IF" | "RC" | "SUPPLIER";
  value: string;
}

export type DynamicFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "CURRENCY"
  | "IDENTIFIER";

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

export interface UpdateDynamicTemplateRequest {
  templateName?: string;
  supplierType?: string;
  description?: string;
  fieldDefinitions?: DynamicFieldDefinition[];
  fixedSupplierData?: FixedSupplierData;
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
  lastUsedAt?: Date | string;
  createdAt: Date | string;
  createdBy?: string;
}

export type DynamicTemplate = DynamicTemplateDto; // Alias

export interface CreateDynamicTemplateRequest {
  templateName: string;
  supplierType: string;
  signature: DynamicSignature;
  fieldDefinitions: DynamicFieldDefinition[];
  fixedSupplierData?: FixedSupplierData;
  description?: string;
  createdBy?: string;
}

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
// TYPES APPRENTISSAGE
// ============================================

export interface LearningSnapshotField {
  fieldName: string;
  value: string;
  position?: FieldPosition;
  confidence?: number;
  detectionMethod?: string;
}

export interface LearningSnapshot {
  id: number;
  invoiceId: number;
  signature: DynamicSignature;
  detectedFields: LearningSnapshotField[];
  status: "PENDING" | "APPROVED" | "REJECTED" | "CONVERTED";
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface CreateSnapshotRequest {
  invoiceId: number;
  signatureType: "ice" | "if";
  signatureValue: string;
  fields: LearningSnapshotField[];
  userId?: string;
}

export interface CreateTemplateFromInvoiceRequest {
  invoiceId: number;
  ice?: string;
  ifNumber?: string;
  supplierName?: string;
  signatureType?: "ice" | "if";
}

export interface CreateTemplateFromInvoiceResponse {
  success: boolean;
  message: string;
  templateId: number;
  templateName: string;
  fieldsCount: number;
}

// ============================================
// TYPES DIVERS
// ============================================

export interface SearchCriteria {
  [key: string]: string;
}

export interface DashboardStats {
  totalInvoices: number;
  pendingInvoices: number;
  processedInvoices: number;
  validatedInvoices: number;
  errorInvoices: number;
  avgProcessingTime?: number;
}

// ============================================
// TYPES API (BACKEND)
// ============================================

export interface DynamicInvoiceDto {
  id: number;
  filename: string;
  originalName?: string;
  filePath: string;
  fileSize: number;
  extractedText?: string;
  headerRawText?: string;
  footerRawText?: string;
  rawOcrText?: string;
  cleanedOcrText?: string;
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
  clientValidated?: boolean;
  clientValidatedAt?: string;
  clientValidatedBy?: string;
  accounted?: boolean;
  accountedAt?: string;
  accountedBy?: string;
  isAvoir?: boolean;
  scanned?: boolean;
  documentType?: string;
  amountsValid?: boolean;
  validationMessage?: string;
  qualityScore?: number;
  difficultyClass?: string;
  qualityFlags?: string[];
  reviewRequired?: boolean;
  reviewReasons?: string[];
  fieldConfidences?: Record<string, number>;
  fieldSources?: Record<string, string>;
  olmocrUsed?: boolean;
  olmocrDurationMs?: number;
  olmocrMode?: string;
}

export interface DynamicInvoiceCreateResponseDto {
  message: string;
  invoice: DynamicInvoiceDto;
  missingFields: string[];
}

// ============================================
// CONSTANTES
// ============================================

export const STATUS_LABELS: Record<DynamicInvoiceStatus, string> = {
  VERIFY: "À vérifier",
  READY_TO_TREAT: "En attente",
  READY_TO_VALIDATE: "Prêt",
  VALIDATED: "Validé",
  ACCOUNTED: "Comptabilisé",
  REJECTED: "Rejeté",
  pending: "En attente",
  processing: "En cours",
  ready_to_validate: "Prêt",
  treated: "Traité",
  validated: "Validé",
  accounted: "Comptabilisé",
  error: "Erreur",
  to_verify: "À vérifier",
};

export const STATUS_COLORS: Record<DynamicInvoiceStatus, string> = {
  VERIFY: "bg-indigo-500",
  READY_TO_TREAT: "bg-yellow-500",
  READY_TO_VALIDATE: "bg-green-400",
  VALIDATED: "bg-green-600",
  ACCOUNTED: "bg-emerald-700",
  REJECTED: "bg-red-500",
  pending: "bg-yellow-500",
  processing: "bg-blue-500",
  ready_to_validate: "bg-green-400",
  treated: "bg-green-400",
  validated: "bg-green-600",
  accounted: "bg-emerald-700",
  error: "bg-red-500",
  to_verify: "bg-indigo-500",
};

export const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: "N° Facture",
  supplier: "Fournisseur",
  ice: "ICE",
  ifNumber: "IF",
  rcNumber: "RC",
  invoiceDate: "Date",
  amountHT: "Montant HT",
  tva: "TVA",
  amountTTC: "Montant TTC",
  amountTTCEnLettres: "Montant TTC en lettres",
};

// ============================================
// TYPES PATTERN MANAGEMENT
// ============================================

export type PatternStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DetectedFieldPattern {
  patternId: number;
  invoiceId: number;
  invoiceNumber?: string;
  fieldName: string;
  fieldLabel: string;
  patternText: string;
  fieldValue?: string;
  position?: FieldPosition;
  status: PatternStatus;
  detectedAt: Date | string;
  approvedAt?: Date | string;
  approvedBy?: string;
}

export interface PatternStatistics {
  totalPatterns: number;
  pendingPatterns: number;
  approvedPatterns: number;
  rejectedPatterns: number;
  approvalRate: number;
  patternsByField: Record<string, number>;
}
