"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, CheckCircle, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { invoiceDtoToLocal, toWorkflowStatus } from "@/lib/utils";
import { type DynamicInvoice, type UserRole } from "@/lib/types";
import {
  InvoiceFilters,
  type FilterValues,
} from "@/components/invoice-filters";
import { ValidatedInvoicesPage } from "@/components/validated-invoices-page";

export default function ValidatedInvoicesRoutePage() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    supplier: "",
    status: "all",
    invoiceType: "all",
  });
  const router = useRouter();

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    api
      .getCurrentUser()
      .then((u) => setUserRole(u.role))
      .catch(() => setUserRole(null));
  }, []);

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      const dtos = await api.getAllInvoices();
      const localInvoices = dtos.map(invoiceDtoToLocal);
      setInvoices(
        localInvoices.filter(
          (inv) =>
            toWorkflowStatus(inv.status) === "VALIDATED" ||
            Boolean(inv.accounted || inv.accountedAt),
        ),
      );
    } catch (err) {
      console.error("Error loading validated invoices:", err);
      toast.error("Impossible de charger les factures validées");
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

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesFilename = invoice.filename.toLowerCase().includes(searchLower);
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
        if (!matchesFilename && !matchesNumber && !matchesSupplier) return false;
      }

      if (filters.supplier && filters.supplier !== "all") {
        const supplier = invoice.fields.find((f) => f.key === "supplier")?.value;
        if (supplier !== filters.supplier) return false;
      }

      if (filters.status && filters.status !== "all") {
        if (toWorkflowStatus(invoice.status) !== String(filters.status).toUpperCase()) {
          return false;
        }
      }

      if (filters.invoiceType && filters.invoiceType !== "all") {
        const isAvoir = Boolean(invoice.isAvoir);
        const matchesType =
          (filters.invoiceType === "AVOIR" && isAvoir) ||
          (filters.invoiceType === "FACTURE" && !isAvoir);
        if (!matchesType) return false;
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
  }, [invoices, filters]);

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteInvoice(invoiceId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      toast.success("Facture supprimée");
    } catch (err) {
      toast.error("Erreur suppression");
    }
  };

  const handleAccountInvoice = async (invoice: DynamicInvoice) => {
    try {
      const result = await api.accountInvoiceEntries(invoice.id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
      toast.success(result?.message || "Facture comptabilisée");
    } catch (err: any) {
      const message =
        err?.message === "missing_accounting_data"
          ? "Données comptables manquantes pour cette facture."
          : err?.message === "duplicate_invoice_number"
            ? "Comptabilisation impossible: facture déjà existante avec le même numéro."
            : err?.message || "Erreur lors de la comptabilisation";
      toast.error(message);
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
    <ValidatedInvoicesPage
      invoices={filteredInvoices}
      filters={filters}
      onFiltersChange={setFilters}
      suppliers={suppliers}
      onView={(inv) =>
        router.push(
          inv.dossierId
            ? `/achat/ocr/${inv.id}?dossierId=${inv.dossierId}`
            : `/achat/ocr/${inv.id}`,
        )
      }
      onDelete={handleDeleteInvoice}
      onAccount={
        userRole === "CLIENT" ? undefined : handleAccountInvoice
      }
      onExport={(format) => toast.info(`${format.toUpperCase()} export coming soon`)}
    />
  );
}
