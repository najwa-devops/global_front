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
  status: string
  structure: "AUTO" | "CMI" | "BARID_BANK" | string
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
