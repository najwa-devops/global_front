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
  ArrowLeft,
  Upload,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Sparkles,
  Trash2,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { toWorkflowStatus } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> =
  {
    VALIDATED: {
      label: "Validée",
      color: "bg-green-500/10 text-green-600 border-green-500/20",
      icon: CheckCircle2,
    },
    READY_TO_VALIDATE: {
      label: "Prête",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      icon: Sparkles,
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

function DossierDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { isComptable, isAdmin, isClient } = useAuth();
  const dossierId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bankStatements, setBankStatements] = useState<any[]>([]);

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
      const [allDossiers, allInvoices, allStatements] = await Promise.all([
        api.getDossiers().catch(() => []),
        api.getAllInvoices(undefined, undefined, 200, dossierId).catch(() => []),
        api.getAllBankStatements({ limit: 200, dossierId }).catch(() => []),
      ]);

      const currentDossier =
        (allDossiers || []).find((d: any) => d.id === dossierId) || null;
      const dossierInvoices = (allInvoices || []).filter((inv: any) => inv.dossierId === dossierId);
      const dossierStatements = (allStatements || []).filter((s: any) => s.dossierId === dossierId);

      setDossier(currentDossier);
      setInvoices(dossierInvoices);
      setBankStatements(dossierStatements);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId]);

  useEffect(() => {
    if (!dossier?.name || typeof window === "undefined") return;
    localStorage.setItem("currentDossierId", String(dossierId));
    localStorage.setItem("currentDossierName", dossier.name);
  }, [dossier?.name, dossierId]);

  const stats = useMemo(() => {
    const pending = invoices.filter((i) => {
      const s = toWorkflowStatus(i.status);
      return s === "VERIFY" || s === "READY_TO_TREAT";
    }).length;
    const validated = invoices.filter(
      (i) => toWorkflowStatus(i.status) === "VALIDATED",
    ).length;
    return {
      total: invoices.length,
      pending,
      validated,
      bank: bankStatements.length,
    };
  }, [invoices, bankStatements]);

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

  const handleValidate = async (invoiceId: number) => {
    try {
      await api.validateInvoice(invoiceId);
      toast.success("Facture validée avec succès");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Erreur de validation");
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total factures",
            value: stats.total,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
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
            label: "Validées",
            value: stats.validated,
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

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            Factures ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2">
            <Building2 className="h-4 w-4" />
            Relevés Bancaires ({bankStatements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                Aucune facture dans ce dossier
              </p>
              <Button className="mt-4 gap-2" onClick={handleUpload}>
                <Upload className="h-4 w-4" />
                Importer la première facture
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => {
                const wfStatus = toWorkflowStatus(inv.status);
                const statusInfo =
                  STATUS_MAP[wfStatus] ?? STATUS_MAP.READY_TO_TREAT;
                const StatusIcon = statusInfo.icon;
                const amount =
                  inv.fieldsData?.totalTtc?.value ??
                  inv.fieldsData?.amountTTC?.value ??
                  0;
                const date = inv.createdAt;
                const canValidate = canEdit && wfStatus === "READY_TO_VALIDATE";
                return (
                  <Card
                    key={inv.id}
                    className="border-border/50 hover:border-border transition-colors"
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {inv.filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(date).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold">
                            {Number(amount || 0).toLocaleString("fr-FR")} MAD
                          </span>
                          <Badge
                            className={`text-xs border ${statusInfo.color} flex items-center gap-1`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() =>
                                router.push(
                                  `/achat/ocr/${inv.id}?dossierId=${dossierId}`,
                                )
                              }
                              title="Voir"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canValidate && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                onClick={() => handleValidate(inv.id)}
                                title="Valider"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                size="icon"
                                variant="ghost"
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
              {bankStatements.map((stmt: any) => (
                <Card
                  key={stmt.id}
                  className="border-border/50 hover:border-border transition-colors"
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {stmt.filename || stmt.originalName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
