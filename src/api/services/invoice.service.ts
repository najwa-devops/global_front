import apiClient from '../api-client';
import {
    InvoiceDto,
    DynamicExtractionResponse,
} from '@/src/types';
import { USE_MOCK, MOCK_INVOICES_BY_DOSSIER } from '@/src/mock/data.mock';

/**
 * Service for managing Invoices.
 * Handles uploads, processing, and validation.
 */
export class InvoiceService {
    static async upload(file: File): Promise<InvoiceDto> {
        if (USE_MOCK) {
            return {
                id: Math.floor(Math.random() * 1000) + 2000,
                filename: file.name,
                status: "pending",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                fieldsData: {
                    invoiceNumber: "PENDING-" + Math.floor(Math.random() * 1000),
                    supplier: "Nouveau Fournisseur",
                    amountTTC: 0
                }
            } as any;
        }
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<InvoiceDto>('/api/dynamic-invoices/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    static async getById(id: number): Promise<InvoiceDto> {
        if (USE_MOCK) {
            const allMock = Object.values(MOCK_INVOICES_BY_DOSSIER).flat();
            const inv = allMock.find(i => i.id === id);
            if (inv) return inv as any;
            return allMock[0] as any;
        }
        const response = await apiClient.get<InvoiceDto>(`/api/dynamic-invoices/${id}`);
        return response.data;
    }

    static async getAll(status?: string, templateId?: number, limit = 50): Promise<InvoiceDto[]> {
        if (USE_MOCK) {
            return Object.values(MOCK_INVOICES_BY_DOSSIER).flat() as any;
        }
        const response = await apiClient.get<{ invoices: InvoiceDto[] }>('/api/dynamic-invoices', {
            params: { status, templateId, limit },
        });
        return response.data.invoices || [];
    }

    static async validate(id: number): Promise<InvoiceDto> {
        if (USE_MOCK) return {} as any;
        const response = await apiClient.post<InvoiceDto>(`/api/dynamic-invoices/${id}/validate`);
        return response.data;
    }

    static async updateFields(id: number, fields: Record<string, any>): Promise<InvoiceDto> {
        const response = await apiClient.put<InvoiceDto>(`/api/dynamic-invoices/${id}/fields`, fields);
        return response.data;
    }

    static async process(id: number): Promise<InvoiceDto> {
        const response = await apiClient.post<InvoiceDto>(`/api/dynamic-invoices/${id}/process`);
        return response.data;
    }

    static async extractWithTemplate(invoiceId: number, templateId?: number): Promise<DynamicExtractionResponse> {
        if (USE_MOCK) return { success: true, message: "Extraction réussie (Mock)" } as any;
        const response = await apiClient.post<DynamicExtractionResponse>(
            `/api/dynamic-templates/extract/${invoiceId}`,
            null,
            { params: { templateId } }
        );
        return response.data;
    }

    static async delete(id: number): Promise<void> {
        await apiClient.delete(`/api/dynamic-invoices/${id}`);
    }

    static async updateInvoiceStatus(id: number | string, status: string): Promise<any> {
        if (USE_MOCK) {
            console.log(`[Mock] Updating invoice ${id} status to ${status}`)
            return { success: true }
        }
        return apiClient.put(`/api/dynamic-invoices/${id}/status`, { status })
    }
}
