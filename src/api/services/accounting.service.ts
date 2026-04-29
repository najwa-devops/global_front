import apiClient from '../api-client';
import { Account, CreateAccountRequest, UpdateAccountRequest, Tier, CreateTierRequest, UpdateTierRequest } from '@/src/types';

/**
 * Service for Accounting (Accounts & Tiers).
 */
export class AccountingService {
    private static getCurrentDossierId(): number | undefined {
        if (typeof window === 'undefined') return undefined;
        const raw = window.localStorage.getItem('currentDossierId');
        const id = Number(raw);
        return Number.isFinite(id) && id > 0 ? id : undefined;
    }

    // Accounts
    static async getAccounts(activeOnly = true): Promise<Account[]> {
        const response = await apiClient.get<{ accounts: Account[] }>('/api/v2/accounting/accounts', {
            params: { activeOnly }
        });
        return response.data.accounts || [];
    }

    static async getAccountOptions(): Promise<Account[]> {
        try {
            const response = await apiClient.get<{ accounts: Array<{ code: string; libelle: string }> }>('/api/v2/accounting/accounts/options');
            return (response.data.accounts || []).map((account, index) => ({
                id: index + 1,
                code: account.code,
                libelle: account.libelle,
                classe: Number(account.code?.charAt(0) || 0),
                active: true,
            } as Account));
        } catch {
            return this.getAccounts(true);
        }
    }

    static async getAccountById(id: number): Promise<Account> {
        const response = await apiClient.get<{ account: Account }>(`/api/accounting/accounts/${id}`);
        return response.data.account;
    }

    static async createAccount(data: CreateAccountRequest): Promise<Account> {
        const response = await apiClient.post<{ account: Account }>('/api/accounting/accounts', data);
        return response.data.account;
    }

    static async updateAccount(id: number, data: UpdateAccountRequest): Promise<Account> {
        const response = await apiClient.put<{ account: Account }>(`/api/accounting/accounts/${id}`, data);
        return response.data.account;
    }

    static async deactivateAccount(id: number): Promise<void> {
        await apiClient.delete(`/api/accounting/accounts/${id}`);
    }

    static async activateAccount(id: number): Promise<void> {
        await apiClient.patch(`/api/accounting/accounts/${id}/activate`);
    }

    // Tiers
    static async getAllTiers(activeOnly = true): Promise<Tier[]> {
        const dossierId = this.getCurrentDossierId();
        const response = await apiClient.get<{ tiers: Tier[] }>('/api/accounting/tiers', {
            params: { activeOnly, dossierId }
        });
        return response.data.tiers || [];
    }

    static async getTierById(id: number): Promise<Tier> {
        const dossierId = this.getCurrentDossierId();
        const response = await apiClient.get<{ tier: Tier }>(`/api/accounting/tiers/${id}`, {
            params: { dossierId }
        });
        return response.data.tier;
    }

    static async createTier(data: CreateTierRequest): Promise<Tier> {
        const dossierId = this.getCurrentDossierId();
        const payload = this.normalizeTierPayload(data);
        const response = await apiClient.post<{ tier: Tier }>('/api/accounting/tiers', payload, {
            params: { dossierId }
        });
        return response.data.tier;
    }

    static async updateTier(id: number, data: UpdateTierRequest): Promise<Tier> {
        const dossierId = this.getCurrentDossierId();
        const payload = this.normalizeTierPayload(data);
        const response = await apiClient.put<{ tier: Tier }>(`/api/accounting/tiers/${id}`, payload, {
            params: { dossierId }
        });
        return response.data.tier;
    }

    static async deactivateTier(id: number): Promise<void> {
        const dossierId = this.getCurrentDossierId();
        await apiClient.delete(`/api/accounting/tiers/${id}`, {
            params: { dossierId }
        });
    }

    private static normalizeTierPayload<T extends CreateTierRequest | UpdateTierRequest>(data: T): T {
        const normalizeCode = (value?: string) => {
            if (value == null) return undefined;
            const normalized = value.trim().replace(/\s+/g, '');
            return normalized.length > 0 ? normalized.toUpperCase() : undefined;
        };
        const normalizeIdentifier = (value?: string) => {
            if (value == null) return undefined;
            const normalized = value.trim().replace(/\s+/g, '');
            return normalized.length > 0 ? normalized : undefined;
        };
        const normalizeText = (value?: string) => {
            if (value == null) return undefined;
            const normalized = value.trim();
            return normalized.length > 0 ? normalized : undefined;
        };

        return {
            ...data,
            libelle: normalizeText(data.libelle),
            activity: normalizeText(data.activity),
            tierNumber: normalizeCode(data.tierNumber),
            collectifAccount: normalizeCode(data.collectifAccount),
            ifNumber: normalizeIdentifier(data.ifNumber),
            ice: normalizeIdentifier(data.ice),
            rcNumber: normalizeIdentifier(data.rcNumber),
            defaultChargeAccount: normalizeCode(data.defaultChargeAccount),
            tvaAccount: normalizeCode(data.tvaAccount),
        } as T;
    }
}
