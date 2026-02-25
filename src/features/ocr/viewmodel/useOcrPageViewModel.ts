"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { toWorkflowStatus } from "@/lib/utils";
import type { DynamicInvoice, LocalTemplate } from "@/lib/types";
import {
  fetchInvoiceById,
  fetchInvoiceTemplates,
} from "@/src/features/ocr/model/invoice.model";

function isValidDossierId(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function useOcrPageViewModel(invoiceId: number | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [invoice, setInvoice] = useState<DynamicInvoice | null>(null);
  const [templates, setTemplates] = useState<LocalTemplate[]>([]);
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
          toast.error("Dossier requis: ouvrez un dossier avant d'acceder a la facture.");
          router.push("/dossiers");
          return;
        }
      }
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [loadedInvoice, loadedTemplates] = await Promise.all([
          fetchInvoiceById(invoiceId),
          fetchInvoiceTemplates(),
        ]);

        setInvoice(loadedInvoice);
        setTemplates(loadedTemplates);
      } catch (error) {
        console.error("Error loading OCR data:", error);
        toast.error("Impossible de charger la facture");
        router.push("/achat/invoices");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [invoiceId, router, searchParams]);

  const onInvoiceSaved = (updatedInvoice: DynamicInvoice) => {
    setInvoice(updatedInvoice);

    if (toWorkflowStatus(updatedInvoice.status) === "VALIDATED") {
      toast.success("Facture validee");
      router.push("/achat/validated");
      return;
    }

    toast.success("Modifications enregistrees");
  };

  const onBack = useMemo(() => () => router.back(), [router]);

  return {
    invoice,
    templates,
    isLoading,
    onBack,
    onInvoiceSaved,
  };
}
