"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { dynamicInvoiceDtoToLocal, toWorkflowStatus } from "@/lib/utils";
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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    supplier: "",
    status: "",
    invoiceType: "",
  });
  const router = useRouter();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      const dtos = await api.getAllInvoices();
      const localInvoices = dtos.map(dynamicInvoiceDtoToLocal);
      // Filtrer pour ne garder que les non-validées (comportement original de currentPage === "invoices")
      const pending = localInvoices.filter(
        (inv) => toWorkflowStatus(inv.status) !== "VALIDATED",
      );
      setInvoices(pending);
    } catch (err) {
      console.error("Error loading invoices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const suppliers = useMemo(() => {
    const supplierSet = new Set<string>();
    invoices.forEach((inv) => {
      const supplier = inv.fields.find((f) => f.key === "supplier")?.value;
      if (supplier) supplierSet.add(String(supplier));
    });
    return Array.from(supplierSet);
  }, [invoices]);

  const applyFilters = (invoicesList: DynamicInvoice[]) => {
    return invoicesList.filter((invoice) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesFilename = invoice.filename
          .toLowerCase()
          .includes(searchLower);
        const matchesNumber = String(
          invoice.fields.find((f) => f.key === "invoiceNumber")?.value || "",
        )
          .toLowerCase()
          .includes(searchLower);
        const matchesSupplier = String(
          invoice.fields.find((f) => f.key === "supplier")?.value || "",
        )
          .toLowerCase()
          .includes(searchLower);
        if (!matchesFilename && !matchesNumber && !matchesSupplier)
          return false;
      }

      if (filters.supplier && filters.supplier !== "all") {
        const supplier = invoice.fields.find(
          (f) => f.key === "supplier",
        )?.value;
        if (supplier !== filters.supplier) return false;
      }

      if (filters.status && filters.status !== "all") {
        if (
          toWorkflowStatus(invoice.status) !==
          String(filters.status).toUpperCase()
        )
          return false;
      }

      if (filters.invoiceType && filters.invoiceType !== "all") {
        const isAvoir = Boolean(invoice.isAvoir);
        const matchesType =
          (filters.invoiceType === "AVOIR" && isAvoir) ||
          (filters.invoiceType === "FACTURE" && !isAvoir);
        if (!matchesType) return false;
      }

      if (filters.dateFrom && invoice.createdAt < filters.dateFrom)
        return false;
      if (filters.dateTo && invoice.createdAt > filters.dateTo) return false;

      if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
        const ttc = Number.parseFloat(
          String(
            invoice.fields.find((f) => f.key === "amountTTC")?.value || "0",
          ),
        );
        if (filters.amountMin !== undefined && ttc < filters.amountMin)
          return false;
        if (filters.amountMax !== undefined && ttc > filters.amountMax)
          return false;
      }
      return true;
    });
  };

  const handleProcessInline = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Traitement OCR en cours...", {
        id: `process-${invoice.id}`,
      });
      await api.processInvoice(invoice.id);
      await loadInvoices();
      toast.success(`✓ OCR terminé`, { id: `process-${invoice.id}` });
    } catch (err) {
      toast.error("Erreur traitement", { id: `process-${invoice.id}` });
    }
  };

  const { user } = useAuth();

  const handleConfirmInvoice = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Confirmation en cours...", {
        id: `confirm-${invoice.id}`,
      });
      await api.updateInvoiceStatus(invoice.id, "READY_TO_TREAT");
      await loadInvoices();
      toast.success(`✓ Facture confirmée par le fournisseur`, {
        id: `confirm-${invoice.id}`,
      });
    } catch (err) {
      toast.error("Erreur de confirmation", { id: `confirm-${invoice.id}` });
    }
  };

  const handleFinalValidate = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Validation finale en cours...", {
        id: `validate-${invoice.id}`,
      });
      await api.validateInvoice(invoice.id);
      await loadInvoices();
      toast.success(`✓ Facture validée définitivement`, {
        id: `validate-${invoice.id}`,
      });
    } catch (err) {
      toast.error("Erreur de validation finale", {
        id: `validate-${invoice.id}`,
      });
    }
  };

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteDynamicInvoice(invoiceId);
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Factures En Attente</CardTitle>
              <CardDescription>
                {invoices.length} facture{invoices.length > 1 ? "s" : ""} à
                traiter
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <InvoiceFilters
        filters={filters}
        onFiltersChange={setFilters}
        suppliers={suppliers}
        onExport={() => {}}
      />

      <InvoiceTable
        invoices={applyFilters(invoices)}
        onView={(inv) =>
          router.push(
            inv.dossierId
              ? `/achat/ocr/${inv.id}?dossierId=${inv.dossierId}`
              : `/achat/ocr/${inv.id}`,
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
              Aucune facture en attente
            </h3>
            <Button
              className="mt-6 gap-2"
              onClick={() => router.push("/achat/upload")}
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
