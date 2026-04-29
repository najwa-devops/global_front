'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Dossier } from '@/src/types/dossier';
import apiClient from '@/src/api/api-client';

interface DossierContextType {
    currentDossier: Dossier | null;
    isLoading: boolean;
    refreshDossier: () => void;
}

const DossierContext = createContext<DossierContextType | undefined>(undefined);

function mapBackendDossier(raw: any): Dossier {
    return {
        id: raw.id,
        name: raw.name,
        fournisseur: {
            id: raw.fournisseurId ?? 0,
            name: raw.fournisseurEmail ?? "Fournisseur",
            email: raw.fournisseurEmail ?? "",
        },
        comptableId: raw.comptableId ?? 0,
        comptableName: raw.comptableEmail ?? "",
        invoicesCount: raw.invoicesCount ?? 0,
        bankStatementsCount: raw.bankStatementsCount ?? 0,
        centreMonetiqueCount: raw.centreMonetiqueCount ?? 0,
        pendingInvoicesCount: raw.pendingInvoicesCount ?? 0,
        validatedInvoicesCount: raw.validatedInvoicesCount ?? 0,
        status: String(raw.status || "ACTIVE").toUpperCase() === "ARCHIVED" ? "inactive" : "active",
        createdAt: raw.createdAt ?? new Date().toISOString(),
    };
}

async function fetchDossierById(dossierId: number): Promise<Dossier | null> {
    try {
        const response = await apiClient.get<{ dossiers?: any[]; count?: number }>('/api/dossiers');
        const dossiers = response.data?.dossiers || [];
        const dossier = dossiers.find((d: any) => d.id === dossierId);
        return dossier ? mapBackendDossier(dossier) : null;
    } catch {
        return null;
    }
}

async function fetchFirstActiveDossier(): Promise<Dossier | null> {
    try {
        const response = await apiClient.get<{ dossiers?: any[]; count?: number }>('/api/dossiers');
        const dossiers = response.data?.dossiers || [];
        const active = dossiers.find((d: any) => String(d.status || "ACTIVE").toUpperCase() !== "ARCHIVED");
        return active ? mapBackendDossier(active) : null;
    } catch {
        return null;
    }
}

export function DossierProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [currentDossier, setCurrentDossier] = useState<Dossier | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isDossierScopedPath = (path: string) => {
        return (
            path === "/client/dashboard" ||
            path === "/achat/upload" ||
            path === "/achat/invoices" ||
            path === "/achat/validated" ||
            path.startsWith("/achat/ocr/") ||
            path === "/vente/upload" ||
            path === "/vente/invoices" ||
            path === "/vente/scanned" ||
            path === "/vente/validated" ||
            path === "/vente/accounted" ||
            path === "/vente/journal" ||
            path.startsWith("/vente/ocr/") ||
            path.startsWith("/bank/") ||
            path.startsWith("/settings/") ||
            path === "/achat/templates" ||
            path === "/patterns"
        );
    };

    useEffect(() => {
        let mounted = true;

        const syncCurrentDossier = async () => {
            const match = pathname.match(/^\/dossiers\/(\d+)/);
            const dossierId = match ? parseInt(match[1], 10) : null;
            const scopedPath = Boolean(dossierId) || isDossierScopedPath(pathname);

            if (!scopedPath) {
                setCurrentDossier(null);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                let dossier: Dossier | null = null;

                if (dossierId) {
                    dossier = await fetchDossierById(dossierId);
                } else if (typeof window !== 'undefined') {
                    const storedDossierId = Number(localStorage.getItem('currentDossierId'));
                    if (Number.isFinite(storedDossierId) && storedDossierId > 0) {
                        dossier = await fetchDossierById(storedDossierId);
                    }
                    if (!dossier) {
                        dossier = await fetchFirstActiveDossier();
                    }
                }

                if (mounted) setCurrentDossier(dossier);
                if (typeof window !== 'undefined' && dossier) {
                    localStorage.setItem('currentDossierId', String(dossier.id));
                    localStorage.setItem('currentDossierName', dossier.name);
                }
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        syncCurrentDossier();

        return () => {
            mounted = false;
        };
    }, [pathname]);

    const refreshDossier = async () => {
        if (currentDossier) {
            const freshData = await fetchDossierById(currentDossier.id);
            setCurrentDossier(freshData);
        }
    };

    return (
        <DossierContext.Provider value={{ currentDossier, isLoading, refreshDossier }}>
            {children}
        </DossierContext.Provider>
    );
}

export function useDossier() {
    const context = useContext(DossierContext);
    if (context === undefined) {
        throw new Error('useDossier must be used within a DossierProvider');
    }
    return context;
}
