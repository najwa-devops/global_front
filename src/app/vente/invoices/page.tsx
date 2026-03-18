"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { salesInvoiceDtoToLocal, toWorkflowStatus } from "@/lib/utils";
import { type DynamicInvoice } from "@/lib/types";
import {
  InvoiceFilters,
  type FilterValues,
} from "@/components/invoice-filters";
import { InvoiceTable } from "@/components/invoice-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Clock, CheckCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export default function VenteInvoicesPage() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    supplier: "",
    status: "",
  });
  const router = useRouter();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      const dossierId = getCurrentDossierId();
      if (!dossierId) {
        toast.error("Dossier requis: ouvrez un dossier avant l'accès aux factures.");
        router.push("/dossiers");
        return;
      }
      const dtos = await api.getSalesPendingInvoices(dossierId);
      const localInvoices = dtos.map(salesInvoiceDtoToLocal);
      setInvoices(
        localInvoices.filter((inv) => !inv.accounted && !inv.accountedAt),
      );
    } catch (err) {
      console.error("Error loading sales invoices:", err);
      toast.error("Erreur lors du chargement des factures vente.");
    } finally {
      setIsLoading(false);
    }
  };

  const clients = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      const v =
        inv.fields.find((f) => f.key === "clientName")?.value ||
        inv.fields.find((f) => f.key === "supplier")?.value;
      if (v) set.add(String(v));
    });
    return Array.from(set);
  }, [invoices]);

  const applyFilters = (list: DynamicInvoice[]) => {
    return list.filter((invoice) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesFile = invoice.filename.toLowerCase().includes(q);
        const matchesNum = String(
          invoice.fields.find((f) => f.key === "invoiceNumber")?.value || "",
        ).toLowerCase().includes(q);
        const matchesClient = String(
          invoice.fields.find((f) => f.key === "clientName")?.value ||
            invoice.fields.find((f) => f.key === "supplier")?.value ||
            "",
        ).toLowerCase().includes(q);
        if (!matchesFile && !matchesNum && !matchesClient) return false;
      }

      if (filters.supplier && filters.supplier !== "all") {
        const client =
          invoice.fields.find((f) => f.key === "clientName")?.value ||
          invoice.fields.find((f) => f.key === "supplier")?.value;
        if (client !== filters.supplier) return false;
      }

      if (filters.status && filters.status !== "all") {
        if (toWorkflowStatus(invoice.status) !== String(filters.status).toUpperCase())
          return false;
      }

      if (filters.dateFrom && invoice.createdAt < filters.dateFrom) return false;
      if (filters.dateTo && invoice.createdAt > filters.dateTo) return false;

      if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
        const ttc = Number.parseFloat(
          String(invoice.fields.find((f) => f.key === "amountTTC")?.value || "0"),
        );
        if (filters.amountMin !== undefined && ttc < filters.amountMin) return false;
        if (filters.amountMax !== undefined && ttc > filters.amountMax) return false;
      }
      return true;
    });
  };

  const { user } = useAuth();
  const isAccountingRole =
    user?.role === "ADMIN" ||
    user?.role === "COMPTABLE" ||
    user?.role === "SUPER_ADMIN";

  const handleProcessInline = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Traitement OCR en cours...", {
        id: `process-${invoice.id}`,
      });
      await api.processSalesInvoice(invoice.id);
      await loadInvoices();
      toast.success("OCR terminé", { id: `process-${invoice.id}` });
    } catch (err) {
      toast.error("Erreur traitement", { id: `process-${invoice.id}` });
    }
  };

  const handleConfirmInvoice = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Confirmation en cours...", {
        id: `confirm-${invoice.id}`,
      });
      await api.updateSalesInvoiceStatus(invoice.id, "READY_TO_TREAT");
      await loadInvoices();
      toast.success("Facture confirmée par le fournisseur", {
        id: `confirm-${invoice.id}`,
      });
    } catch (err) {
      toast.error("Erreur de confirmation", {
        id: `confirm-${invoice.id}`,
      });
    }
  };

  const handleFinalValidate = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Validation en cours...", { id: `validate-${invoice.id}` });
      await api.validateSalesInvoice(invoice.id);
      await loadInvoices();
      toast.success("Facture vente validée", { id: `validate-${invoice.id}` });
    } catch (err) {
      toast.error("Erreur de validation", { id: `validate-${invoice.id}` });
    }
  };

  const handleAccountInvoice = async (invoice: DynamicInvoice) => {
    try {
      const result = await api.accountSalesInvoice(invoice.id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
      toast.success(
        result?.status ? "Facture comptabilisée" : "Comptabilisation effectuée",
      );
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la comptabilisation");
    }
  };

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteSalesInvoice(invoiceId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      toast.success("Facture supprimée");
    } catch (err) {
      toast.error("Erreur suppression");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Factures Vente En Attente</CardTitle>
              <CardDescription>
                {invoices.length} facture{invoices.length > 1 ? "s" : ""} à traiter
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <InvoiceFilters
        filters={filters}
        onFiltersChange={setFilters}
        suppliers={clients}
        onExport={() => {}}
      />

      <InvoiceTable
        invoices={applyFilters(invoices)}
        onView={(inv) =>
          router.push(
            inv.dossierId
              ? `/vente/ocr/${inv.id}?dossierId=${inv.dossierId}`
              : `/vente/ocr/${inv.id}`,
          )
        }
        onProcessOcr={() => {}}
        onProcessInline={handleProcessInline}
        onDelete={handleDeleteInvoice}
        onConfirm={handleConfirmInvoice}
        onFinalValidate={isAccountingRole ? undefined : handleFinalValidate}
        onAccount={isAccountingRole ? handleAccountInvoice : undefined}
        userRole={user?.role}
      />

      {invoices.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="pt-16 pb-16 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="mt-6 text-lg font-medium">
              Aucune facture vente en attente
            </h3>
            <Button
              className="mt-6 gap-2"
              onClick={() => router.push("/vente/upload")}
            >
              <Upload className="h-4 w-4" />
              Uploader
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const id = Number(localStorage.getItem("currentDossierId"));
  return Number.isFinite(id) && id > 0 ? id : undefined;
}
