"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Trash2,
  AlertCircle,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getCentreMonetiqueBatches, deleteCentreMonetiqueBatch } from "@/src/core/lib/centre-monetique/api";
import { getSalesInvoicesByDossier, deleteSalesInvoice, deleteBankStatement } from "@/src/core/lib/api";
import { GeneralParamsService } from "@/src/api/services/general-params.service";
import { toWorkflowStatus } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  ACCOUNTED: {
    label: "Comptabilisée",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: CheckCircle2,
  },
  READY_TO_VALIDATE: {
    label: "Prête à comptabiliser",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: CheckCircle2,
  },
  READY_TO_TREAT: {
    label: "En attente",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Clock,
  },
  VERIFY: {
    label: "À vérifier",
    color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    icon: Clock,
  },
  REJECTED: {
    label: "Rejetée",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: AlertCircle,
  },
};

const BANK_STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  COMPTABILISE: {
    label: "Comptabilisé",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: CheckCircle2,
  },
  TREATED: {
    label: "Prêt à comptabiliser",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: CheckCircle2,
  },
  PROCESSING: {
    label: "En traitement",
    color: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    icon: Clock,
  },
  PENDING: {
    label: "En attente",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Clock,
  },
  ERROR: {
    label: "Erreur",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: AlertCircle,
  },
  DUPLIQUE: {
    label: "Dupliqué",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    icon: AlertCircle,
  },
};

const CM_STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PROCESSED: {
    label: "Traité",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: CheckCircle2,
  },
  PROCESSING: {
    label: "En traitement",
    color: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    icon: Clock,
  },
  PENDING: {
    label: "En attente",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Clock,
  },
  ERROR: {
    label: "Erreur",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: AlertCircle,
  },
};

function DossierDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { isComptable, isAdmin, isClient, user } = useAuth();
  const dossierId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<any>(null);
  const [achatInvoices, setAchatInvoices] = useState<any[]>([]);
  const [venteInvoices, setVenteInvoices] = useState<any[]>([]);
  const [bankStatements, setBankStatements] = useState<any[]>([]);
  const [cmBatches, setCmBatches] = useState<any[]>([]);
  const [allowDeleteValidated, setAllowDeleteValidated] = useState(false);
  const [allowDeleteAccounted, setAllowDeleteAccounted] = useState(false);

  const canEdit = isComptable() || isAdmin();

  useEffect(() => {
    if (isClient()) {
      router.replace("/client/dashboard");
    }
  }, [isClient, router]);

  if (isClient()) {
    return null;
  }

  const loadData = async () => {
    try {
      setLoading(true);
      if (typeof window !== "undefined" && Number.isFinite(dossierId) && dossierId > 0) {
        localStorage.setItem("currentDossierId", String(dossierId));
      }
      const [allDossiers, allInvoices, allSalesInvoices, allStatements, allCm, generalParams] = await Promise.all([
        api.getDossiers().catch(() => []),
        api.getAllInvoices(undefined, undefined, 200, dossierId).catch(() => []),
        getSalesInvoicesByDossier(dossierId).catch(() => []),
        api.getAllBankStatements({ limit: 200, dossierId }).catch(() => []),
        getCentreMonetiqueBatches(200).catch(() => []),
        GeneralParamsService.getParams(dossierId).catch(() => ({})),
      ]);
      setAllowDeleteValidated(Boolean((generalParams as any)?.allowValidatedDocumentDeletion));
      setAllowDeleteAccounted(Boolean((generalParams as any)?.allowAccountedDocumentDeletion));

      const currentDossier =
        (allDossiers || []).find((d: any) => d.id === dossierId) || null;
      const dossierAchat = (allInvoices || []).filter((inv: any) => inv.dossierId === dossierId);
      const dossierVente = allSalesInvoices || [];
      const dossierStatements = allStatements || [];
      const dossierCm = (allCm || []).filter((b: any) =>
        !b.dossierId || b.dossierId === dossierId,
      );

      setDossier(currentDossier);
      setAchatInvoices(dossierAchat);
      setVenteInvoices(dossierVente);
      setBankStatements(dossierStatements);
      setCmBatches(dossierCm);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ne pas charger si l'utilisateur n'est pas encore résolu ou est un client
    if (!user || isClient()) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId, user]);

  useEffect(() => {
    if (!dossier?.name || typeof window === "undefined") return;
    localStorage.setItem("currentDossierId", String(dossierId));
    localStorage.setItem("currentDossierName", dossier.name);
  }, [dossier?.name, dossierId]);

  const allInvoices = useMemo(() => [...achatInvoices, ...venteInvoices], [achatInvoices, venteInvoices]);

  const stats = useMemo(() => {
    const accounted =
      allInvoices.filter((i) => String(i.status || "").toUpperCase() === "ACCOUNTED").length +
      bankStatements.filter((s) => String(s.status || "").toUpperCase() === "COMPTABILISE").length;
    const pending = allInvoices.filter((i) => {
      const s = String(i.status || "").toUpperCase();
      return s !== "ACCOUNTED" && s !== "ERROR" && s !== "DUPLICATE";
    }).length + bankStatements.filter((s) => String(s.status || "").toUpperCase() !== "COMPTABILISE").length;
    return {
      achat: achatInvoices.length,
      vente: venteInvoices.length,
      pending,
      accounted,
      bank: bankStatements.length,
      cm: cmBatches.length,
    };
  }, [allInvoices, achatInvoices, venteInvoices, bankStatements, cmBatches]);

  if (!loading && !dossier) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Dossier introuvable</h2>
        <Button variant="outline" onClick={() => router.back()}>
          Retour
        </Button>
      </div>
    );
  }

  const handleDelete = async (invoiceId: number) => {
    try {
      await api.deleteInvoice(invoiceId);
      toast.success("Facture supprimée");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Erreur de suppression");
    }
  };

  const handleUpload = () => {
    router.push(`/achat/upload?dossierId=${dossierId}`);
  };

  const handleDeleteBank = async (stmtId: number) => {
    try {
      await deleteBankStatement(stmtId);
      toast.success("Relevé supprimé");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Erreur de suppression");
    }
  };

  const handleDeleteCm = async (batchId: number) => {
    try {
      await deleteCentreMonetiqueBatch(batchId);
      toast.success("Centre Monétique supprimé");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Erreur de suppression");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          {
            label: "Factures Achat",
            value: stats.achat,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            icon: FileText,
          },
          {
            label: "Factures Vente",
            value: stats.vente,
            color: "text-violet-500",
            bg: "bg-violet-500/10",
            icon: FileText,
          },
          {
            label: "En attente",
            value: stats.pending,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            icon: Clock,
          },
          {
            label: "Comptabilisées",
            value: stats.accounted,
            color: "text-green-500",
            bg: "bg-green-500/10",
            icon: CheckCircle2,
          },
          {
            label: "Relevés bancaires",
            value: stats.bank,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
            icon: Building2,
          },
          {
            label: "Centre Monétique",
            value: stats.cm,
            color: "text-sky-500",
            bg: "bg-sky-500/10",
            icon: ReceiptText,
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loading ? "..." : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="achat">
        <TabsList>
          <TabsTrigger value="achat" className="gap-2">
            <FileText className="h-4 w-4" />
            Factures Achat ({achatInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="vente" className="gap-2">
            <FileText className="h-4 w-4" />
            Factures Vente ({venteInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2">
            <Building2 className="h-4 w-4" />
            Relevés Bancaires ({bankStatements.length})
          </TabsTrigger>
          <TabsTrigger value="cm" className="gap-2">
            <ReceiptText className="h-4 w-4" />
            Centre Monétique ({cmBatches.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Factures Achat ── */}
        <TabsContent value="achat" className="mt-4">
          {achatInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Aucune facture achat dans ce dossier</p>
              <Button className="mt-4 gap-2" onClick={handleUpload}>
                <Upload className="h-4 w-4" />
                Importer une facture achat
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {achatInvoices.map((inv) => {
                const rawStatus = String(inv.status || "").toUpperCase();
                const wfStatus = rawStatus === "ACCOUNTED" ? "ACCOUNTED" : toWorkflowStatus(inv.status);
                const statusInfo = STATUS_MAP[wfStatus] ?? STATUS_MAP.READY_TO_TREAT;
                const StatusIcon = statusInfo.icon;
                const amount = inv.fieldsData?.totalTtc?.value ?? inv.fieldsData?.amountTTC?.value ?? 0;
                const isAccounted = rawStatus === "ACCOUNTED";
                const isClientValidatedInv = Boolean(inv.clientValidated);
                const canDeleteInvoice = canEdit && (
                  (!isAccounted && !isClientValidatedInv) ||
                  (isClientValidatedInv && !isAccounted && allowDeleteValidated) ||
                  (isAccounted && allowDeleteAccounted && isAdmin())
                );
                return (
                  <Card key={inv.id} className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{inv.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold">
                            {Number(amount || 0).toLocaleString("fr-FR")} MAD
                          </span>
                          <Badge className={`text-xs border ${statusInfo.color} flex items-center gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => router.push(`/achat/ocr/${inv.id}?dossierId=${dossierId}`)}
                              title="Voir"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canDeleteInvoice && (
                              <Button
                                size="icon" variant="ghost"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(inv.id)}
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Factures Vente ── */}
        <TabsContent value="vente" className="mt-4">
          {venteInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Aucune facture vente dans ce dossier</p>
              <Button className="mt-4 gap-2" onClick={() => router.push(`/vente/upload?dossierId=${dossierId}`)}>
                <Upload className="h-4 w-4" />
                Importer une facture vente
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {venteInvoices.map((inv) => {
                const rawStatusV = String(inv.status || "").toUpperCase();
                const wfStatusV = rawStatusV === "ACCOUNTED" ? "ACCOUNTED" : toWorkflowStatus(inv.status);
                const statusInfoV = STATUS_MAP[wfStatusV] ?? STATUS_MAP.READY_TO_TREAT;
                const StatusIconV = statusInfoV.icon;
                const amount = inv.fieldsData?.totalTtc?.value ?? inv.fieldsData?.amountTTC?.value ?? 0;
                const isAccountedV = rawStatusV === "ACCOUNTED";
                const isClientValidatedVente = Boolean(inv.clientValidated);
                const canDeleteVente = canEdit && (
                  (!isAccountedV && !isClientValidatedVente) ||
                  (isClientValidatedVente && !isAccountedV && allowDeleteValidated) ||
                  (isAccountedV && allowDeleteAccounted && isAdmin())
                );
                return (
                  <Card key={inv.id} className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-violet-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{inv.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold">
                            {Number(amount || 0).toLocaleString("fr-FR")} MAD
                          </span>
                          <Badge className={`text-xs border ${statusInfoV.color} flex items-center gap-1`}>
                            <StatusIconV className="h-3 w-3" />
                            {statusInfoV.label}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => router.push(`/vente/ocr/${inv.id}?dossierId=${dossierId}`)}
                              title="Voir"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canDeleteVente && (
                              <Button
                                size="icon" variant="ghost"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                  try {
                                    await deleteSalesInvoice(inv.id);
                                    toast.success("Facture vente supprimée");
                                    await loadData();
                                  } catch {
                                    toast.error("Erreur de suppression");
                                  }
                                }}
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          {bankStatements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                Aucun relevé bancaire dans ce dossier
              </p>
              {canEdit && (
                <Button
                  className="mt-4 gap-2"
                  onClick={() => router.push("/bank/upload")}
                >
                  <Upload className="h-4 w-4" />
                  Importer un relevé
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {bankStatements.map((stmt: any) => {
                const bankStatusKey = String(stmt.status || stmt.displayStatus || stmt.statusCode || "").toUpperCase();
                const bankStatusInfo = BANK_STATUS_MAP[bankStatusKey] ?? BANK_STATUS_MAP.PENDING;
                const BankStatusIcon = bankStatusInfo.icon;
                const isBankAccounted = bankStatusKey === "COMPTABILISE";
                const isBankValidated = bankStatusKey === "VALIDATED";
                const isBankClientValidated = Boolean(stmt.clientValidated);
                const canDeleteBank = canEdit && (
                  (!isBankAccounted && !isBankValidated && !isBankClientValidated) ||
                  ((isBankValidated || isBankClientValidated) && !isBankAccounted && allowDeleteValidated) ||
                  (isBankAccounted && allowDeleteAccounted && isAdmin())
                );
                return (
                  <Card key={stmt.id} className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {stmt.filename || stmt.originalName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {stmt.createdAt ? new Date(stmt.createdAt).toLocaleDateString("fr-FR") : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-xs border ${bankStatusInfo.color} flex items-center gap-1`}>
                            <BankStatusIcon className="h-3 w-3" />
                            {bankStatusInfo.label}
                          </Badge>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => router.push(`/bank/detail/${stmt.id}`)}
                            title="Voir"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {canDeleteBank && (
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteBank(stmt.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cm" className="mt-4">
          {cmBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ReceiptText className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                Aucun document Centre Monétique dans ce dossier
              </p>
              {canEdit && (
                <Button
                  className="mt-4 gap-2"
                  onClick={() => router.push("/centre-monetique")}
                >
                  <Upload className="h-4 w-4" />
                  Importer un fichier Centre Monétique
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {cmBatches.map((batch: any) => {
                const cmStatusKey = String(batch.status || "PENDING").toUpperCase();
                const cmStatusInfo = CM_STATUS_MAP[cmStatusKey] ?? CM_STATUS_MAP.PENDING;
                const CmStatusIcon = cmStatusInfo.icon;
                return (
                  <Card key={batch.id} className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <ReceiptText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {batch.originalName || batch.filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {batch.statementPeriod || batch.structure || "—"}
                              {batch.createdAt ? ` · ${new Date(batch.createdAt).toLocaleDateString("fr-FR")}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {batch.soldeNetRemise && (
                            <span className="text-sm font-semibold">
                              {Number(batch.soldeNetRemise).toLocaleString("fr-FR")} MAD
                            </span>
                          )}
                          <Badge className={`text-xs border ${cmStatusInfo.color} flex items-center gap-1`}>
                            <CmStatusIcon className="h-3 w-3" />
                            {cmStatusInfo.label}
                          </Badge>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => router.push("/centre-monetique")}
                            title="Voir"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {canEdit && (
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteCm(batch.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DossierDetailPage() {
  return (
    <AuthGuard>
      <DossierDetailContent />
    </AuthGuard>
  );
}
