import type { BankStatementV2, BankTransactionV2, Account } from "@/lib/types";

export const DEFAULT_COMPTE_CODE = "349700000";

export type TransactionEditableField =
  | "transactionIndex"
  | "dateOperation"
  | "dateValeur"
  | "compte"
  | "libelle"
  | "debit"
  | "credit";

export type NewTransactionForm = {
  transactionIndex: number;
  dateOperation: string;
  dateValeur: string;
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
};

export const EMPTY_NEW_TRANSACTION: NewTransactionForm = {
  transactionIndex: 1,
  dateOperation: "",
  dateValeur: "",
  compte: "",
  libelle: "",
  debit: 0,
  credit: 0,
};

export function normalizeBankStatus(status?: string): string {
  const normalized = String(status || "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase()
    .trim();

  if (
    normalized === "VALIDATED" ||
    normalized === "VALIDE" ||
    normalized === "VALIDEE" ||
    normalized === "VALIDEES"
  ) {
    return "VALIDATED";
  }
  if (normalized === "COMPTABILISE" || normalized === "ACCOUNTED") {
    return "COMPTABILISE";
  }
  if (normalized === "READY_TO_VALIDATE" || normalized === "PRET_A_VALIDER") {
    return "READY_TO_VALIDATE";
  }
  if (
    normalized === "TREATED" ||
    normalized === "TRAITE" ||
    normalized === "PROCESSED" ||
    normalized === "EXTRACTED"
  ) {
    return "READY_TO_VALIDATE";
  }
  if (normalized === "A_VERIFIER" || normalized === "VERIFY") {
    return "VERIFY";
  }
  if (normalized === "PENDING" || normalized === "EN_ATTENTE") {
    return "PENDING";
  }
  if (normalized === "PROCESSING" || normalized === "EN_COURS") {
    return "PROCESSING";
  }
  if (normalized === "ERROR" || normalized === "ERREUR") {
    return "ERROR";
  }
  if (normalized === "DUPLICATE") {
    return "DUPLIQUE";
  }
  return normalized;
}

export function isValidatedStatus(status?: string): boolean {
  const normalized = normalizeBankStatus(status);
  return normalized === "VALIDATED" || normalized === "VALIDE";
}

export function isAccountedStatus(status?: string): boolean {
  const normalized = normalizeBankStatus(status);
  return normalized.includes("COMPTABILIS");
}

export function isBankStatementOpenStatus(status?: string | null): boolean {
  const normalized = normalizeBankStatus(status || undefined);
  return [
    "PENDING",
    "PROCESSING",
    "VERIFY",
    "A_VERIFIER",
    "READY_TO_VALIDATE",
    "PRET_A_VALIDER",
    "TREATED",
    "TRAITE",
    "PROCESSED",
    "EXTRACTED",
    "EN_ATTENTE",
    "EN_COURS",
  ].includes(normalized);
}

export function isProcessingStatus(status?: string | null): boolean {
  return isBankStatementOpenStatus(status);
}

export function sortByIndex(items: BankTransactionV2[]): BankTransactionV2[] {
  return [...items].sort((a, b) => {
    const ia = a.transactionIndex ?? a.id;
    const ib = b.transactionIndex ?? b.id;
    return ia - ib;
  });
}

export function normalizeLibelle(value?: string | null): string {
  return (value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveDisplayCompte(value?: string | null): string {
  const compte = (value || "").trim();
  return compte === "" ? DEFAULT_COMPTE_CODE : compte;
}

export function isSelectedCompte(value?: string | null): boolean {
  return resolveDisplayCompte(value) !== DEFAULT_COMPTE_CODE;
}

export function isDefaultCompte(value?: string | null): boolean {
  return resolveDisplayCompte(value) === DEFAULT_COMPTE_CODE;
}

export function applyAutoComptePropagation(
  rows: BankTransactionV2[],
): BankTransactionV2[] {
  const learnedByLibelle = new Map<string, string>();

  for (const tx of rows) {
    const normalized = normalizeLibelle(tx.libelle);
    if (!normalized) continue;
    if (isSelectedCompte(tx.compte)) {
      learnedByLibelle.set(normalized, tx.compte.trim());
    }
  }

  return rows.map((tx) => {
    if (isSelectedCompte(tx.compte)) return tx;
    const learned = learnedByLibelle.get(normalizeLibelle(tx.libelle));
    if (!learned) return tx;
    return { ...tx, compte: learned, isLinked: true };
  });
}

export function buildLocalTransaction(
  statement: BankStatementV2,
  form: NewTransactionForm,
): BankTransactionV2 {
  const targetIndex = Math.max(1, Math.floor(form.transactionIndex || 1));
  const debit = Number(form.debit || 0);

  return {
    id: -Date.now(),
    statementId: statement.id,
    dateOperation: form.dateOperation,
    dateValeur: form.dateValeur,
    libelle: form.libelle,
    rib: statement.rib || null,
    debit,
    credit: Number(form.credit || 0),
    sens: debit > 0 ? "DEBIT" : "CREDIT",
    compte: form.compte,
    isLinked: false,
    categorie: "MANUAL",
    role: "MANUAL",
    extractionConfidence: 1,
    isValid: true,
    needsReview: false,
    reviewNotes: null,
    extractionErrors: null,
    lineNumber: targetIndex,
    transactionIndex: targetIndex,
  };
}

export function mapTransactionUpdatePayload(tx: BankTransactionV2): Partial<BankTransactionV2> {
  const debit = Number(tx.debit || 0);
  const selectedCompte = isSelectedCompte(tx.compte) ? tx.compte : "";

  return {
    transactionIndex: tx.transactionIndex,
    dateOperation: tx.dateOperation,
    dateValeur: tx.dateValeur,
    compte: selectedCompte,
    libelle: tx.libelle,
    debit,
    credit: Number(tx.credit || 0),
    sens: debit > 0 ? "DEBIT" : "CREDIT",
    isLinked: isSelectedCompte(tx.compte),
  };
}

export function mapTransactionCreatePayload(tx: BankTransactionV2): Partial<BankTransactionV2> {
  return {
    statementId: tx.statementId,
    transactionIndex: tx.transactionIndex,
    dateOperation: tx.dateOperation,
    dateValeur: tx.dateValeur,
    libelle: tx.libelle,
    compte: isSelectedCompte(tx.compte) ? tx.compte : "",
    categorie: tx.categorie,
    sens: tx.sens,
    debit: Number(tx.debit || 0),
    credit: Number(tx.credit || 0),
    isLinked: isSelectedCompte(tx.compte),
  };
}

export type BankDetailVmState = {
  transactions: BankTransactionV2[];
  editableTransactions: BankTransactionV2[];
  accounts: Account[];
};
