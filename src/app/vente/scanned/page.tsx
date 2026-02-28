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
import { FileText, CheckCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export default function VenteScannedPage() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    supplier: "",
    status: "",
  });
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === "CLIENT" || user?.role === "FOURNISSEUR") {
      toast.info("Cette page est réservée au traitement comptable.");
      router.replace("/vente/invoices");
      return;
    }
    loadInvoices();
  }, [user?.role]);

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      const dossierId = getCurrentDossierId();
      if (!dossierId) {
        toast.error("Dossier requis: ouvrez un dossier avant l'accès aux factures.");
        router.push("/dossiers");
        return;
      }
      const dtos = await api.getSalesScannedInvoices(dossierId);
      const localInvoices = dtos.map(salesInvoiceDtoToLocal);
      setInvoices(localInvoices);
    } catch (err) {
      console.error("Error loading scanned sales invoices:", err);
      toast.error("Erreur lors du chargement des factures vente scannées.");
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

  const handleProcessInline = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Traitement OCR en cours...", {
        id: `process-${invoice.id}`,
      });
      await api.processSalesInvoice(invoice.id);
      await loadInvoices();
      toast.success("OCR terminé", { id: `process-${invoice.id}` });
    } catch {
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
    } catch {
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
    } catch {
      toast.error("Erreur de validation", { id: `validate-${invoice.id}` });
    }
  };

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteSalesInvoice(invoiceId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      toast.success("Facture supprimée");
    } catch {
      toast.error("Erreur suppression");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="h-8 w-8 text-primary animate-pulse" />
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
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Factures Vente Scannées</CardTitle>
              <CardDescription>
                {invoices.length} facture{invoices.length > 1 ? "s" : ""} scannée
                {invoices.length > 1 ? "s" : ""}
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
        onFinalValidate={handleFinalValidate}
        userRole={user?.role}
      />

      {invoices.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="pt-16 pb-16 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="mt-6 text-lg font-medium">
              Aucune facture vente scannée
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
