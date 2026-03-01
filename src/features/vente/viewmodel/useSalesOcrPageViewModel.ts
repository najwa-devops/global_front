"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { toWorkflowStatus } from "@/lib/utils";
import type { DynamicInvoice } from "@/lib/types";
import { fetchSalesInvoiceById } from "@/src/features/vente/model/sales-invoice.model";

function isValidDossierId(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function useSalesOcrPageViewModel(invoiceId: number | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [invoice, setInvoice] = useState<DynamicInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;

    const queryDossierId = Number(searchParams.get("dossierId"));
    const hasQueryDossierId = isValidDossierId(queryDossierId);

    if (typeof window !== "undefined") {
      if (hasQueryDossierId) {
        localStorage.setItem("currentDossierId", String(queryDossierId));
      } else {
        const storedDossierId = Number(localStorage.getItem("currentDossierId"));
        if (!isValidDossierId(storedDossierId)) {
          toast.error("Dossier requis: ouvrez un dossier avant d'accéder à la facture.");
          router.push("/dossiers");
          return;
        }
      }
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const loadedInvoice = await fetchSalesInvoiceById(invoiceId);
        setInvoice(loadedInvoice);
      } catch (error) {
        console.error("Error loading sales OCR data:", error);
        toast.error("Impossible de charger la facture vente");
        router.push("/vente/invoices");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [invoiceId, router, searchParams]);

  const onInvoiceSaved = (updatedInvoice: DynamicInvoice) => {
    setInvoice(updatedInvoice);

    if (toWorkflowStatus(updatedInvoice.status) === "VALIDATED") {
      toast.success("Facture vente validée");
      router.push("/vente/validated");
      return;
    }

    toast.success("Modifications enregistrées");
  };

  const onBack = useMemo(() => () => router.back(), [router]);

  return {
    invoice,
    isLoading,
    onBack,
    onInvoiceSaved,
  };
}
