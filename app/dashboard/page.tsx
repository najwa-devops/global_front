"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { dynamicInvoiceDtoToLocal, toWorkflowStatus } from "@/lib/utils";
import { type DynamicInvoice } from "@/lib/types";
import { StatsCards } from "@/components/stats-cards";
import {
  InvoiceFilters,
  type FilterValues,
} from "@/components/invoice-filters";
import { InvoiceTable } from "@/components/invoice-table";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    supplier: "",
    status: "",
  });
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const dtos = await api.getAllInvoices(undefined, undefined, 1000);
        const localInvoices = dtos.map(dynamicInvoiceDtoToLocal);
        localInvoices.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
        setInvoices(localInvoices);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const suppliers = useMemo(() => {
    const supplierSet = new Set<string>();
    invoices.forEach((inv) => {
      const supplier = inv.fields.find((f) => f.key === "supplier")?.value;
      if (supplier) supplierSet.add(String(supplier));
    });
    return Array.from(supplierSet);
  }, [invoices]);

  const pendingCount = useMemo(() => {
    return invoices.filter((inv) =>
      ["VERIFY", "READY_TO_TREAT", "READY_TO_VALIDATE", "REJECTED"].includes(
        toWorkflowStatus(inv.status),
      ),
    ).length;
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
      const dtos = await api.getAllInvoices(undefined, undefined, 1000);
      setInvoices(dtos.map(dynamicInvoiceDtoToLocal));
      toast.success(`✓ OCR terminé`, { id: `process-${invoice.id}` });
    } catch (err) {
      toast.error("Erreur traitement", { id: `process-${invoice.id}` });
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
      <StatsCards invoices={invoices} />

      {pendingCount > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  {pendingCount} facture{pendingCount > 1 ? "s" : ""} en attente
                </p>
                <Button
                  variant="link"
                  className="h-auto p-0 text-amber-700 dark:text-amber-300"
                  onClick={() => router.push("/invoices")}
                >
                  Voir les factures →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              ? `/ocr/${inv.id}?dossierId=${inv.dossierId}`
              : `/ocr/${inv.id}`,
          )
        }
        onProcessOcr={(inv) =>
          router.push(
            inv.dossierId
              ? `/ocr/${inv.id}?dossierId=${inv.dossierId}`
              : `/ocr/${inv.id}`,
          )
        }
        onProcessInline={handleProcessInline}
        onDelete={handleDeleteInvoice}
      />
    </div>
  );
}
