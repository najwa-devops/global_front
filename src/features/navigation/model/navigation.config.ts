import {
    Upload,
    Settings,
    FileText,
    CheckCircle2,
    Building2,
    List,
    Sliders,
    FolderOpen,
    ShieldCheck,
    Users,
    BarChart3,
    Sparkles,
    ChevronLeft,
    Clock,
    BookOpenCheck,
    ReceiptText
} from "lucide-react";
import { UserRole } from "@/src/types";

export interface NavItemConfig {
    id: string;
    href: string;
    label: string;
    icon: any;
    roles?: UserRole[];
    badgeKey?: string;
    children?: NavItemConfig[] | undefined;
}

// Global Nav Items (When NO dossier is active)
export const GLOBAL_NAV_CONFIG: Record<UserRole, NavItemConfig[]> = {
    SUPER_ADMIN: [
        { id: "admin-dashboard", href: "/admin", label: "Administration", icon: ShieldCheck },
        { id: "all-dossiers", href: "/dossiers", label: "Tous les Dossiers", icon: FolderOpen },
        {
            id: "global-billing",
            href: "/facturation",
            label: "Facturation",
            icon: FileText,
            children: [
                { id: "upload", href: "/achat/upload", label: "Nouveau dÃ©pÃ´t", icon: Upload },
                { id: "client-pending", href: "/achat/client-pending", label: "Factures en attente", icon: Clock, badgeKey: "pendingCount" },
                { id: "invoices", href: "/achat/invoices", label: "Factures en traitement", icon: FileText, badgeKey: "pendingCount" },
                { id: "accounted", href: "/achat/accounted", label: "Factures comptabilisÃ©es", icon: BookOpenCheck },
                { id: "comptability", href: "/comptability", label: "Journal comptable", icon: BookOpenCheck },
            ]
        },
        {
            id: "global-bank",
            href: "/bank",
            label: "RelevÃ©s bancaires",
            icon: Building2,
            children: [
                {
                    id: "bank-statements",
                    href: "#",
                    label: "RelevÃ©s",
                    icon: List,
                    children: [
                        { id: "bank-upload", href: "/bank/upload", label: "Importer relevÃ©", icon: Upload },
                        { id: "bank-list", href: "/bank/list", label: "Liste des relevÃ©s", icon: List },
                        { id: "bank-accounted", href: "/bank/accounted", label: "RelevÃ©s comptabilisÃ©s", icon: BookOpenCheck },
                        { id: "bank-journal", href: "/journal", label: "Journal comptable", icon: BookOpenCheck },
                    ]
                },
                { id: "bank-centre-monetique", href: "/centre-monetique", label: "Centre MonÃ©tique", icon: ReceiptText },
            ]
        },
        {
            id: "system-parent",
            href: "/admin/gestion",
            label: "Gestion SystÃ¨me",
            icon: Users,
            children: [
                { id: "admin-stats", href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
                { id: "admin-audit", href: "/admin/audit", label: "Journal d'audit", icon: ShieldCheck },
                { id: "admin-users", href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
            ]
        },
        {
            id: "config-parent",
            href: "/configuration",
            label: "Configuration",
            icon: Sliders,
            children: [
                { id: "general-settings", href: "/settings/general", label: "Parametres generaux", icon: Settings },
                { id: "bank-settings", href: "/settings/bank", label: "Parametres bancaires", icon: Building2 },
                { id: "accounting-settings", href: "/settings/accounting", label: "Plan Comptable", icon: Building2 },
                { id: "dossier-settings", href: "/settings/general?tab=params", label: "Parametres dossier", icon: FolderOpen },
                { id: "patterns", href: "/settings/patterns", label: "Filtres & Patterns", icon: Settings },
            ]
        }
    ],
    ADMIN: [
        { id: "admin-dashboard", href: "/admin", label: "Administration", icon: ShieldCheck },
        { id: "all-dossiers", href: "/dossiers", label: "Tous les Dossiers", icon: FolderOpen },
        {
            id: "global-billing",
            href: "/facturation",
            label: "Facturation",
            icon: FileText,
            children: [
                { id: "upload", href: "/achat/upload", label: "Nouveau dépôt", icon: Upload },
                { id: "client-pending", href: "/achat/client-pending", label: "Factures en attente", icon: Clock, badgeKey: "pendingCount" },
                { id: "invoices", href: "/achat/invoices", label: "Factures en traitement", icon: FileText, badgeKey: "pendingCount" },
                { id: "accounted", href: "/achat/accounted", label: "Factures comptabilisées", icon: BookOpenCheck },
                { id: "comptability", href: "/comptability", label: "Journal comptable", icon: BookOpenCheck },
            ]
        },
        {
            id: "global-bank",
            href: "/bank",
            label: "Relevés bancaires",
            icon: Building2,
            children: [
                {
                    id: "bank-statements",
                    href: "#",
                    label: "Relevés",
                    icon: List,
                    children: [
                        { id: "bank-upload", href: "/bank/upload", label: "Importer relevé", icon: Upload },
                        { id: "bank-list", href: "/bank/list", label: "Liste des relevés", icon: List },
                        { id: "bank-accounted", href: "/bank/accounted", label: "Relevés comptabilisés", icon: BookOpenCheck },
                        { id: "bank-journal", href: "/journal", label: "Journal comptable", icon: BookOpenCheck },
                    ]
                },
                { id: "bank-centre-monetique", href: "/centre-monetique", label: "Centre Monétique", icon: ReceiptText },
            ]
        },
        {
            id: "system-parent",
            href: "/admin/gestion",
            label: "Gestion Système",
            icon: Users,
            children: [
                { id: "admin-stats", href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
                { id: "admin-audit", href: "/admin/audit", label: "Journal d'audit", icon: ShieldCheck },
                { id: "admin-users", href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
            ]
        },
        {
            id: "config-parent",
            href: "/configuration",
            label: "Configuration",
            icon: Sliders,
            children: [
                { id: "general-settings", href: "/settings/general", label: "Parametres generaux", icon: Settings },
                { id: "bank-settings", href: "/settings/bank", label: "Parametres bancaires", icon: Building2 },
                { id: "accounting-settings", href: "/settings/accounting", label: "Plan Comptable", icon: Building2 },
                { id: "dossier-settings", href: "/settings/general?tab=params", label: "Parametres dossier", icon: FolderOpen },
                { id: "patterns", href: "/settings/patterns", label: "Filtres & Patterns", icon: Settings },
            ]
        }
    ],
    COMPTABLE: [
        { id: "dossiers", href: "/dossiers", label: "Mes Dossiers", icon: FolderOpen },
        { id: "admin-dashboard", href: "/dossiers", label: "Tableau de bord", icon: Building2 },
        {
            id: "global-billing",
            href: "/facturation",
            label: "Facturation",
            icon: FileText,
            children: [
                { id: "upload", href: "/achat/upload", label: "Nouveau dépôt", icon: Upload },
                { id: "client-pending", href: "/achat/client-pending", label: "Factures en attente", icon: Clock, badgeKey: "pendingCount" },
                { id: "invoices", href: "/achat/invoices", label: "Factures en traitement", icon: FileText, badgeKey: "pendingCount" },
                { id: "accounted", href: "/achat/accounted", label: "Factures comptabilisées", icon: BookOpenCheck },
                { id: "comptability", href: "/comptability", label: "Journal comptable", icon: BookOpenCheck },
            ]
        },
        {
            id: "global-bank",
            href: "/bank",
            label: "Relevés bancaires",
            icon: Building2,
            children: [
                {
                    id: "bank-statements",
                    href: "#",
                    label: "Relevés",
                    icon: List,
                    children: [
                        { id: "bank-upload", href: "/bank/upload", label: "Importer relevé", icon: Upload },
                        { id: "bank-list", href: "/bank/list", label: "Liste des relevés", icon: List },
                        { id: "bank-accounted", href: "/bank/accounted", label: "Relevés comptabilisés", icon: BookOpenCheck },
                        { id: "bank-journal", href: "/journal", label: "Journal comptable", icon: BookOpenCheck },
                    ]
                },
                { id: "bank-centre-monetique", href: "/centre-monetique", label: "Centre Monétique", icon: ReceiptText },
            ]
        },
        {
            id: "configuration-parent",
            href: "/configuration",
            label: "Configuration",
            icon: Sliders,
            children: [
                { id: "general-settings", href: "/settings/general", label: "Parametres generaux", icon: Settings },
                { id: "bank-settings", href: "/settings/bank", label: "Parametres bancaires", icon: Building2 },
                { id: "accounting-settings", href: "/settings/accounting", label: "Plan Comptable & Tiers", icon: Building2 },
                { id: "dossier-settings", href: "/settings/general?tab=params", label: "Parametres dossier", icon: FolderOpen },
                { id: "templates", href: "/achat/templates", label: "Modèles OCR", icon: Sparkles },
            ]
        }
    ],
    CLIENT: [],
    FOURNISSEUR: [
        { id: "my-dossier", href: "/dashboard", label: "Mon Dossier", icon: FolderOpen },
        {
            id: "global-billing",
            href: "/facturation",
            label: "Facturation",
            icon: FileText,
            children: [
                { id: "upload", href: "/achat/upload", label: "DÃ©poser Facture", icon: Upload },
                { id: "client-pending", href: "/achat/client-pending", label: "Factures en attente", icon: Clock, badgeKey: "pendingCount" },
                { id: "invoices", href: "/achat/invoices", label: "Factures en traitement", icon: FileText, badgeKey: "pendingCount" },
                { id: "accounted", href: "/achat/accounted", label: "Factures comptabilisÃ©es", icon: BookOpenCheck },
            ]
        },
    ]
};

// Contextual Nav Items (When a dossier IS active)
export const getDossierNavConfig = (dossierId: string | number): NavItemConfig[] => [
    { id: "back", href: "/dossiers", label: "Indice des dossiers", icon: ChevronLeft, roles: ["COMPTABLE", "ADMIN"] },
    { id: "dash", href: `/dossiers/${dossierId}`, label: "Tableau de bord", icon: Building2, roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
    { id: "client-dashboard", href: "/client/dashboard", label: "Tableau de bord client", icon: BarChart3, roles: ["CLIENT"] },
    {
        id: "Achat",
        href: "#",
        label: "Facture Achat",
        icon: FileText,
        roles: ["COMPTABLE", "ADMIN", "CLIENT"],
        children: [
            { id: "upload", href: "/achat/upload", label: "Nouveau dépôt", icon: Upload, roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
            { id: "client-pending", href: "/achat/client-pending", label: "Factures en attente", icon: Clock, roles: ["COMPTABLE", "ADMIN"] },
            { id: "invoices", href: "/achat/invoices", label: "Factures scannées", icon: FileText, badgeKey: "pendingCount", roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
            { id: "accounted", href: "/achat/accounted", label: "Factures comptabilisées", icon: BookOpenCheck, roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
            { id: "comptability", href: "/comptability", label: "Journal comptable", icon: BookOpenCheck, roles: ["COMPTABLE", "ADMIN"] },
        ]
    },
    {
        id: "Vente",
        href: "#",
        label: "Facture Vente",
        icon: FileText,
        roles: ["COMPTABLE", "ADMIN", "CLIENT"],
        children: [
            { id: "vente-upload", href: "/vente/upload", label: "Nouveau dépôt", icon: Upload, roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
            { id: "vente-pending", href: "/vente/invoices", label: "Factures en attente", icon: Clock, roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
            { id: "vente-invoices", href: "/vente/scanned", label: "Factures scannées", icon: FileText, roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
            { id: "vente-accounted", href: "/vente/accounted", label: "Factures comptabilisées", icon: BookOpenCheck, roles: ["COMPTABLE", "ADMIN", "CLIENT"] },
            { id: "vente-journal", href: "/vente/journal", label: "Journal comptable", icon: BookOpenCheck, roles: ["COMPTABLE", "ADMIN"] },
        ]
    },
    {
        id: "bank",
        href: "#",
        label: "Banque",
        icon: Building2,
        roles: ["COMPTABLE", "ADMIN", "SUPER_ADMIN", "CLIENT"],
        children: [
            {
                id: "bank-statements",
                href: "#",
                label: "Relevés",
                icon: List,
                roles: ["COMPTABLE", "ADMIN", "SUPER_ADMIN", "CLIENT"],
                children: [
                    { id: "bank-upload", href: "/bank/upload", label: "Importer relevé", icon: Upload, roles: ["COMPTABLE", "ADMIN", "SUPER_ADMIN", "CLIENT"] },
                    { id: "bank-list", href: "/bank/list", label: "Liste des relevés", icon: List, roles: ["COMPTABLE", "ADMIN", "SUPER_ADMIN", "CLIENT"] },
                    { id: "bank-accounted", href: "/bank/accounted", label: "Relevés comptabilisés", icon: BookOpenCheck, roles: ["COMPTABLE", "ADMIN", "SUPER_ADMIN"] },
                    { id: "bank-journal", href: "/journal", label: "Journal comptable", icon: BookOpenCheck, roles: ["COMPTABLE", "ADMIN", "SUPER_ADMIN"] },
                ]
            },
            { id: "bank-centre-monetique", href: "/centre-monetique", label: "Centre Monétique", icon: ReceiptText, roles: ["COMPTABLE", "ADMIN", "SUPER_ADMIN", "CLIENT"] },
        ]
    },
    {
        id: "settings",
        href: "#",
        label: "Configuration",
        icon: Sliders,
        roles: ["COMPTABLE", "ADMIN"],
        children: [
            { id: "general-settings", href: "/settings/general", label: "Parametres generaux", icon: Settings, roles: ["COMPTABLE", "ADMIN"] },
            { id: "bank-settings", href: "/settings/bank", label: "Parametres bancaires", icon: Building2, roles: ["COMPTABLE", "ADMIN"] },
            { id: "accounting-settings", href: "/settings/accounting", label: "Plan Comptable", icon: Building2, roles: ["COMPTABLE", "ADMIN"] },
            { id: "dossier-settings", href: "/settings/general?tab=params", label: "Parametres dossier", icon: FolderOpen, roles: ["COMPTABLE", "ADMIN"] },
            { id: "patterns", href: "/settings/patterns", label: "Patterns OCR", icon: Settings, roles: ["COMPTABLE", "ADMIN"] },
        ]
    }
];

// Simplified mapping for breadcrumbs and titles
export const ROUTE_METADATA: Record<string, { title: string; breadcrumb?: string }> = {
    "/admin": { title: "Administration", breadcrumb: "Admin" },
    "/dossiers": { title: "Mes Dossiers", breadcrumb: "Dossiers" },
    "/achat/upload": { title: "Nouveau dépôt", breadcrumb: "Uploader" },
    "/achat/invoices": { title: "Factures en traitement", breadcrumb: "Factures" },
    "/achat/validated": { title: "Factures comptabilisées", breadcrumb: "Comptabilisées" },
    "/achat/client-pending": { title: "Factures en attente", breadcrumb: "Attente" },
    "/achat/accounted": { title: "Factures comptabilisées", breadcrumb: "Comptabilisées" },
    "/comptability": { title: "Journal comptable", breadcrumb: "Journal" },
    "/bank/list": { title: "Relevés Bancaires", breadcrumb: "Banque" },
    "/bank/upload": { title: "Importer un relevé", breadcrumb: "Import" },
    "/bank/accounted": { title: "Relevés comptabilisés", breadcrumb: "Comptabilisés" },
    "/journal": { title: "Journal Comptable de Banque", breadcrumb: "Journal Banque" },
    "/centre-monetique": { title: "Centre Monétique", breadcrumb: "Centre Monétique" },
    "/settings/general": { title: "Parametres generaux", breadcrumb: "General" },
    "/settings/bank": { title: "Parametres bancaires", breadcrumb: "Banque" },
    "/settings/accounting": { title: "Plan Comptable & Tiers", breadcrumb: "Comptabilité" },
    "/settings/patterns": { title: "Filtres & Patterns", breadcrumb: "Patterns" },
    "/achat/templates": { title: "Modèles OCR", breadcrumb: "Templates" },
    "/dashboard": { title: "Tableau de bord", breadcrumb: "Dashboard" },
    "/client/dashboard": { title: "Tableau de bord client", breadcrumb: "Dashboard client" },
    "/vente/upload": { title: "Nouveau dépôt vente", breadcrumb: "Upload Vente" },
    "/vente/invoices": { title: "Factures vente en traitement", breadcrumb: "Factures Vente" },
    "/vente/scanned": { title: "Factures vente scannées", breadcrumb: "Vente Scannées" },
    "/vente/validated": { title: "Factures vente comptabilisées", breadcrumb: "Vente Comptabilisées" },
    "/vente/accounted": { title: "Factures vente comptabilisées", breadcrumb: "Vente Comptabilisées" },
    "/vente/journal": { title: "Journal comptable vente", breadcrumb: "Journal Vente" },
    "/vente/ocr": { title: "Détail facture vente", breadcrumb: "OCR Vente" },
};

// Helper to get metadata based on matching prefix
export const getRouteMetadata = (pathname: string) => {
    // Exact match first
    if (ROUTE_METADATA[pathname]) return ROUTE_METADATA[pathname];

    // Prefix match (longest first)
    const sortedRoutes = Object.keys(ROUTE_METADATA).sort((a, b) => b.length - a.length);
    for (const route of sortedRoutes) {
        if (pathname.startsWith(route)) return ROUTE_METADATA[route];
    }

    return { title: "FactureOCR", breadcrumb: "Accueil" };
};
