"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LocalBankStatement } from "@/lib/types";
import {
  fetchBankStatementById,
  validateBankStatement,
} from "@/src/features/bank/model/bank.service";

export function useBankOcrPageViewModel(statementId: number | null) {
  const router = useRouter();

  const [statement, setStatement] = useState<LocalBankStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!statementId) {
      setLoading(false);
      return;
    }

    const fetchStatement = async () => {
      setLoading(true);
      try {
        const data = await fetchBankStatementById(statementId);
        setStatement(data);
      } catch (error) {
        console.error("Error fetching bank statement:", error);
        toast.error("Impossible de charger le releve bancaire");
      } finally {
        setLoading(false);
      }
    };

    fetchStatement();
  }, [statementId]);

  const onBack = useMemo(() => () => router.back(), [router]);

  const onSave = async (updatedStatement: LocalBankStatement) => {
    try {
      await validateBankStatement(updatedStatement.id, updatedStatement.fields);
      router.push("/bank/list");
    } catch (error) {
      console.error("Error saving bank statement:", error);
      toast.error("Echec de validation du releve");
    }
  };

  const goToList = useMemo(() => () => router.push("/bank/list"), [router]);

  return {
    statement,
    loading,
    onBack,
    onSave,
    goToList,
  };
}
