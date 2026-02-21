import apiClient from '../api-client';
import { Account, CreateAccountRequest, UpdateAccountRequest, Tier, CreateTierRequest, UpdateTierRequest } from '@/src/types';
import { USE_MOCK, MOCK_ACCOUNTS, MOCK_TIERS } from '@/src/mock/data.mock';

/**
 * Service for Accounting (Accounts & Tiers).
 */
export class AccountingService {
    // Accounts
    static async getAccounts(activeOnly = true): Promise<Account[]> {
        if (USE_MOCK) return MOCK_ACCOUNTS;
        const response = await apiClient.get<{ accounts: Account[] }>('/api/accounting/accounts', {
            params: { activeOnly }
        });
        return response.data.accounts || [];
    }

    static async getAccountById(id: number): Promise<Account> {
        if (USE_MOCK) return MOCK_ACCOUNTS.find(a => a.id === id) || MOCK_ACCOUNTS[0];
        const response = await apiClient.get<{ account: Account }>(`/api/accounting/accounts/${id}`);
        return response.data.account;
    }

    static async createAccount(data: CreateAccountRequest): Promise<Account> {
        if (USE_MOCK) return { id: Math.random(), ...data, active: true, classe: parseInt(data.code[0]) };
        const response = await apiClient.post<{ account: Account }>('/api/accounting/accounts', data);
        return response.data.account;
    }

    static async updateAccount(id: number, data: UpdateAccountRequest): Promise<Account> {
        if (USE_MOCK) {
            const original = MOCK_ACCOUNTS.find(a => a.id === id) || MOCK_ACCOUNTS[0];
            return { ...original, ...data, id };
        }
        const response = await apiClient.put<{ account: Account }>(`/api/accounting/accounts/${id}`, data);
        return response.data.account;
    }

    static async deactivateAccount(id: number): Promise<void> {
        if (USE_MOCK) return;
        await apiClient.delete(`/api/accounting/accounts/${id}`);
    }

    static async activateAccount(id: number): Promise<void> {
        if (USE_MOCK) return;
        await apiClient.patch(`/api/accounting/accounts/${id}/activate`);
    }

    // Tiers
    static async getAllTiers(activeOnly = true): Promise<Tier[]> {
        if (USE_MOCK) return MOCK_TIERS;
        const response = await apiClient.get<{ tiers: Tier[] }>('/api/accounting/tiers', {
            params: { activeOnly }
        });
        return response.data.tiers || [];
    }

    static async getTierById(id: number): Promise<Tier> {
        if (USE_MOCK) return MOCK_TIERS.find(t => t.id === id) || MOCK_TIERS[0];
        const response = await apiClient.get<{ tier: Tier }>(`/api/accounting/tiers/${id}`);
        return response.data.tier;
    }

    static async createTier(data: CreateTierRequest): Promise<Tier> {
        if (USE_MOCK) return { id: Math.random(), ...data, active: true, hasAccountingConfig: true, auxiliaireMode: data.auxiliaireMode ?? false };
        const response = await apiClient.post<{ tier: Tier }>('/api/accounting/tiers', data);
        return response.data.tier;
    }

    static async updateTier(id: number, data: UpdateTierRequest): Promise<Tier> {
        if (USE_MOCK) {
            const original = MOCK_TIERS.find(t => t.id === id) || MOCK_TIERS[0];
            return { ...original, ...data, id };
        }
        const response = await apiClient.put<{ tier: Tier }>(`/api/accounting/tiers/${id}`, data);
        return response.data.tier;
    }

    static async deactivateTier(id: number): Promise<void> {
        if (USE_MOCK) return;
        await apiClient.delete(`/api/accounting/tiers/${id}`);
    }
}
