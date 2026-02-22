'use client';

import { useAuth } from "@/hooks/use-auth";
import { useDossier } from "@/src/contexts/dossier-context";
import { GLOBAL_NAV_CONFIG, getDossierNavConfig, NavItemConfig } from "@/src/config/navigation.config";
import { Dossier } from "@/src/types/dossier";
import { usePathname } from "next/navigation";

export function useNavigation() {
    const { user, authenticated } = useAuth();
    const { currentDossier } = useDossier();
    const pathname = usePathname();

    if (!authenticated || !user) {
        return { items: [] as NavItemConfig[], mode: 'anonymous' as const };
    }

    // Fonction pour filtrer récursivement les items par rôle
    const filterByRole = (items: NavItemConfig[]): NavItemConfig[] => {
        return items
            .filter(item => !item.roles || item.roles.includes(user.role))
            .map(item => ({
                ...item,
                children: item.children ? filterByRole(item.children) : undefined
            }));
    };

    const detectDossierId = (): number | null => {
        const match = pathname.match(/^\/dossiers\/(\d+)/);
        if (match) return Number(match[1]);

        if (typeof window !== 'undefined') {
            const stored = Number(localStorage.getItem('currentDossierId'));
            if (Number.isFinite(stored) && stored > 0) return stored;
        }
        return null;
    };

    const isDossierScopedPath = () => {
        const dossierPaths = [
            "/upload",
            "/invoices",
            "/validated",
            "/client-pending",
            "/accounted",
            "/comptability",
            "/bank",
            "/bank/upload",
            "/bank/list",
            "/bank/validated",
            "/settings/accounting",
            "/settings/patterns",
            "/templates"
        ];
        return dossierPaths.some(path => pathname === path || pathname.startsWith(path + "/"));
    };

    const fallbackDossierId = detectDossierId();

    // Si on est dans un dossier (id détecté), on renvoie la config contextuelle filtrée
    if (currentDossier || fallbackDossierId) {
        const dossierId = currentDossier?.id ?? fallbackDossierId!;
        const dossierFallback: Dossier = currentDossier ?? {
            id: dossierId,
            name: "Dossier",
            fournisseur: { id: 0, name: "", email: "" },
            comptableId: 0,
            comptableName: "",
            invoicesCount: 0,
            bankStatementsCount: 0,
            pendingInvoicesCount: 0,
            validatedInvoicesCount: 0,
            status: "active",
            createdAt: new Date().toISOString()
        };

        const dossierItems = getDossierNavConfig(dossierId);
        return {
            items: filterByRole(dossierItems),
            mode: 'dossier' as const,
            dossier: dossierFallback,
            user
        };
    }

    // Sinon, config globale selon le rôle (déjà filtrée par objet GLOBAL_NAV_CONFIG)
    const items = (GLOBAL_NAV_CONFIG[user.role] || []).filter(
        // Hide billing/bank menus when no dossier is selected
        item => item.id !== "global-billing" && item.id !== "global-bank"
    );

    return {
        items,
        mode: 'global' as const,
        user
    };
}
