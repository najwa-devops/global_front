"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { dynamicInvoiceDtoToLocal, toWorkflowStatus } from "@/lib/utils";
import { type DynamicInvoice } from "@/lib/types";
import { ValidatedInvoicesPage } from "@/components/validated-invoices-page";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { ApiError } from "@/src/api/api-client";

function ValidatedPageContent() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      const dtos = await api.getAllInvoices();
      const localInvoices = dtos.map(dynamicInvoiceDtoToLocal);
      setInvoices(
        localInvoices.filter(
          (inv) => toWorkflowStatus(inv.status) === "VALIDATED",
        ),
      );
    } catch (err) {
      console.error("Error loading validated invoices:", err);
      toast.error("Impossible de charger les factures validées.");
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

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteDynamicInvoice(invoiceId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      toast.success("Facture supprimée");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "BUSINESS_LOCKED") {
          toast.error(
            "Cette facture est verrouillée et ne peut pas être supprimée.",
          );
        } else {
          toast.error(err.message || "Erreur lors de la suppression");
        }
      } else {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const handleAccountInvoice = async (invoice: DynamicInvoice) => {
    try {
      const result = await api.accountInvoiceEntries(invoice.id);
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? {
                ...inv,
                accounted: true,
                accountedAt: new Date(),
              }
            : inv,
        ),
      );
      toast.success(result?.message || "Facture comptabilisée");
    } catch (err: any) {
      const message =
        err?.message === "missing_accounting_data"
          ? "Données comptables manquantes pour cette facture."
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
      invoices={invoices}
      filters={{ search: "", supplier: "", status: "VALIDATED" }}
      onFiltersChange={() => {}}
      suppliers={suppliers}
      onView={(inv) =>
        router.push(
          inv.dossierId
            ? `/ocr/${inv.id}?dossierId=${inv.dossierId}`
            : `/ocr/${inv.id}`,
        )
      }
      onDelete={handleDeleteInvoice}
      onAccount={handleAccountInvoice}
      onExport={(format) =>
        toast.info(`Export ${format.toUpperCase()} bientôt disponible`)
      }
    />
  );
}

export default function Page() {
  return (
    <AuthGuard allowedRoles={["COMPTABLE", "ADMIN", "CLIENT"]}>
      <ValidatedPageContent />
    </AuthGuard>
  );
}
