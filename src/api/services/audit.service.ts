import apiClient from '../api-client';

export interface AuditLogEntry {
    id: number;
    userId: number;
    userName: string;
    userRole: string;
    action: string;
    resource: string;
    resourceId?: number;
    details?: string;
    timestamp: string;
    ip?: string;
}

export class AuditService {
    static async list(): Promise<AuditLogEntry[]> {
        const response = await apiClient.get<{ logs?: AuditLogEntry[] } | AuditLogEntry[]>('/api/admin/audit/logs');
        if (Array.isArray(response.data)) {
            return response.data;
        }
        return response.data?.logs ?? [];
    }
}
