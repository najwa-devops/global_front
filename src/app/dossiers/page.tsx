"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/api";
import { Dossier, CreateDossierRequest } from "@/src/types/dossier";
import { AdminService } from "@/src/api/services/admin.service";
import { ComptableAdminDto } from "@/src/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  Plus,
  Search,
  FileText,
  Building2,
  ChevronRight,
  Trash2,
  ReceiptText,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateDossierModal } from "@/components/create-dossier-modal";
import { toast } from "sonner";
import { GeneralParamsService } from "@/src/api/services/general-params.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function mapBackendDossier(raw: any): Dossier {
  return {
    id: raw.id,
    name: raw.name,
    fournisseur: {
      id: raw.fournisseurId ?? 0,
      name: raw.fournisseurEmail ?? "Fournisseur",
      email: raw.fournisseurEmail ?? "",
    },
    comptableId: raw.comptableId ?? 0,
    comptableName: raw.comptableEmail ?? "",
    ice: raw.ice ?? undefined,
    invoicesCount: raw.invoicesCount ?? 0,
    bankStatementsCount: raw.bankStatementsCount ?? 0,
    centreMonetiqueCount: raw.centreMonetiqueCount ?? 0,
    pendingInvoicesCount: raw.pendingInvoicesCount ?? 0,
    validatedInvoicesCount: raw.validatedInvoicesCount ?? 0,
    status:
      String(raw.status || "ACTIVE").toUpperCase() === "ARCHIVED"
        ? "inactive"
        : "active",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    exerciseStartDate: raw.exerciseStartDate ?? undefined,
    exerciseEndDate: raw.exerciseEndDate ?? undefined,
  };
}

function formatExerciseRange(start?: string, end?: string): string {
  if (!start && !end) return "-";
  const startText = start
    ? new Date(start).toLocaleDateString("fr-FR")
    : "?";
  const endText = end
    ? new Date(end).toLocaleDateString("fr-FR")
    : "?";
  return `${startText} → ${endText}`;
}

