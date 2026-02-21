import { Dossier, ComptableUser, AuditLog } from "@/src/types/dossier"
import { Account, Tier, User } from "@/src/types"

// flag global pour forcer le mode mock statique
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ============================================
// MOCK COMPTABLES
// ============================================
export const MOCK_COMPTABLES: ComptableUser[] = [
    {
        id: 1,
        name: "Ahmed Benali",
        email: "ahmed.benali@cabinet.ma",
        role: "COMPTABLE",
        dossiersCount: 3,
        fournisseursCount: 3,
        invoicesCount: 47,
        createdAt: "2025-01-15",
        active: true,
    },
    {
        id: 2,
        name: "Fatima Zahra",
        email: "fatima.zahra@cabinet.ma",
        role: "COMPTABLE",
        dossiersCount: 2,
        fournisseursCount: 2,
        invoicesCount: 28,
        createdAt: "2025-02-01",
        active: true,
    },
    {
        id: 3,
        name: "Karim Idrissi",
        email: "karim.idrissi@cabinet.ma",
        role: "COMPTABLE",
        dossiersCount: 1,
        fournisseursCount: 1,
        invoicesCount: 12,
        createdAt: "2025-03-10",
        active: false,
    },
]

// ============================================
// MOCK DOSSIERS (par comptable)
// ============================================
export const MOCK_DOSSIERS: Dossier[] = [
    // Comptable 1 — Ahmed Benali
    {
        id: 1,
        name: "Dossier SARL Maroc Tech",
        fournisseur: { id: 10, name: "Maroc Tech SARL", email: "contact@maroctech.ma" },
        comptableId: 1,
        comptableName: "Ahmed Benali",
        invoicesCount: 18,
        bankStatementsCount: 6,
        pendingInvoicesCount: 3,
        validatedInvoicesCount: 15,
        status: "active",
        createdAt: "2025-01-20",
    },
    {
        id: 2,
        name: "Dossier Imprimerie Atlas",
        fournisseur: { id: 11, name: "Imprimerie Atlas", email: "atlas@imprimerie.ma" },
        comptableId: 1,
        comptableName: "Ahmed Benali",
        invoicesCount: 22,
        bankStatementsCount: 8,
        pendingInvoicesCount: 5,
        validatedInvoicesCount: 17,
        status: "active",
        createdAt: "2025-02-05",
    },
    {
        id: 3,
        name: "Dossier Transport Rapid",
        fournisseur: { id: 12, name: "Transport Rapid", email: "info@transportrapid.ma" },
        comptableId: 1,
        comptableName: "Ahmed Benali",
        invoicesCount: 7,
        bankStatementsCount: 2,
        pendingInvoicesCount: 2,
        validatedInvoicesCount: 5,
        status: "active",
        createdAt: "2025-03-01",
    },
    // Comptable 2 — Fatima Zahra
    {
        id: 4,
        name: "Dossier Bâtiment Pro",
        fournisseur: { id: 13, name: "Bâtiment Pro SARL", email: "contact@batimentpro.ma" },
        comptableId: 2,
        comptableName: "Fatima Zahra",
        invoicesCount: 15,
        bankStatementsCount: 4,
        pendingInvoicesCount: 1,
        validatedInvoicesCount: 14,
        status: "active",
        createdAt: "2025-02-10",
    },
    {
        id: 5,
        name: "Dossier Agro Maroc",
        fournisseur: { id: 14, name: "Agro Maroc SA", email: "info@agromaroc.ma" },
        comptableId: 2,
        comptableName: "Fatima Zahra",
        invoicesCount: 13,
        bankStatementsCount: 3,
        pendingInvoicesCount: 4,
        validatedInvoicesCount: 9,
        status: "active",
        createdAt: "2025-03-15",
    },
    // Comptable 3 — Karim Idrissi
    {
        id: 6,
        name: "Dossier Électro Services",
        fournisseur: { id: 15, name: "Électro Services", email: "contact@electroservices.ma" },
        comptableId: 3,
        comptableName: "Karim Idrissi",
        invoicesCount: 12,
        bankStatementsCount: 3,
        pendingInvoicesCount: 0,
        validatedInvoicesCount: 12,
        status: "inactive",
        createdAt: "2025-03-20",
    },
    {
        id: 7,
        name: "Dossier Moroccan Crafts",
        fournisseur: { id: 16, name: "Moroccan Crafts SA", email: "contact@mcrafts.ma" },
        comptableId: 1,
        comptableName: "Ahmed Benali",
        invoicesCount: 5,
        bankStatementsCount: 1,
        pendingInvoicesCount: 2,
        validatedInvoicesCount: 3,
        status: "active",
        createdAt: "2025-04-01",
    },
    {
        id: 8,
        name: "Dossier Sahara Sol",
        fournisseur: { id: 17, name: "Sahara Sol", email: "info@saharasol.ma" },
        comptableId: 1,
        comptableName: "Ahmed Benali",
        invoicesCount: 10,
        bankStatementsCount: 2,
        pendingInvoicesCount: 0,
        validatedInvoicesCount: 10,
        status: "active",
        createdAt: "2025-04-10",
    },
]

