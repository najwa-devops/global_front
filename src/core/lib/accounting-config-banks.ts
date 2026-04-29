import type { BankOption } from "@/lib/types";
import { api } from "@/lib/api";

function normalizeToken(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function prioritizeAutoFirst(codes: string[]): string[] {
  const uniqueCodes = Array.from(new Set(codes.filter(Boolean)));
  const autoCodes = uniqueCodes.filter((code) => code === "AUTO");
  const otherCodes = uniqueCodes.filter((code) => code !== "AUTO");
  return [...autoCodes, ...otherCodes];
}

function resolveAliasCode(token: string): string {
  if (
    token === "AUTO" ||
    token === "AUTOMATIQUE" ||
    token === "DETECTION AUTO" ||
    token === "DETECTION AUTOMATIQUE" ||
    token.includes("DETECTION") && token.includes("AUTO")
  ) {
    return "AUTO";
  }
  if (
    token === "BCP" ||
    token.includes("BANQUE POPULAIRE") ||
    token.includes("BANQUE CENTRALE POPULAIRE")
  ) {
    return "BCP";
  }
  if (token.includes("BANK OF AFRICA") || token === "BMCE") {
    return "BMCE";
  }
  if (token.includes("ATTIJARIWAFA") || token === "AWB") {
    return "ATTIJARIWAFA";
  }
  if (token === "CIH" || token.includes("CIH BANK")) {
    return "CIH";
  }
  if (token.includes("CREDIT DU MAROC")) {
    return "CREDIT_DU_MAROC";
  }
  if (token.includes("CREDIT AGRICOLE")) {
    return "CREDIT_AGRICOLE";
  }
  if (token.includes("AL BARID")) {
    return "BARID_BANK";
  }
  if (token.includes("SOCIETE GENERALE") || token.includes("SG MAROC") || token.includes("SGMB")) {
    return "SOCIETE_GENERALE";
  }
  if (token.includes("BMCI")) {
    return "BMCI";
  }
  return token.replace(/\s+/g, "_");
}

function buildBankCodeLookup(options: BankOption[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const option of options) {
    const code = String(option.code || "").trim().toUpperCase();
    if (!code) continue;

    const directVariants = [
      code,
      normalizeToken(option.code),
      normalizeToken(option.label),
    ].filter(Boolean);

    for (const variant of directVariants) {
      lookup.set(variant, code);
    }
  }

  for (const option of options) {
    const code = String(option.code || "").trim().toUpperCase();
    const mappedTo = normalizeToken(option.mappedTo);
    if (!code || !mappedTo || lookup.has(mappedTo)) {
      continue;
    }
    lookup.set(mappedTo, code);
  }

  return lookup;
}

function normalizeConfiguredBanks(rawBanks: unknown[], options: BankOption[]): string[] {
  const lookup = buildBankCodeLookup(options);
  const normalized = rawBanks
    .map((bank) => {
      const token = normalizeToken(bank);
      if (!token) return "";
      return lookup.get(token) || resolveAliasCode(token);
    })
    .filter(Boolean);
  return prioritizeAutoFirst(normalized);
}

export async function getConfiguredBankCodes(): Promise<string[]> {
  let bankOptions: BankOption[] = [];
  try {
    const bankOptionsResponse = await api.getBankOptions();
    bankOptions = Array.isArray(bankOptionsResponse?.options)
      ? bankOptionsResponse.options
      : [];
  } catch {
    bankOptions = [];
  }

  if (typeof window !== "undefined") {
    const savedBanks = window.localStorage.getItem("selected_banks_processing");
    if (savedBanks) {
      try {
        const parsed = JSON.parse(savedBanks);
        if (Array.isArray(parsed)) {
          const localBanks = normalizeConfiguredBanks(parsed, bankOptions);
          if (localBanks.length > 0) {
            return localBanks;
          }
        }
      } catch {
        // Ignore invalid localStorage payload and fallback to API.
      }
    }

    const legacy = String(
      window.localStorage.getItem("default_bank_processing") || "",
    )
      .trim();
    if (legacy) {
      return normalizeConfiguredBanks([legacy], bankOptions);
    }
  }

  try {
    const banks = await api.getAccountingConfigBanks();
    if (!Array.isArray(banks)) return [];
    return normalizeConfiguredBanks(banks, bankOptions);
  } catch {
    return [];
  }
}

export async function resolveBankOptionsFromAccountingConfig(
  allOptions: BankOption[],
): Promise<BankOption[]> {
  const configured = await getConfiguredBankCodes();
  const orderedAllOptions = prioritizeAutoFirst(
    allOptions.map((option) => String(option.code || "").trim().toUpperCase()),
  )
    .map((code) =>
      allOptions.find(
        (option) => String(option.code || "").trim().toUpperCase() === code,
      ),
    )
    .filter((option): option is BankOption => Boolean(option));

  if (configured.length === 0) {
    return orderedAllOptions.length > 0
      ? orderedAllOptions
      : [{ code: "AUTO", label: "Détection Automatique", mappedTo: "AUTO" }];
  }

  const byCode = new Map(
    orderedAllOptions.map((option) => [
      String(option.code || "").trim().toUpperCase(),
      option,
    ]),
  );

  return configured.map((code) => {
    const found = byCode.get(String(code || "").trim().toUpperCase());
    if (found) return found;
    return { code, label: code, mappedTo: code };
  });
}
