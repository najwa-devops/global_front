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
        const response = await apiClient.get<{ accounts: Account[] }>('/api/accounting/accounts', {
            params: { activeOnly }
        });
        return response.data.accounts || [];
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
        const response = await apiClient.post<{ tier: Tier }>('/api/accounting/tiers', data, {
            params: { dossierId }
        });
        return response.data.tier;
    }

    static async updateTier(id: number, data: UpdateTierRequest): Promise<Tier> {
        const dossierId = this.getCurrentDossierId();
        const response = await apiClient.put<{ tier: Tier }>(`/api/accounting/tiers/${id}`, data, {
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
}
