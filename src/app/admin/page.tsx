"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Users,
  FolderOpen,
  FileText,
  Search,
  ChevronRight,
  UserPlus,
  Building2,
  Clock,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import {
  AdminService,
  AdminDossierDto,
  AdminInvoiceStatsDto,
} from "@/src/api/services/admin.service";
import { ComptableAdminDto } from "@/src/types";

type DossierRow = {
  id: number;
  name: string;
  comptableId: number;
  comptableName: string;
  fournisseurName: string;
  invoicesCount: number;
  pendingInvoicesCount: number;
};

function initialsFromEmail(email: string): string {
  const prefix = email.split("@")[0] || "U";
  return prefix.slice(0, 2).toUpperCase();
}

function AdminPageContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminInvoiceStatsDto | null>(null);
  const [comptables, setComptables] = useState<ComptableAdminDto[]>([]);
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [comptableModal, setComptableModal] = useState<{
    dossierId: number;
    dossierName: string;
  } | null>(null);
  const [comptableSearch, setComptableSearch] = useState("");
  const [savingComptable, setSavingComptable] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, dossiersData, comptablesData] = await Promise.all([
          AdminService.getGlobalInvoiceStats().catch(() => null),
          AdminService.listDossiers().catch(() => []),
          AdminService.listComptables().catch(() => []),
        ]);

        const mappedDossiers: DossierRow[] = (dossiersData || []).map(
          (d: AdminDossierDto) => ({
            id: d.id,
            name: d.name,
            comptableId: d.comptableId ?? 0,
            comptableName: d.comptableEmail || "N/A",
            fournisseurName: d.fournisseurEmail || "N/A",
            invoicesCount: d.invoicesCount ?? 0,
            pendingInvoicesCount: d.pendingInvoicesCount ?? 0,
          }),
        );

        setStats(statsData);
        setDossiers(mappedDossiers);
        setComptables(comptablesData || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const comptablesById = useMemo(() => {
    const map = new Map<
      number,
      { dossiers: number; invoices: number; pending: number }
    >();
    for (const d of dossiers) {
      if (!map.has(d.comptableId)) {
        map.set(d.comptableId, { dossiers: 0, invoices: 0, pending: 0 });
      }
      const agg = map.get(d.comptableId)!;
      agg.dossiers += 1;
      agg.invoices += d.invoicesCount;
      agg.pending += d.pendingInvoicesCount;
    }
    return map;
  }, [dossiers]);

  const filteredComptables = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return comptables;
    return comptables.filter((c) => c.email.toLowerCase().includes(term));
  }, [comptables, search]);

  const filteredDossiers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return dossiers;
    return dossiers.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.fournisseurName.toLowerCase().includes(term) ||
        d.comptableName.toLowerCase().includes(term),
    );
  }, [dossiers, search]);

  const filteredAssignComptables = useMemo(() => {
    const term = comptableSearch.trim().toLowerCase();
    if (!term) return comptables;
    return comptables.filter((c) => c.email.toLowerCase().includes(term));
  }, [comptables, comptableSearch]);

  const uniqueFournisseurs = useMemo(() => {
    return new Set(dossiers.map((d) => d.fournisseurName)).size;
  }, [dossiers]);

  const comptableIds = useMemo(
    () => new Set(comptables.map((c) => c.id)),
    [comptables],
  );

  const handleAssignComptable = async (comptableId: number) => {
    if (!comptableModal) return;
    setSavingComptable(true);
    try {
      await AdminService.changeDossierComptable(
        comptableModal.dossierId,
        comptableId,
      );
      const dossiersData = await AdminService.listDossiers().catch(() => []);
      setDossiers(
        (dossiersData || []).map((d: AdminDossierDto) => ({
          id: d.id,
          name: d.name,
          comptableId: d.comptableId ?? 0,
          comptableName: d.comptableEmail || "N/A",
          fournisseurName: d.fournisseurEmail || "N/A",
          invoicesCount: d.invoicesCount ?? 0,
          pendingInvoicesCount: d.pendingInvoicesCount ?? 0,
        })),
      );
      setComptableModal(null);
    } finally {
      setSavingComptable(false);
    }
  };

  const openDossier = (id: number, name: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("currentDossierId", String(id));
      localStorage.setItem("currentDossierName", name);
    }
    router.push(`/dossiers/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
  {[
    {
      label: "Comptables",
      value: comptables.length,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Dossiers",
      value: dossiers.length,
      icon: FolderOpen,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      label: "En attente",
      value:
        (stats?.verify ?? 0) +
        (stats?.readyToTreat ?? 0) +
        (stats?.readyToValidate ?? 0),
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      subLabel: "factures à traiter",
    },
    {
      label: "Validées",
      value: stats?.validated ?? 0,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
      subLabel: "factures",
    },
  ].map((stat) => (
    <Card key={stat.label} className="border-border/50">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${stat.bg}`}>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </div>

          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">
              {loading ? "..." : stat.value}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>

            {stat.subLabel ? (
              <p className="text-[11px] text-muted-foreground/80">
                {stat.subLabel}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>

      <Tabs defaultValue="comptables">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="comptables" className="gap-2">
              <Users className="h-4 w-4" />
              Comptables ({filteredComptables.length})
            </TabsTrigger>
            <TabsTrigger value="dossiers" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Tous les dossiers ({filteredDossiers.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="pl-9 w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              className="gap-2"
              onClick={() => router.push("/admin/utilisateurs")}
            >
              <UserPlus className="h-4 w-4" />
              Nouveau Comptable
            </Button>
          </div>
        </div>

        <TabsContent value="comptables">
          <Card className="border-border/50">
            <CardContent className="pt-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Comptables</p>
                  <p className="text-xs text-muted-foreground">
                    {filteredComptables.length} résultat(s)
                  </p>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un comptable..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comptable</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Dossiers</TableHead>
                      <TableHead>En attente</TableHead>
                      <TableHead>Factures</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredComptables.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          Aucun comptable trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredComptables.map((comptable) => {
                        const agg = comptablesById.get(comptable.id) || {
                          dossiers: 0,
                          invoices: 0,
                          pending: 0,
                        };
                        return (
                          <TableRow
                            key={comptable.id}
                            className="cursor-pointer hover:bg-accent/40"
                            onClick={() => router.push(`/admin/comptables/${comptable.id}`)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                                  {initialsFromEmail(comptable.email)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {comptable.email.split("@")[0]}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {comptable.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={comptable.active ? "default" : "secondary"} className="text-xs">
                                {comptable.active ? "Actif" : "Inactif"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{agg.dossiers}</TableCell>
                            <TableCell className="font-medium">{agg.pending}</TableCell>
                            <TableCell className="font-medium">{agg.invoices}</TableCell>
                            <TableCell className="text-right">
                              <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dossiers">
          <div className="space-y-2">
            {filteredDossiers.map((dossier) => (
              <Card
                key={dossier.id}
                className="border-border/50 hover:border-border cursor-pointer"
                onClick={() => openDossier(dossier.id, dossier.name)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {dossier.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dossier.fournisseurName} · Comptable :{" "}
                          {dossier.comptableName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {dossier.invoicesCount} factures
                      </span>
                      {dossier.pendingInvoicesCount > 0 && (
                        <Badge className="bg-amber-500 text-white text-xs border-none">
                          {dossier.pendingInvoicesCount} en attente
                        </Badge>
                      )}
                      <button
                        className="text-xs text-primary underline hover:text-primary/70 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setComptableModal({
                            dossierId: dossier.id,
                            dossierName: dossier.name,
                          });
                        }}
                      >
                        {comptableIds.has(dossier.comptableId)
                          ? "Modifier comptable"
                          : "Choisir comptable"}
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet
        open={comptableModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setComptableModal(null);
            setComptableSearch("");
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Sélectionner un comptable</SheetTitle>
            <SheetDescription>
              {comptableModal ? (
                <>
                  Dossier :{" "}
                  <span className="font-medium text-foreground">
                    {comptableModal.dossierName}
                  </span>
                </>
              ) : (
                "Choisissez le comptable à assigner."
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={comptableSearch}
                onChange={(event) => setComptableSearch(event.target.value)}
                placeholder="Rechercher un comptable..."
                className="pl-9"
              />
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {comptables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun comptable disponible
              </p>
            ) : filteredAssignComptables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun comptable trouvé
              </p>
            ) : (
              filteredAssignComptables.map((c) => (
                <button
                  key={c.id}
                  disabled={savingComptable}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleAssignComptable(c.id)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {initialsFromEmail(c.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.email.split("@")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.email}
                    </p>
                  </div>
                </button>
              ))
            )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Statistiques détaillées",
            desc: "Graphiques et KPIs",
            icon: BarChart3,
            href: "/admin/statistiques",
          },
          {
            label: "Journal d'audit",
            desc: "Traçabilité des actions",
            icon: ShieldCheck,
            href: "/admin/audit",
          },
          {
            label: "Gestion des utilisateurs",
            desc: "Créer et gérer les comptes",
            icon: Users,
            href: "/admin/utilisateurs",
          },
        ].map((link) => (
          <Card
            key={link.href}
            className="border-border/50 hover:border-primary/40 cursor-pointer hover:shadow-md transition-all group"
            onClick={() => router.push(link.href)}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <link.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{link.label}</p>
                  <p className="text-xs text-muted-foreground">{link.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <AdminPageContent />
    </AuthGuard>
  );
}
