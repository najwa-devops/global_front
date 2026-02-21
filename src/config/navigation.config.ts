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
    ChevronLeft
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
                { id: "accounting-settings", href: "/settings/accounting", label: "Plan Comptable", icon: Building2 },
                { id: "patterns", href: "/settings/patterns", label: "Filtres & Patterns", icon: Settings },
            ]
        }
    ],
    COMPTABLE: [
        { id: "dossiers", href: "/dossiers", label: "Mes Dossiers", icon: FolderOpen },
        { id: "admin-dashboard", href: "/dossiers", label: "Tableau de bord", icon: Building2 },
        {
            id: "configuration-parent",
            href: "/configuration",
            label: "Configuration",
            icon: Sliders,
            children: [
                { id: "accounting-settings", href: "/settings/accounting", label: "Plan Comptable & Tiers", icon: Building2 },
                { id: "templates", href: "/templates", label: "Modèles OCR", icon: Sparkles },
            ]
        }
    ],
    FOURNISSEUR: [
        { id: "my-dossier", href: "/dashboard", label: "Mon Dossier", icon: FolderOpen },
        { id: "upload", href: "/upload", label: "Déposer Facture", icon: Upload },
    ]
};

// Contextual Nav Items (When a dossier IS active)
export const getDossierNavConfig = (dossierId: string | number): NavItemConfig[] => [
    { id: "back", href: "/dossiers", label: "Indice des dossiers", icon: ChevronLeft, roles: ["COMPTABLE", "SUPER_ADMIN"] },
    { id: "dash", href: `/dossiers/${dossierId}`, label: "Tableau de bord", icon: Building2, roles: ["COMPTABLE", "SUPER_ADMIN", "FOURNISSEUR"] },
    {
        id: "billing",
        href: "#",
        label: "Facturation",
        icon: FileText,
        roles: ["COMPTABLE", "SUPER_ADMIN", "FOURNISSEUR"],
        children: [
            { id: "upload", href: "/upload", label: "Nouveau dépôt", icon: Upload, roles: ["COMPTABLE", "SUPER_ADMIN", "FOURNISSEUR"] },
            { id: "invoices", href: "/invoices", label: "Mes Factures", icon: FileText, badgeKey: "pendingCount", roles: ["COMPTABLE", "SUPER_ADMIN", "FOURNISSEUR"] },
            { id: "validated", href: "/validated", label: "Factures validées", icon: CheckCircle2, roles: ["COMPTABLE", "SUPER_ADMIN", "FOURNISSEUR"] },
        ]
    },
    {
        id: "bank",
        href: "#",
        label: "Banque",
        icon: Building2,
        roles: ["COMPTABLE", "SUPER_ADMIN"],
        children: [
            { id: "bank-upload", href: "/bank/upload", label: "Importer relevé", icon: Upload, roles: ["COMPTABLE", "SUPER_ADMIN"] },
            { id: "bank-list", href: "/bank/list", label: "Liste des relevés", icon: List, roles: ["COMPTABLE", "SUPER_ADMIN"] },
        ]
    },
    {
        id: "settings",
        href: "#",
        label: "Configuration",
        icon: Sliders,
        roles: ["COMPTABLE", "SUPER_ADMIN"],
        children: [
            { id: "accounting-settings", href: "/settings/accounting", label: "Plan Comptable", icon: Building2, roles: ["COMPTABLE", "SUPER_ADMIN"] },
            { id: "patterns", href: "/settings/patterns", label: "Patterns OCR", icon: Settings, roles: ["COMPTABLE", "SUPER_ADMIN"] },
        ]
    }
];

// Simplified mapping for breadcrumbs and titles
export const ROUTE_METADATA: Record<string, { title: string; breadcrumb?: string }> = {
    "/admin": { title: "Administration", breadcrumb: "Admin" },
    "/dossiers": { title: "Mes Dossiers", breadcrumb: "Dossiers" },
    "/upload": { title: "Nouveau dépôt", breadcrumb: "Uploader" },
    "/invoices": { title: "Factures en traitement", breadcrumb: "Factures" },
    "/validated": { title: "Factures validées", breadcrumb: "Archives" },
    "/bank/list": { title: "Relevés Bancaires", breadcrumb: "Banque" },
    "/bank/upload": { title: "Importer un relevé", breadcrumb: "Import" },
    "/settings/accounting": { title: "Plan Comptable & Tiers", breadcrumb: "Comptabilité" },
    "/settings/patterns": { title: "Filtres & Patterns", breadcrumb: "Patterns" },
    "/templates": { title: "Modèles OCR", breadcrumb: "Templates" },
    "/dashboard": { title: "Tableau de bord", breadcrumb: "Dashboard" },
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
