export type {
  FieldPosition,
  BankStatementField,
  BankTransaction,
  BankTransactionPreview,
  BankTransactionV2,
  LocalBankStatement,
  BankStatementV2,
  BankOption,
} from "@/lib/types"

export interface JournalPeriod {
  year: number
  month: number
  key: string
}

export interface JournalItem {
  statementId: number
  originalName: string
  filename: string
  year: number
  month: number
  status?: string | null
  label: string
}

export interface JournalEntryRow {
  numero: number
  mois: string
  nmois: number
  date: string
  journal: string
  compte: string
  libelle: string
  debit: number
  credit: number
  sourceTransactionId?: number | null
  counterpart: boolean
}

export interface JournalAllEntriesResponse {
  entries: JournalEntryRow[]
  totalDebit: string
  totalCredit: string
  solde: string
  balanced: boolean
  count: number
  availableYears: number[]
  availableJournals: string[]
}
