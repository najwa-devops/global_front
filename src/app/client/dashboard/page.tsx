"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Building2,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  ReceiptText,
  Upload,
} from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/src/types";

type DashboardItem = {
  id: number;
  filename: string;
  status?: string;
  createdAt?: string;
  sourceType?: string;
  secondaryLabel?: string;
  dossierId?: number;
  dossierName?: string;
  clientId?: number;
  clientName?: string;
};

type ClientDashboardResponse = {
  clientId?: number;
  clientName?: string;
  activeDossier?: {
    id?: number;
    name?: string;
    exerciseStartDate?: string;
    exerciseEndDate?: string;
    comptableId?: number;
    comptableName?: string;
  };
  stats?: Record<string, number>;
  recentBuyingInvoices?: DashboardItem[];
  recentSalesInvoices?: DashboardItem[];
  recentBankStatements?: DashboardItem[];
  recentCentreMonetique?: DashboardItem[];
};

function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function normalizeStatus(status?: string) {
  return String(status || "").replace(/_/g, " ").trim() || "—";
}

function statusClasses(status?: string) {
  const value = String(status || "").toUpperCase();
  if (["VALIDATED", "ACCOUNTED", "COMPTABILISE", "PROCESSED"].includes(value)) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (["READY_TO_VALIDATE", "READY TO VALIDATE", "TREATED"].includes(value)) {
    return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (["PENDING", "PROCESSING", "VERIFY"].includes(value)) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (["ERROR", "REJECTED", "DUPLIQUE", "DUPLICATE"].includes(value)) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function countValue(stats: Record<string, number> | undefined, key: string) {
  return Number(stats?.[key] || 0);
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-card/70 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  description,
  uploadHref,
  listHref,
  listLabel,
  icon,
  count,
  pending,
}: {
  title: string;
  description: string;
  uploadHref: string;
  listHref: string;
  listLabel: string;
  icon: React.ReactNode;
  count: number;
  pending?: number;
}) {
  return (
    <Card className="border-border/60 bg-card/70 shadow-sm transition-transform hover:-translate-y-0.5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground">documents</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {typeof pending === "number" && (
          <Badge className="w-fit border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {pending} en attente
          </Badge>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={uploadHref} className="inline-flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Uploader
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={listHref} className="inline-flex items-center gap-2">
              {listLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentList({ items }: { items: DashboardItem[] }) {
  if (!items.length) {
    return <p className="py-6 text-sm text-muted-foreground">Aucun document récent.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{item.filename}</p>
              <Badge className={cn("border", statusClasses(item.status))}>
                {normalizeStatus(item.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.sourceType ? `${item.sourceType} · ` : ""}
              {item.secondaryLabel || ""}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span>{formatDate(item.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientDashboardPageContent() {
  const [dashboard, setDashboard] = useState<ClientDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncStoredDossier = (payload: ClientDashboardResponse | null) => {
    const active = payload?.activeDossier;
    if (typeof window === "undefined" || !active?.id) return;
    window.localStorage.setItem("currentDossierId", String(active.id));
    if (active.name) {
      window.localStorage.setItem("currentDossierName", active.name);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = (await api.getClientDashboard()) as ClientDashboardResponse;
        if (!mounted) return;
        setDashboard(result || null);
        syncStoredDossier(result || null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Impossible de charger le tableau de bord client");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = dashboard?.stats || {};
  const recentBuying = dashboard?.recentBuyingInvoices || [];
  const recentSales = dashboard?.recentSalesInvoices || [];
  const recentBank = dashboard?.recentBankStatements || [];
  const recentCentreMonetique = dashboard?.recentCentreMonetique || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = (await api.getClientDashboard()) as ClientDashboardResponse;
      setDashboard(result || null);
      syncStoredDossier(result || null);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading && !dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Chargement du tableau de bord client...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                <span>Session client</span>
              </div>
              <CardTitle className="text-3xl tracking-tight">Tableau de bord client</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                Déposez vos factures d'achat, de vente, vos relevés bancaires et votre centre monétique, puis consultez leur statut de traitement depuis un seul espace.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm lg:min-w-80">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Dossier actif
              </label>
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {dashboard?.activeDossier?.name || "Dossier de session"}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                  Rafraîchir
                </Button>
              </div>
            </div>
          </div>

          {dashboard?.activeDossier && (
            <div className="grid gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Dossier</p>
                <p className="mt-1 font-semibold">{dashboard.activeDossier.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Exercice</p>
                <p className="mt-1 font-semibold">
                  {formatDate(dashboard.activeDossier.exerciseStartDate)} → {formatDate(dashboard.activeDossier.exerciseEndDate)}
                </p>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/10">
          <CardContent className="py-4 text-sm text-rose-700 dark:text-rose-300">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Factures d'achat"
          value={countValue(stats, "totalBuyingInvoices")}
          description="Documents importés côté achat"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Factures de vente"
          value={countValue(stats, "totalSalesInvoices")}
          description="Documents importés côté vente"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="En attente"
          value={countValue(stats, "pendingTotal")}
          description="Documents à suivre"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          title="Relevés bancaires"
          value={countValue(stats, "totalBankStatements")}
          description="Documents importés côté banque"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Centre monétique"
          value={countValue(stats, "totalCentreMonetique")}
          description="Documents importés côté monétique"
          icon={<ReceiptText className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Factures d'achat"
          description="Uploader et consulter la liste des factures d'achat."
          uploadHref="/achat/upload"
          listHref="/achat/invoices"
          listLabel="Voir ma liste"
          icon={<FileText className="h-5 w-5" />}
          count={countValue(stats, "totalBuyingInvoices")}
          pending={countValue(stats, "pendingBuyingInvoices")}
        />
        <SectionCard
          title="Factures de vente"
          description="Uploader et suivre les factures émises par votre société."
          uploadHref="/vente/upload"
          listHref="/vente/invoices"
          listLabel="Voir ma liste"
          icon={<FileText className="h-5 w-5" />}
          count={countValue(stats, "totalSalesInvoices")}
          pending={countValue(stats, "pendingSalesInvoices")}
        />
        <SectionCard
          title="Relevés bancaires"
          description="Uploader et suivre les relevés bancaires du dossier."
          uploadHref="/bank/upload"
          listHref="/bank/list"
          listLabel="Voir ma liste"
          icon={<Building2 className="h-5 w-5" />}
          count={countValue(stats, "totalBankStatements")}
          pending={countValue(stats, "pendingBankStatements")}
        />
        <SectionCard
          title="Centre monétique"
          description="Consulter les batches centre monétique du dossier."
          uploadHref="/centre-monetique"
          listHref="/centre-monetique"
          listLabel="Ouvrir"
          icon={<ReceiptText className="h-5 w-5" />}
          count={countValue(stats, "totalCentreMonetique")}
          pending={countValue(stats, "pendingCentreMonetique")}
        />
      </div>

      <Card className="border-border/60 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Documents récents</CardTitle>
          <CardDescription>Les derniers éléments du dossier de session.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="achat" className="w-full">
            <TabsList className="mb-4 flex flex-wrap justify-start gap-2 bg-transparent p-0">
              <TabsTrigger value="achat">Achat</TabsTrigger>
              <TabsTrigger value="vente">Vente</TabsTrigger>
              <TabsTrigger value="banque">Banque</TabsTrigger>
              <TabsTrigger value="monetique">Centre monétique</TabsTrigger>
            </TabsList>
            <TabsContent value="achat">
              <RecentList items={recentBuying} />
            </TabsContent>
            <TabsContent value="vente">
              <RecentList items={recentSales} />
            </TabsContent>
            <TabsContent value="banque">
              <RecentList items={recentBank} />
            </TabsContent>
            <TabsContent value="monetique">
              <RecentList items={recentCentreMonetique} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClientDashboardPage() {
  return (
    <AuthGuard allowedRoles={["CLIENT"] as UserRole[]}>
      <ClientDashboardPageContent />
    </AuthGuard>
  );
}