// ============================================
// MOCK INVOICES (par dossier)
// ============================================
export const MOCK_INVOICES_BY_DOSSIER: Record<number, any[]> = {
    1: [
        { id: 101, number: "FAC-2025-001", supplier: "Maroc Tech SARL", amount: 12500, date: "2025-01-25", status: "to_verify" },
        { id: 102, number: "FAC-2025-002", supplier: "Maroc Tech SARL", amount: 8750, date: "2025-02-10", status: "validated" },
        { id: 103, number: "FAC-2025-003", supplier: "Maroc Tech SARL", amount: 15200, date: "2025-03-05", status: "pending" },
    ],
    2: [
        { id: 201, number: "FAC-2025-010", supplier: "Imprimerie Atlas", amount: 3200, date: "2025-02-08", status: "validated" },
        { id: 202, number: "FAC-2025-011", supplier: "Imprimerie Atlas", amount: 4500, date: "2025-02-20", status: "pending" },
    ],
    3: [
        { id: 301, number: "FAC-2025-020", supplier: "Transport Rapid", amount: 6800, date: "2025-03-02", status: "validated" },
        { id: 302, number: "FAC-2025-021", supplier: "Transport Rapid", amount: 4200, date: "2025-03-15", status: "pending" },
    ],
    4: [
        { id: 401, number: "FAC-2025-030", supplier: "Bâtiment Pro", amount: 45000, date: "2025-02-12", status: "validated" },
        { id: 402, number: "FAC-2025-031", supplier: "Bâtiment Pro", amount: 28000, date: "2025-03-01", status: "validated" },
    ],
    5: [
        { id: 501, number: "FAC-2025-040", supplier: "Agro Maroc", amount: 18500, date: "2025-03-18", status: "to_verify" },
    ],
    6: [
        { id: 601, number: "FAC-2025-050", supplier: "Électro Services", amount: 9800, date: "2025-03-22", status: "validated" },
    ],
}

// ============================================
// MOCK BANK STATEMENTS (par dossier)
// ============================================
export const MOCK_BANK_STATEMENTS_BY_DOSSIER: Record<number, any[]> = {
    1: [
        { id: 1001, filename: "releve-jan-2025.pdf", period: "Janvier 2025", status: "validated", uploadedAt: "2025-02-01" },
        { id: 1002, filename: "releve-feb-2025.pdf", period: "Février 2025", status: "pending", uploadedAt: "2025-03-01" },
    ],
    2: [
        { id: 2001, filename: "releve-atlas-jan.pdf", period: "Janvier 2025", status: "validated", uploadedAt: "2025-02-05" },
    ],
    3: [],
    4: [
        { id: 4001, filename: "releve-bat-jan.pdf", period: "Janvier 2025", status: "validated", uploadedAt: "2025-02-15" },
    ],
    5: [],
    6: [
        { id: 6001, filename: "releve-electro-q1.pdf", period: "Q1 2025", status: "validated", uploadedAt: "2025-04-01" },
    ],
}

