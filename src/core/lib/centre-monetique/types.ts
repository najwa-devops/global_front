export interface CentreMonetiqueExtractionRow {
  section: string
  date: string
  reference: string
  montant: string
  debit: string
  credit: string
  dc: string
  compteComptable?: string
}

export interface CentreMonetiqueBatchSummary {
  id: number
  filename: string
  originalName?: string
  rib?: string
  status: string
  structure: "AUTO" | "CMI" | "BARID_BANK" | "AMEX" | string
  statementPeriod?: string
  totalTransactions?: string
  totalMontant?: string
  totalCommissionHt?: string
  totalTvaSurCommissions?: string
  soldeNetRemise?: string
  totalDebit?: string
  totalCredit?: string
  transactionCount: number
  errorMessage?: string
  createdAt: string
  updatedAt?: string
  isLinkedToStatement?: boolean
  clientValidated?: boolean
  clientValidatedAt?: string
  clientValidatedBy?: string
}

export interface CentreMonetiqueBatchDetail extends CentreMonetiqueBatchSummary {
  rawOcrText?: string
  cleanedOcrText?: string
  rows: CentreMonetiqueExtractionRow[]
}

export interface CentreMonetiqueUploadResponse {
  success: boolean
  batch: CentreMonetiqueBatchDetail
  rows: CentreMonetiqueExtractionRow[]
  error?: string
  message?: string
}

export interface CentreMonetiqueRapprochementMatch {
  date: string
  cmReference: string
  cmMontant: string
  cmStan: string
  cmType: string
  cmMontantTransaction: string
  bankStatementName: string
  bankMontant: string
  bankLibelle: string
}

export interface CentreMonetiqueRapprochementResult {
  batchId: number
  batchRib: string
  totalCmTransactions: number
  matchedCount: number
  matches: CentreMonetiqueRapprochementMatch[]
}

export interface CmExpansionLine {
  date: string
  reference: string
  stan?: string
  dc: string
  dcFlag?: string
  montant: string
}

export interface CmExpansion {
  bankTransactionId: number
  cmBatchId: number
  cmBatchOriginalName: string
  cmReference: string
  cmMontant: string
  cmSubmissionAmount?: string
  commissionHt: string
  tvaSurCommissions: string
  lines: CmExpansionLine[]
}
