"use client";

import { useParams } from "next/navigation";
import { Clock } from "lucide-react";
import { OcrProcessingPage } from "@/src/features/ocr/view/OcrProcessingPage";
import { useOcrPageViewModel } from "@/src/features/ocr/viewmodel/useOcrPageViewModel";

export default function OcrPageView() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;

  const { invoice, templates, isLoading, onBack, onInvoiceSaved } =
    useOcrPageViewModel(id);

  if (isLoading || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Chargement de la facture...</p>
      </div>
    );
  }

  return (
    <OcrProcessingPage
      invoice={invoice}
      file={null}
      templates={templates}
      onBack={onBack}
      onSave={onInvoiceSaved}
      isDemoMode={false}
    />
  );
}