// ============================================
// MOCK AUDIT LOGS
// ============================================
export const MOCK_AUDIT_LOGS: AuditLog[] = [
    { id: 1, userId: 1, userName: "Ahmed Benali", userRole: "COMPTABLE", action: "UPLOAD", resource: "Facture", resourceId: 103, details: "FAC-2025-003 uploadée", timestamp: "2025-03-05T09:12:00Z", ip: "192.168.1.10" },
    { id: 2, userId: 10, userName: "Maroc Tech SARL", userRole: "FOURNISSEUR", action: "UPLOAD", resource: "Facture", resourceId: 103, details: "FAC-2025-003 soumise", timestamp: "2025-03-05T08:45:00Z", ip: "192.168.1.25" },
    { id: 3, userId: 1, userName: "Ahmed Benali", userRole: "COMPTABLE", action: "VALIDATE", resource: "Facture", resourceId: 102, details: "FAC-2025-002 validée", timestamp: "2025-02-15T14:30:00Z", ip: "192.168.1.10" },
    { id: 4, userId: 2, userName: "Fatima Zahra", userRole: "COMPTABLE", action: "CREATE_DOSSIER", resource: "Dossier", resourceId: 5, details: "Dossier Agro Maroc créé", timestamp: "2025-03-15T10:00:00Z", ip: "192.168.1.15" },
    { id: 5, userId: 99, userName: "Super Admin", userRole: "SUPER_ADMIN", action: "CREATE_COMPTABLE", resource: "Utilisateur", resourceId: 3, details: "Compte Karim Idrissi créé", timestamp: "2025-03-10T09:00:00Z", ip: "192.168.1.1" },
]

// ============================================
// GLOBAL STATS (pour SUPER_ADMIN)
// ============================================
export const MOCK_GLOBAL_STATS = {
    totalComptables: 3,
    activeComptables: 2,
    totalFournisseurs: 6,
    totalDossiers: 6,
    totalInvoices: 87,
    pendingInvoices: 15,
    validatedInvoices: 72,
    totalBankStatements: 26,
    validationRate: 82.7,
    avgProcessingTimeDays: 2.3,
    invoicesThisMonth: 12,
    invoicesLastMonth: 18,
}

// Helper: get dossiers by comptable ID
export const getDossiersByComptable = (comptableId: number) =>
    MOCK_DOSSIERS.filter(d => d.comptableId === comptableId)

// Helper: get dossier by fournisseur ID
export const getDossierByFournisseur = (fournisseurId: number) =>
    MOCK_DOSSIERS.find(d => d.fournisseur.id === fournisseurId)

// ============================================
// MOCK ACCOUNTS
// ============================================
export const MOCK_ACCOUNTS: Account[] = [
    { id: 1, code: "611100000", libelle: "Achats de marchandises", active: true, classe: 6 },
    { id: 2, code: "612100000", libelle: "Achats de matières premières", active: true, classe: 6 },
    { id: 3, code: "345500000", libelle: "État - TVA récupérable", active: true, classe: 3 },
    { id: 4, code: "441100000", libelle: "Fournisseurs", active: true, classe: 4 },
    { id: 5, code: "445500000", libelle: "État - TVA facturée", active: true, classe: 4 },
    { id: 6, code: "711100000", libelle: "Ventes de marchandises", active: true, classe: 7 },
]

// ============================================
// MOCK TIERS
// ============================================
export const MOCK_TIERS: Tier[] = [
    {
        id: 10,
        libelle: "Maroc Tech SARL",
        tierNumber: "44110010",
        ice: "001234567890012",
        ifNumber: "98765432",
        active: true,
        hasAccountingConfig: true,
        defaultChargeAccount: "611100000",
        tvaAccount: "345500000",
        defaultTvaRate: 20,
        auxiliaireMode: true
    },
    {
        id: 11,
        libelle: "Imprimerie Atlas",
        tierNumber: "44110011",
        ice: "002233445566778",
        ifNumber: "11223344",
        active: true,
        hasAccountingConfig: true,
        defaultChargeAccount: "611100000",
        tvaAccount: "345500000",
        defaultTvaRate: 20,
        auxiliaireMode: true
    }
]

// ============================================
// MOCK USERS (for Login)
// ============================================
export const MOCK_USERS: Record<string, User> = {
    "admin@example.com": {
        id: 99,
        name: "Super Administrateur",
        email: "admin@example.com",
        role: "SUPER_ADMIN",
        active: true,
        password: "password"
    },
    "comptable@example.com": {
        id: 1,
        name: "Ahmed Benali",
        email: "comptable@example.com",
        role: "COMPTABLE",
        active: true,
        password: "password"
    },
    "fournisseur@example.com": {
        id: 10,
        name: "Maroc Tech SARL",
        email: "fournisseur@example.com",
        role: "FOURNISSEUR",
        active: true,
        password: "password"
    }
}
