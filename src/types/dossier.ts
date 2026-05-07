// ============================================
// DOSSIER TYPES
// ============================================

export interface Dossier {
    id: number
    name: string
    ice?: string
    fournisseur: {
        id: number
        name: string
        email: string
    }
    comptableId: number
    comptableName: string
    invoicesCount: number
    bankStatementsCount: number
    centreMonetiqueCount: number
    pendingInvoicesCount: number
    pendingDocumentsCount?: number
    validatedInvoicesCount: number
    validatedBankStatementsCount?: number
    validatedDocumentsCount?: number
    status: "active" | "inactive"
    createdAt: string
    exerciseStartDate?: string
    exerciseEndDate?: string
}

export interface CreateDossierRequest {
    name: string
    fournisseurEmail: string
    fournisseurName: string
    ice: string
    fournisseurPassword?: string | undefined
    exerciseStartDate: string
    exerciseEndDate: string
}

export interface ComptableUser {
    id: number
    name: string
    email: string
    role: "COMPTABLE"
    dossiersCount: number
    fournisseursCount: number
    invoicesCount: number
    createdAt: string
    active: boolean
}

export interface AuditLog {
    id: number
    userId: number
    userName: string
    userRole: string
    action: string
    resource: string
    resourceId?: number
    details?: string
    timestamp: string
    ip?: string
}
