import { api } from "@/lib/api";
import type { BankTransactionV2 } from "@/lib/types";

export async function fetchBankStatementById(id: number) {
  return api.getBankStatementById(id);
}

export async function fetchBankTransactionsByStatementId(statementId: number) {
  return api.getTransactionsByStatementId(statementId);
}

export async function fetchAccounts() {
  return api.getAccounts(true);
}

export async function retryBankStatementPages(statementId: number) {
  return api.retryFailedBankStatementPages(statementId);
}

export async function updateBankTransaction(
  transactionId: number,
  payload: Partial<BankTransactionV2>,
) {
  return api.updateBankTransaction(transactionId, payload);
}

export async function createBankTransaction(payload: Partial<BankTransactionV2>) {
  return api.createBankTransaction(payload as any);
}

export async function validateBankStatement(statementId: number, fields: unknown[]) {
  return api.validateBankStatement(statementId, fields as any);
}
