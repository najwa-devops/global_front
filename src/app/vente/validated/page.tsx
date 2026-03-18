"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { salesInvoiceDtoToLocal } from "@/lib/utils";
import { type DynamicInvoice } from "@/lib/types";
import { ValidatedInvoicesPage } from "@/components/validated-invoices-page";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";

function VenteValidatedPageContent() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      const dtos = await api.getSalesInvoicesByDossier(dossierId, "VALIDATED");
      const localInvoices = dtos.map(salesInvoiceDtoToLocal);
      setInvoices(
        localInvoices.filter(
          (inv) =>
            String(inv.status || "").toUpperCase() === "VALIDATED" &&
            !inv.accounted &&
            !inv.accountedAt,
        ),
      );
    } catch (err) {
      console.error("Error loading validated sales invoices:", err);
      toast.error("Impossible de charger les factures vente validées.");
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

  const handleAccountInvoice = async (invoice: DynamicInvoice) => {
    try {
      const result = await api.accountSalesInvoice(invoice.id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
      toast.success(result?.status ? "Facture comptabilisée" : "Comptabilisation effectuée");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la comptabilisation");
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
      suppliers={clients}
      onView={(inv) =>
        router.push(
          inv.dossierId
            ? `/vente/ocr/${inv.id}?dossierId=${inv.dossierId}`
            : `/vente/ocr/${inv.id}`,
        )
      }
      onDelete={() => toast.info("Suppression non disponible pour les factures vente.")}
      onAccount={handleAccountInvoice}
      onExport={(format) =>
        toast.info(`Export ${format.toUpperCase()} bientôt disponible`)
      }
    />
  );
}

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const id = Number(localStorage.getItem("currentDossierId"));
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export default function Page() {
  return (
    <AuthGuard allowedRoles={["CLIENT"]}>
      <VenteValidatedPageContent />
    </AuthGuard>
  );
}
