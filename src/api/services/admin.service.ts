import apiClient from "../api-client";
import { CreateComptableRequest, ComptableAdminDto, UserRole } from "@/src/types";

const LOCAL_CREATED_COMPTABLES_KEY = "created_comptables_cache";

export type AdminUserDto = {
    id: number;
    username: string;
    displayName?: string | null;
    role: UserRole;
    active: boolean;
};

type BackendDossier = {
    id: number;
    name: string;
    active?: boolean;
    comptableId?: number | null;
    clientId?: number | null;
    createdAt?: string;
    invoicesCount?: number;
    pendingInvoicesCount?: number;
    validatedInvoicesCount?: number;
};

let userCache: AdminUserDto[] | null = null;

function toComptableDto(user: AdminUserDto): ComptableAdminDto {
    return {
        id: user.id,
        username: user.username,
        email: user.username,
        displayName: user.displayName,
        role: "COMPTABLE",
        active: user.active,
    };
}

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

export class AdminService {
    static async createComptable(request: CreateComptableRequest): Promise<ComptableAdminDto> {
        const response = await apiClient.post<AdminUserDto>("/api/auth/users", {
            username: request.username,
            password: request.password,
            displayName: request.displayName ?? request.username,
            role: UserRole.COMPTABLE,
        });

        const created = toComptableDto(response.data);
        userCache = null; // invalidate cached users so lists refresh

        if (typeof window !== "undefined") {
            const raw = localStorage.getItem(LOCAL_CREATED_COMPTABLES_KEY);
            const current = raw ? (JSON.parse(raw) as ComptableAdminDto[]) : [];
            const deduped = [created, ...current.filter((c) => c.id !== created.id)];
            localStorage.setItem(LOCAL_CREATED_COMPTABLES_KEY, JSON.stringify(deduped));
        }

        return created;
    }

    static async listUsers(forceRefresh: boolean = false): Promise<AdminUserDto[]> {
        if (!forceRefresh && userCache) {
            return userCache;
        }

        const response = await apiClient.get<AdminUserDto[]>("/api/auth/users");
        const users = Array.isArray(response.data) ? response.data : [];
        userCache = users;
        return users;
    }

    static async listComptables(): Promise<ComptableAdminDto[]> {
        try {
            const users = await this.listUsers();
            return users.filter((user) => user.role === UserRole.COMPTABLE).map(toComptableDto);
        } catch {
            if (typeof window === "undefined") return [];
            const raw = localStorage.getItem(LOCAL_CREATED_COMPTABLES_KEY);
            return raw ? (JSON.parse(raw) as ComptableAdminDto[]) : [];
        }
    }

    static async listDossiers(): Promise<AdminDossierDto[]> {
        try {
            const [response, users] = await Promise.all([
                apiClient.get<BackendDossier[]>("/api/dossiers"),
                this.listUsers(),
            ]);

            const dossiers = Array.isArray(response.data) ? response.data : [];
            const userMap = new Map(users.map((user) => [user.id, user]));

            return dossiers.map((dossier) => ({
                id: dossier.id,
                name: dossier.name,
                status: dossier.active ? "ACTIVE" : "INACTIVE",
                comptableId: dossier.comptableId ?? null,
                comptableEmail: dossier.comptableId ? userMap.get(dossier.comptableId)?.username ?? null : null,
                fournisseurId: dossier.clientId ?? null,
                fournisseurEmail: dossier.clientId ? userMap.get(dossier.clientId)?.username ?? null : null,
                createdAt: dossier.createdAt,
                invoicesCount: dossier.invoicesCount ?? 0,
                pendingInvoicesCount: dossier.pendingInvoicesCount ?? 0,
                validatedInvoicesCount: dossier.validatedInvoicesCount ?? 0,
            }));
        } catch {
            return [];
        }
    }

    static async createFournisseurForComptable(payload: {
        fournisseurEmail: string;
        dossierNom: string;
        comptableId: number;
        fournisseurName?: string;
        fournisseurPassword?: string;
    }): Promise<Record<string, unknown>> {
        const displayName = payload.fournisseurName || payload.fournisseurEmail.split("@")[0] || payload.fournisseurEmail;
        const response = await apiClient.post<Record<string, unknown>>("/api/dossiers", {
            dossierName: payload.dossierNom,
            clientUsername: payload.fournisseurEmail,
            clientDisplayName: displayName,
            clientPassword: payload.fournisseurPassword || "ChangeMe123!",
            comptableId: payload.comptableId,
        });

        userCache = null;
        return response.data;
    }
}
