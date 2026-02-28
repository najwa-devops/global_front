"use client";

import { useParams } from "next/navigation";
import { Clock } from "lucide-react";
import { OcrProcessingPage } from "@/src/features/ocr/view/OcrProcessingPage";
import { useSalesOcrPageViewModel } from "@/src/features/vente/viewmodel/useSalesOcrPageViewModel";
import { api } from "@/lib/api";

export default function SalesOcrPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;

  const { invoice, isLoading, onBack, onInvoiceSaved } =
    useSalesOcrPageViewModel(id);

  if (isLoading || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Chargement de la facture vente...</p>
      </div>
    );
  }

  const handleUpdateFields = async (invoiceId: number, fields: Record<string, any>) => {
    return api.updateSalesInvoiceFields(invoiceId, fields);
  };

  const handleValidate = async (invoiceId: number) => {
    return api.validateSalesInvoice(invoiceId);
  };

  return (
    <OcrProcessingPage
      invoice={invoice}
      file={null}
      templates={[]}
      onBack={onBack}
      onSave={onInvoiceSaved}
      isDemoMode={false}
      onUpdateFields={handleUpdateFields}
      onValidateInvoice={handleValidate}
      useDynamicFieldLayout={true}
    />
  );
}
