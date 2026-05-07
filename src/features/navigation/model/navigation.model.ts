const DOSSIER_SCOPED_PATHS = [
  "/client/dashboard",
  "/achat/upload",
  "/achat/invoices",
  "/achat/validated",
  "/achat/client-pending",
  "/achat/accounted",
  "/achat/ocr",
  "/vente/upload",
  "/vente/invoices",
  "/vente/scanned",
  "/vente/validated",
  "/vente/accounted",
  "/vente/journal",
  "/vente/ocr",
  "/comptability",
  "/bank",
  "/bank/upload",
  "/bank/list",
  "/bank/accounted",
  "/journal",
  "/centre-monetique",
  "/settings/general",
  "/settings/bank",
  "/settings/accounting",
  "/settings/patterns",
  "/achat/templates",
];

export function detectDossierIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/dossiers\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function detectStoredDossierId(): number | null {
  if (typeof window === "undefined") return null;
  const stored = Number(localStorage.getItem("currentDossierId"));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

export function detectStoredDossierName(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("currentDossierName");
  return stored && stored.trim().length > 0 ? stored : null;
}

export function isDossierScopedPath(pathname: string): boolean {
  return DOSSIER_SCOPED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