function DossiersPageContent() {
  const { user, isComptable, isAdmin } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [comptables, setComptables] = useState<ComptableAdminDto[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [comptableModal, setComptableModal] = useState<{
    dossierId: number;
    dossierName: string;
  } | null>(null);
  const [savingComptable, setSavingComptable] = useState(false);

  useEffect(() => {
    if (user?.role === "CLIENT") {
      router.replace("/client/dashboard");
    }
  }, [router, user?.role]);

  if (user?.role === "CLIENT") {
    return null;
  }

  const loadDossiers = async () => {
    try {
      setLoading(true);
      const items = await api.getDossiers();
      setDossiers((items || []).map(mapBackendDossier));
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors du chargement des dossiers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDossiers();
    if (isAdmin()) {
      AdminService.listComptables()
        .then(setComptables)
        .catch(() => {});
    }
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return dossiers.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.fournisseur.name.toLowerCase().includes(term) ||
        String(d.ice || "").toLowerCase().includes(term),
    );
  }, [dossiers, search]);

  const comptableIds = useMemo(
    () => new Set(comptables.map((c) => c.id)),
    [comptables],
  );

  const totalInvoices = dossiers.reduce((sum, dossier) => sum + dossier.invoicesCount, 0);
  const totalBankStatements = dossiers.reduce((sum, dossier) => sum + dossier.bankStatementsCount, 0);
  const totalCentreMonetique = dossiers.reduce((sum, dossier) => sum + dossier.centreMonetiqueCount, 0);

  const handleCreateDossier = async (req: CreateDossierRequest) => {
    try {
      const adminComptableId =
        isAdmin() && user?.id ? user.id : undefined;

      const created = await api.createDossier({
        nom: req.name,
        fournisseurEmail: req.fournisseurEmail,
        comptableId: adminComptableId,
        password: req.fournisseurPassword,
        exerciseStartDate: req.exerciseStartDate,
        exerciseEndDate: req.exerciseEndDate,
      });
      const createdDossierId = Number(created?.dossier?.id);
      if (Number.isFinite(createdDossierId) && createdDossierId > 0) {
        await GeneralParamsService.saveParams(
          {
            companyName: req.fournisseurName,
            ice: req.ice,
          },
          createdDossierId,
        );
      }
      toast.success(`Dossier "${req.name}" créé.`);
      setShowCreateModal(false);
      await loadDossiers();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la création du dossier.");
    }
  };
  const handleDeleteDossier = (id: number, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.deleteDossier(deleteConfirm.id);
      toast.success(`Dossier "${deleteConfirm.name}" supprimé.`);
      setDeleteConfirm(null);
      await loadDossiers();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  const handleAssignComptable = async (comptableId: number) => {
    if (!comptableModal) return;
    setSavingComptable(true);
    try {
      await api.changeDossierComptable(comptableModal.dossierId, comptableId);
      toast.success("Comptable assigné.");
      setComptableModal(null);
      await loadDossiers();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'assignation.");
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg text-muted-foreground">
            {loading ? "Chargement..." : `${dossiers.length} dossier(s)`}
          </h2>
        </div>
        {(isComptable() || isAdmin()) && (
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau Dossier
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un dossier ou fournisseur..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FolderOpen className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dossiers.length}</p>
                <p className="text-xs text-muted-foreground">Dossiers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <FileText className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalInvoices}</p>
                <p className="text-xs text-muted-foreground">Factures uploadées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Building2 className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalBankStatements}</p>
                <p className="text-xs text-muted-foreground">Relevés bancaires</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <ReceiptText className="h-4 w-4 text-sky-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCentreMonetique}</p>
                <p className="text-xs text-muted-foreground">Centre monétique</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            Aucun dossier trouvé
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search
              ? "Modifiez votre recherche"
              : "Créez votre premier dossier"}
          </p>
          {!search && (isComptable() || isAdmin()) && (
            <Button
              className="mt-4 gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" />
              Nouveau Dossier
            </Button>
          )}
        </div>
      ) : filtered.length > 4 ? (
        <Card className="border-border/50 bg-card/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dossier</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>ICE dossier</TableHead>
                <TableHead>Factures</TableHead>
                <TableHead>Relevés bancaires</TableHead>
                <TableHead>Centre monétique</TableHead>
                <TableHead>En attente</TableHead>
                <TableHead>Exercice</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((dossier) => (
                <TableRow
                  key={dossier.id}
                  className="cursor-pointer hover:bg-accent/50 group"
                  onClick={() => openDossier(dossier.id, dossier.name)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      {dossier.name}
                    </div>
                  </TableCell>
                  <TableCell>{dossier.fournisseur.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {dossier.ice || "-"}
                  </TableCell>
                  <TableCell>{dossier.invoicesCount}</TableCell>
                  <TableCell>{dossier.bankStatementsCount}</TableCell>
                  <TableCell>{dossier.centreMonetiqueCount}</TableCell>
                  <TableCell>
                    {dossier.pendingInvoicesCount > 0 ? (
                      <Badge
                        variant="default"
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        {dossier.pendingInvoicesCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatExerciseRange(
                      dossier.exerciseStartDate,
                      dossier.exerciseEndDate,
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isAdmin() && (
                        <button
                          className="text-xs text-primary underline hover:text-primary/70 transition-colors"
                          onClick={() =>
                            setComptableModal({
                              dossierId: dossier.id,
                              dossierName: dossier.name,
                            })
                          }
                        >
                          {comptableIds.has(dossier.comptableId)
                            ? "Modifier comptable"
                            : "Choisir comptable"}
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="group-hover:text-primary"
                        onClick={() => openDossier(dossier.id, dossier.name)}
                      >
                        Ouvrir <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                      {isAdmin() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            handleDeleteDossier(dossier.id, dossier.name)
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((dossier) => (
            <Card
              key={dossier.id}
              className="border-border/50 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer group"
              onClick={() => openDossier(dossier.id, dossier.name)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        dossier.status === "active" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {dossier.status === "active" ? "Actif" : "Inactif"}
                    </Badge>
                    {dossier.pendingInvoicesCount > 0 && (
                      <Badge className="bg-amber-500 text-white text-xs border-none">
                        {dossier.pendingInvoicesCount} en attente
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-base mt-2 leading-tight">
                  {dossier.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  {dossier.fournisseur.name}
                </CardDescription>
                <CardDescription className="text-xs mt-0.5 font-mono">
                  ICE: {dossier.ice || "-"}
                </CardDescription>
                {isAdmin() && (
                  <CardDescription className="text-xs mt-0.5 flex items-center gap-2">
                    <span>Comptable : {dossier.comptableName || "—"}</span>
                    <button
                      className="text-primary underline hover:text-primary/70 transition-colors"
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
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {dossier.invoicesCount} factures
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {dossier.bankStatementsCount} relevés
                    </span>
                    <span className="flex items-center gap-1">
                      <ReceiptText className="h-3.5 w-3.5" />
                      {dossier.centreMonetiqueCount} centre monétique
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(isComptable() || isAdmin()) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          handleDeleteDossier(dossier.id, dossier.name)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Exercice{" "}
                  {formatExerciseRange(
                    dossier.exerciseStartDate,
                    dossier.exerciseEndDate,
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteConfirm(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le dossier</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer le dossier{" "}
            <span className="font-semibold text-foreground">
              {deleteConfirm?.name}
            </span>{" "}
            ? Cette action est irréversible et supprimera toutes les données
            associées.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteConfirm(null)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleConfirmDelete}
            >
              {deleting ? "Suppression..." : "Oui, supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comptable selection modal */}
      <Dialog
        open={comptableModal !== null}
        onOpenChange={(open) => {
          if (!open) setComptableModal(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sélectionner un comptable</DialogTitle>
          </DialogHeader>
          {comptableModal && (
            <p className="text-sm text-muted-foreground -mt-2 mb-1">
              Dossier :{" "}
              <span className="font-medium text-foreground">
                {comptableModal.dossierName}
              </span>
            </p>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {comptables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun comptable disponible
              </p>
            ) : (
              comptables.map((c) => (
                <button
                  key={c.id}
                  disabled={savingComptable}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleAssignComptable(c.id)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {c.email.slice(0, 2).toUpperCase()}
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
        </DialogContent>
      </Dialog>

      <CreateDossierModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateDossier}
      />
    </div>
  );
}

export default function DossiersPage() {
  return (
    <AuthGuard allowedRoles={["COMPTABLE", "ADMIN", "CLIENT"]}>
      <DossiersPageContent />
    </AuthGuard>
  );
}
