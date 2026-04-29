"use client";

import { Loader2 } from "lucide-react";
import { OcrProcessingBankPage } from "@/src/features/bank/view/OcrProcessingBankPage";
import { useBankOcrPageViewModel } from "@/src/features/bank/viewmodel/useBankOcrPageViewModel";

interface BankOcrPageViewProps {
  statementId: number;
}

export default function BankOcrPageView({ statementId }: BankOcrPageViewProps) {
  const { statement, loading, onBack, onSave, goToList } =
    useBankOcrPageViewModel(statementId);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium">Releve bancaire non trouve</p>
        <button onClick={goToList} className="text-primary hover:underline">
          Retour a la liste
        </button>
      </div>
    );
  }

  return (
    <OcrProcessingBankPage
      statement={statement}
      file={null}
      onBack={onBack}
      onSave={onSave}
    />
  );
}
