"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { api } from "@/lib/api";
import { salesInvoiceDtoToLocal } from "@/lib/utils";
import { type LocalInvoice, type UserRole } from "@/lib/types";
import { AccountedInvoicesPage } from "@/components/accounted-invoices-page";

export default function Page() {
  const [invoices, setInvoices] = useState<LocalInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
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
      const dossierId = getCurrentDossierId();
      if (!dossierId) {
        toast.error("Dossier requis");
        router.push("/dossiers");
        return;
      }
      const dtos = await api.getSalesInvoicesByDossier(dossierId, "VALIDATED");
      const localInvoices = dtos.map(salesInvoiceDtoToLocal);
      setInvoices(localInvoices.filter((inv) => Boolean(inv.accounted || inv.accountedAt)));
    } catch (err) {
      toast.error("Erreur chargement factures comptabilisées");
    } finally {
      setIsLoading(false);
    }
  };

  const clients = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      const client =
        inv.fields.find((f) => f.key === "clientName")?.value ||
        inv.fields.find((f) => f.key === "supplier")?.value;
      if (client) set.add(String(client));
    });
    return Array.from(set);
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <AccountedInvoicesPage
      invoices={invoices}
      filters={{ search: "", supplier: "", status: "all", invoiceType: "" }}
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
      onExport={(format) => toast.info(`Export ${format.toUpperCase()} bientôt disponible`)}
      userRole={userRole || undefined}
    />
  );
}

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const id = Number(localStorage.getItem("currentDossierId"));
  return Number.isFinite(id) && id > 0 ? id : undefined;
}
