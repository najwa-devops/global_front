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
        // No audit endpoint is exposed by the current backend controllers.
        return [];
    }
}
