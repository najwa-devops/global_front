"use client";

import { useState, useEffect, use } from "react";
import { OcrProcessingBankPage } from "@/components/ocr-processing-bank-page";
import { api } from "@/lib/api";
import { LocalBankStatement } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BankOcrPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const [statement, setStatement] = useState<LocalBankStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        const data = await api.getBankStatementById(Number(id));
        setStatement(data);
      } catch (error) {
        console.error("Error fetching bank statement:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatement();
  }, [id]);

  const handleBack = () => {
    router.back();
  };

  const handleSave = async (updatedStatement: LocalBankStatement) => {
    try {
      await api.validateBankStatement(
        updatedStatement.id,
        updatedStatement.fields,
      );
      router.push("/bank/validated");
    } catch (error) {
      console.error("Error saving bank statement:", error);
    }
  };

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
        <p className="text-lg font-medium">Relevé bancaire non trouvé</p>
        <button
          onClick={() => router.push("/bank/list")}
          className="text-primary hover:underline"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <OcrProcessingBankPage
      statement={statement}
      file={null}
      onBack={handleBack}
      onSave={handleSave}
    />
  );
}
