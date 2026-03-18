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
import { getDynamicInvoicesForNavigation, getDossiers } from "@/src/core/lib/api";

function isValidDossierId(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function useOcrPageViewModel(invoiceId: number | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [invoice, setInvoice] = useState<DynamicInvoice | null>(null);
  const [templates, setTemplates] = useState<LocalTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exerciseStartDate, setExerciseStartDate] = useState<string | null>(null);
  const [exerciseEndDate, setExerciseEndDate] = useState<string | null>(null);

  // Navigation entre factures
  const [invoiceList, setInvoiceList] = useState<{ id: number; invoiceNumber?: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isNavigating, setIsNavigating] = useState(false);

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

        // Charger les dates d'exercice du dossier courant
        const currentDossierId = Number(
          searchParams.get("dossierId") || localStorage.getItem("currentDossierId")
        );
        if (currentDossierId) {
          try {
            const dossiers = await getDossiers();
            const currentDossier = dossiers.find(d => d.id === currentDossierId);
            if (currentDossier) {
              setExerciseStartDate(currentDossier.exerciseStartDate || null);
              setExerciseEndDate(currentDossier.exerciseEndDate || null);
            }
          } catch (e) {
            console.error("Failed to load dossier exercise dates:", e);
          }
        }

        // Charger la liste des factures pour navigation
        await loadInvoiceList(invoiceId, searchParams);
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

  // Charger la liste des factures pour la navigation
  const loadInvoiceList = async (currentId: number, params: URLSearchParams) => {
    try {
      const dossierId = params.get("dossierId");
      const isSalesFlow = typeof window !== "undefined" && window.location.pathname.includes("/vente/");
      
      const invoices = await getDynamicInvoicesForNavigation({
        dossierId: dossierId ? Number(dossierId) : undefined,
      });
      
      setInvoiceList(invoices);
      setCurrentIndex(invoices.findIndex(inv => inv.id === currentId));
    } catch (error) {
      console.error("Error loading invoice list for navigation:", error);
    }
  };

  // Navigation vers facture précédente
  const goToPrevious = () => {
    if (currentIndex > 0) {
      setIsNavigating(true);
      const prevId = invoiceList[currentIndex - 1].id;
      navigateToInvoice(prevId);
    }
  };

  // Navigation vers facture suivante
  const goToNext = () => {
    if (currentIndex < invoiceList.length - 1) {
      setIsNavigating(true);
      const nextId = invoiceList[currentIndex + 1].id;
      navigateToInvoice(nextId);
    }
  };

  // Navigation vers une facture spécifique
  const navigateToInvoice = (id: number) => {
    const dossierId = searchParams.get("dossierId");
    const isSalesFlow = typeof window !== "undefined" && window.location.pathname.includes("/vente/");
    
    const url = dossierId 
      ? `/${isSalesFlow ? "vente" : "achat"}/ocr/${id}?dossierId=${dossierId}`
      : `/${isSalesFlow ? "vente" : "achat"}/ocr/${id}`;
    
    router.push(url);
  };

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
    exerciseStartDate,
    exerciseEndDate,
    // Navigation
    canGoPrevious: currentIndex > 0,
    canGoNext: currentIndex < invoiceList.length - 1,
    currentIndex,
    totalInvoices: invoiceList.length,
    goToPrevious,
    goToNext,
    isNavigating,
    currentInvoiceNumber: currentIndex >= 0 ? invoiceList[currentIndex]?.invoiceNumber : undefined,
  };
}
