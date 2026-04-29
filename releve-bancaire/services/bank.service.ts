import apiClient from '@/src/api/api-client';
import { LocalBankStatement } from '@/releve-bancaire/types';

/**
 * Service for managing Bank Statements.
 */
export class BankService {
    static async upload(file: File): Promise<LocalBankStatement> {
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
        const response = await apiClient.get<{ statements: LocalBankStatement[] }>('/api/bank-statements', {
            params: { status, limit },
        });
        return response.data.statements || [];
    }

    static async getById(id: number): Promise<LocalBankStatement> {
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
