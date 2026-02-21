import apiClient from '../api-client';
import { DynamicTemplateDto, CreateDynamicTemplateRequest } from '@/src/types';
import { USE_MOCK } from '@/src/mock/data.mock';

/**
 * Service for managing OCR Templates.
 */
export class TemplateService {
    static async getAll(): Promise<DynamicTemplateDto[]> {
        if (USE_MOCK) return [{ id: 1, name: "Template Mock", supplierName: "Fournisseur A", fields: [] }] as any;
        const response = await apiClient.get<DynamicTemplateDto[]>('/api/dynamic-templates');
        return response.data;
    }

    static async getById(id: number): Promise<DynamicTemplateDto> {
        if (USE_MOCK) return { id, name: "Template Mock", supplierName: "Fournisseur A", fields: [] } as any;
        const response = await apiClient.get<DynamicTemplateDto>(`/api/dynamic-templates/${id}`);
        return response.data;
    }

    static async create(data: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
        const response = await apiClient.post<DynamicTemplateDto>('/api/dynamic-templates', data);
        return response.data;
    }

    static async update(id: number, data: CreateDynamicTemplateRequest): Promise<DynamicTemplateDto> {
        const response = await apiClient.put<DynamicTemplateDto>(`/api/dynamic-templates/${id}`, data);
        return response.data;
    }

    static async deactivate(id: number): Promise<void> {
        await apiClient.delete(`/api/dynamic-templates/${id}`);
    }

    static async search(name: string): Promise<DynamicTemplateDto[]> {
        const response = await apiClient.get<DynamicTemplateDto[]>('/api/dynamic-templates/search', {
            params: { name }
        });
        return response.data;
    }
}
