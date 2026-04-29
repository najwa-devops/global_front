import apiClient from '../api-client';
import {
    InvoiceDto,
    DynamicExtractionResponse,
} from '@/src/types';

/**
 * Service for managing Invoices.
 * Handles uploads, processing, and validation.
 */
export class InvoiceService {
    static async upload(file: File): Promise<InvoiceDto> {
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
        const response = await apiClient.get<InvoiceDto>(`/api/dynamic-invoices/${id}`);
        return response.data;
    }

    static async getAll(status?: string, templateId?: number, limit = 50): Promise<InvoiceDto[]> {
        const response = await apiClient.get<{ invoices: InvoiceDto[] }>('/api/dynamic-invoices', {
            params: { status, templateId, limit },
        });
        return response.data.invoices || [];
    }

    static async validate(id: number): Promise<InvoiceDto> {
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
        const normalized = String(status || "").toUpperCase();
        if (normalized === "READY_TO_TREAT") {
            return apiClient.post(`/api/dynamic-invoices/${id}/client-validate`);
        }
        throw new Error("Backend does not expose generic invoice status update endpoint");
    }
}
