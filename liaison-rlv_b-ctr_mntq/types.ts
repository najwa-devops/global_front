export interface CmExpansionLine {
  date: string
  stan: string
  dcFlag: string
  montant: string
}

export interface CmExpansion {
  bankTransactionId: number
  cmBatchId: number
  cmBatchOriginalName: string
  cmReference: string
  cmMontant: string
  commissionHt: string
  tvaSurCommissions: string
  cmSubmissionAmount: string
  lines: CmExpansionLine[]
}

export interface RapprochementMatch {
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

export interface RapprochementResult {
  batchId: number
  batchRib: string
  totalCmTransactions: number
  matchedCount: number
  matches: RapprochementMatch[]
}
