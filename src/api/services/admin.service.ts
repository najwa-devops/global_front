import apiClient from "../api-client";
import { CreateComptableRequest, ComptableAdminDto } from "@/src/types";

const LOCAL_CREATED_COMPTABLES_KEY = "created_comptables_cache";

export type AdminDossierDto = {
    id: number;
    name: string;
    status?: string;
    comptableId?: number | null;
    comptableEmail?: string | null;
    fournisseurId?: number | null;
    fournisseurEmail?: string | null;
    createdAt?: string;
    invoicesCount?: number;
    pendingInvoicesCount?: number;
    validatedInvoicesCount?: number;
};

export type AdminDashboardDto = {
    usersCount: number;
    comptablesCount: number;
    dossiersCount: number;
    users: Array<Record<string, unknown>>;
    comptables: ComptableAdminDto[];
    dossiers: AdminDossierDto[];
};

export class AdminService {
    static async createComptable(request: CreateComptableRequest): Promise<ComptableAdminDto> {
        const response = await apiClient.post<ComptableAdminDto>("/api/admin/comptables", request);
        if (typeof window !== "undefined") {
            const raw = localStorage.getItem(LOCAL_CREATED_COMPTABLES_KEY);
            const current = raw ? (JSON.parse(raw) as ComptableAdminDto[]) : [];
            const deduped = [response.data, ...current.filter((c) => c.id !== response.data.id)];
            localStorage.setItem(LOCAL_CREATED_COMPTABLES_KEY, JSON.stringify(deduped));
        }
        return response.data;
    }

    static async listComptables(): Promise<ComptableAdminDto[]> {
        try {
            const response = await apiClient.get<{ count?: number; comptables?: ComptableAdminDto[] } | ComptableAdminDto[]>(
                "/api/admin/comptables"
            );

            if (Array.isArray(response.data)) {
                return response.data;
            }

            return response.data?.comptables ?? [];
        } catch {
            // Backward-compatible fallback for older backend versions.
            try {
                const response = await apiClient.get<{ count?: number; users?: ComptableAdminDto[] } | ComptableAdminDto[]>(
                    "/api/admin/users",
                    { params: { role: "COMPTABLE" } }
                );
                if (Array.isArray(response.data)) {
                    return response.data;
                }
                return response.data?.users ?? [];
            } catch {
                if (typeof window === "undefined") return [];
                const raw = localStorage.getItem(LOCAL_CREATED_COMPTABLES_KEY);
                return raw ? (JSON.parse(raw) as ComptableAdminDto[]) : [];
            }
        }
    }

    static async listDossiers(): Promise<AdminDossierDto[]> {
        const response = await apiClient.get<{ count?: number; dossiers?: AdminDossierDto[] } | AdminDossierDto[]>(
            "/api/admin/dossiers"
        );

        if (Array.isArray(response.data)) {
            return response.data;
        }

        return response.data?.dossiers ?? [];
    }

    static async getDashboard(): Promise<AdminDashboardDto> {
        try {
            const response = await apiClient.get<AdminDashboardDto>("/api/admin/dashboard");
            return response.data;
        } catch {
            return {
                usersCount: 0,
                comptablesCount: 0,
                dossiersCount: 0,
                users: [],
                comptables: [],
                dossiers: [],
            };
        }
    }

    static async createFournisseurForComptable(payload: {
        fournisseurEmail: string;
        dossierNom: string;
        comptableId: number;
    }): Promise<Record<string, unknown>> {
        const response = await apiClient.post<Record<string, unknown>>("/api/admin/fournisseurs", payload);
        return response.data;
    }
}
