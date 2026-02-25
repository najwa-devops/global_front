"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DynamicInvoice } from "@/lib/types";
import { api } from "@/lib/api";
import { dynamicInvoiceDtoToLocal, toWorkflowStatus } from "@/lib/utils";
import {
  buildSupplierList,
  countPendingInvoices,
  DashboardFilters,
  filterDashboardInvoices,
} from "@/src/features/dashboard/model/dashboardModel";

const initialFilters: DashboardFilters = {
  search: "",
  supplier: "",
  status: "",
};

export function useDashboardViewModel() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const dtos = await api.getAllInvoices(undefined, undefined, 1000);
        const localInvoices = dtos.map(dynamicInvoiceDtoToLocal);
        localInvoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setInvoices(localInvoices);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const suppliers = useMemo(() => buildSupplierList(invoices), [invoices]);

  const pendingCount = useMemo(
    () => countPendingInvoices(invoices, (s) => toWorkflowStatus(s as any)),
    [invoices],
  );

  const visibleInvoices = useMemo(
    () => filterDashboardInvoices(invoices, filters, (s) => toWorkflowStatus(s as any)),
    [invoices, filters],
  );

  const openInvoiceOcr = (inv: DynamicInvoice) =>
    router.push(inv.dossierId ? `/achat/ocr/${inv.id}?dossierId=${inv.dossierId}` : `/achat/ocr/${inv.id}`);

  const handleProcessInline = async (invoice: DynamicInvoice) => {
    try {
      toast.loading("Traitement OCR en cours...", { id: `process-${invoice.id}` });
      await api.processInvoice(invoice.id);
      const dtos = await api.getAllInvoices(undefined, undefined, 1000);
      setInvoices(dtos.map(dynamicInvoiceDtoToLocal));
      toast.success("OCR termine", { id: `process-${invoice.id}` });
    } catch {
      toast.error("Erreur traitement", { id: `process-${invoice.id}` });
    }
  };

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteDynamicInvoice(invoiceId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      toast.success("Facture supprimee");
    } catch {
      toast.error("Erreur suppression");
    }
  };

  return {
    invoices,
    visibleInvoices,
    isLoading,
    filters,
    suppliers,
    pendingCount,
    setFilters,
    openInvoiceOcr,
    handleProcessInline,
    handleDeleteInvoice,
    goInvoices: () => router.push("/achat/invoices"),
  };
}
