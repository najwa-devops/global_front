import type { BankOption } from "@/releve-bancaire/types"
import { api } from "@/lib/api"

export async function getConfiguredBankCodes(): Promise<string[]> {
  try {
    const banks = await api.getAccountingConfigBanks()
    if (!Array.isArray(banks)) return []
    return banks
      .map((b) => String(b || "").trim().toUpperCase())
      .filter((b) => b && b !== "AUTO")
  } catch {
    return []
  }
}

export async function resolveBankOptionsFromAccountingConfig(allOptions: BankOption[]): Promise<BankOption[]> {
  const configured = await getConfiguredBankCodes()
  if (configured.length === 0) {
    return [{ code: "AUTO", label: "Détection Automatique", mappedTo: "AUTO" }]
  }
  const byCode = new Map(allOptions.map((o) => [o.code, o]))
  return configured.map((code) => {
    const found = byCode.get(code)
    if (found) return found
    return { code, label: code, mappedTo: code }
  })
}
