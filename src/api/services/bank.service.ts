import { api } from "@/lib/api";
import type { BankStatementV2 } from "@/lib/types";

/**
 * Legacy compatibility service for bank statements.
 * The source of truth now lives in the shared local API layer.
 */
export class BankService {
  static async upload(file: File): Promise<BankStatementV2> {
    return api.uploadBankStatement(file);
  }

  static async getAll(status?: string, limit = 50): Promise<BankStatementV2[]> {
    return api.getAllBankStatements({ status, limit });
  }

  static async getById(id: number): Promise<BankStatementV2> {
    return api.getBankStatementById(id);
  }

  static async validate(id: number, fields?: unknown): Promise<BankStatementV2> {
    return api.validateBankStatement(id, fields as any);
  }

  static async delete(id: number): Promise<void> {
    await api.deleteBankStatement(id);
  }
}
