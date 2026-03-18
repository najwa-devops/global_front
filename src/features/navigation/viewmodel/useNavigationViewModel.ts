'use client';

import { useAuth } from "@/hooks/use-auth";
import { useDossier } from "@/src/contexts/dossier-context";
import {
  GLOBAL_NAV_CONFIG,
  getDossierNavConfig,
  NavItemConfig,
} from "@/src/features/navigation/model/navigation.config";
import { Dossier } from "@/src/types/dossier";
import { usePathname } from "next/navigation";
import {
  detectDossierIdFromPath,
  detectStoredDossierId,
  detectStoredDossierName,
} from "@/src/features/navigation/model/navigation.model";

function filterByRole(items: NavItemConfig[], role: string): NavItemConfig[] {
  return items
    .filter((item) => {
      if (role === "FOURNISSEUR") {
        const href = item.href || "";
        if (item.id === "bank" || item.id === "global-bank" || href.startsWith("/bank") || href === "/centre-monetique") {
          return false;
        }
      }
      return !item.roles || item.roles.includes(role as any);
    })
    .map((item) => ({
      ...item,
      children: item.children ? filterByRole(item.children, role) : undefined,
    }));
}

export function useNavigationViewModel() {
  const { user, authenticated } = useAuth();
  const { currentDossier } = useDossier();
  const pathname = usePathname();

  if (!authenticated || !user) {
    return { items: [] as NavItemConfig[], mode: "anonymous" as const };
  }

  const pathDossierId = detectDossierIdFromPath(pathname);
  const fallbackDossierId = pathDossierId ?? detectStoredDossierId();

  if (currentDossier || fallbackDossierId) {
    const dossierId = currentDossier?.id ?? fallbackDossierId!;
    const dossierName =
      currentDossier?.name ?? detectStoredDossierName() ?? `Dossier #${dossierId}`;
    const dossierFallback: Dossier =
      currentDossier ?? {
        id: dossierId,
        name: dossierName,
        fournisseur: { id: 0, name: "", email: "" },
        comptableId: 0,
        comptableName: "",
        invoicesCount: 0,
        bankStatementsCount: 0,
        pendingInvoicesCount: 0,
        validatedInvoicesCount: 0,
        status: "active",
        createdAt: new Date().toISOString(),
      };

    return {
      items: filterByRole(getDossierNavConfig(dossierId), user.role),
      mode: "dossier" as const,
      dossier: dossierFallback,
      user,
    };
  }

  const items = (GLOBAL_NAV_CONFIG[user.role] || []).filter(
    (item) => item.id !== "global-billing" && item.id !== "global-bank",
  );

  return {
    items,
    mode: "global" as const,
    user,
  };
}
