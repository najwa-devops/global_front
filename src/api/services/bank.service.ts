import apiClient from '../api-client';
import { LocalBankStatement } from '@/src/types';
import { USE_MOCK, MOCK_BANK_STATEMENTS_BY_DOSSIER } from '@/src/mock/data.mock';

/**
 * Service for managing Bank Statements.
 */
export class BankService {
    static async upload(file: File): Promise<LocalBankStatement> {
        if (USE_MOCK) {
            return {
                id: Math.floor(Math.random() * 1000) + 3000,
                filename: file.name,
                period: "Mock Period",
                status: "pending",
                uploadedAt: new Date().toISOString()
            } as any;
        }
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<LocalBankStatement>('/api/bank-statements/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    static async getAll(status?: string, limit = 50): Promise<LocalBankStatement[]> {
        if (USE_MOCK) {
            return Object.values(MOCK_BANK_STATEMENTS_BY_DOSSIER).flat() as any;
        }
        const response = await apiClient.get<{ statements: LocalBankStatement[] }>('/api/bank-statements', {
            params: { status, limit },
        });
        return response.data.statements || [];
    }

    static async getById(id: number): Promise<LocalBankStatement> {
        if (USE_MOCK) {
            const allMock = Object.values(MOCK_BANK_STATEMENTS_BY_DOSSIER).flat();
            return (allMock.find(s => s.id === id) || allMock[0]) as any;
        }
        const response = await apiClient.get<LocalBankStatement>(`/api/bank-statements/${id}`);
        return response.data;
    }

    static async validate(id: number, fields: any): Promise<LocalBankStatement> {
        const response = await apiClient.post<LocalBankStatement>(`/api/bank-statements/${id}/validate`, fields);
        return response.data;
    }

    static async delete(id: number): Promise<void> {
        await apiClient.delete(`/api/bank-statements/${id}`);
    }
}
