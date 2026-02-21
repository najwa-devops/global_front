'use client';

import { useAuth } from "@/hooks/use-auth";
import { useDossier } from "@/src/contexts/dossier-context";
import { GLOBAL_NAV_CONFIG, getDossierNavConfig, NavItemConfig } from "@/src/config/navigation.config";

export function useNavigation() {
    const { user, authenticated } = useAuth();
    const { currentDossier } = useDossier();

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

    // Si on est dans un dossier, on renvoie la config contextuelle filtrée
    if (currentDossier) {
        const dossierItems = getDossierNavConfig(currentDossier.id);
        return {
            items: filterByRole(dossierItems),
            mode: 'dossier' as const,
            dossier: currentDossier
        };
    }

    // Sinon, config globale selon le rôle (déjà filtrée par objet GLOBAL_NAV_CONFIG)
    const items = GLOBAL_NAV_CONFIG[user.role] || [];

    return {
        items,
        mode: 'global' as const,
        user
    };
}
