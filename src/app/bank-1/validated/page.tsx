"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ValidatedBankStatementsPage } from "@/components/validated-bank-statements-page";
import { BankStatsCards } from "@/components/bank-stats-cards";
import { api } from "@/lib/api";
import { BankStatementStats, BankStatementV2 } from "@/lib/types";
import { toast } from "sonner";

export default function BankValidatedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BankStatementStats | null>(null);
  const [statements, setStatements] = useState<BankStatementV2[]>([]);

  const loadData = async () => {
    try {
      const [statementsData, statsData] = await Promise.all([
        api.getAllBankStatements({ limit: 1000 }),
        api.getBankStatementStats(),
      ]);
      const validated = (
        Array.isArray(statementsData) ? statementsData : []
      ).filter((s) => { const status = String(s.status || "").toUpperCase(); return ["VALIDATED", "VALIDE"].includes(status); });
      setStatements(validated);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading validated bank statements:", error);
      toast.error("Impossible de charger les relevés validés");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleView = (statement: BankStatementV2) => {
    router.push(`/bank/ocr/${statement.id}`);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce relevé ?")) return;
    try {
      await api.deleteBankStatement(id);
      setStatements((prev) => prev.filter((s) => s.id !== id));
      toast.success("Relevé supprimé");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleExport = (_format: "csv" | "excel" | "pdf") => {
    toast.info("Export disponible prochainement");
  };

  const handleMarkAsAccounted = async (statementId: number) => {
    try {
      await api.updateBankStatementStatus(statementId, "COMPTABILISE");
      setStatements((prev) =>
        prev.filter((statement) => statement.id !== statementId),
      );
      toast.success("Relevé marqué comme comptabilisé");
    } catch {
      toast.error("Erreur lors de la comptabilisation");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <BankStatsCards stats={stats} />
      <ValidatedBankStatementsPage
        statements={statements}
        onView={handleView}
        onDelete={handleDelete}
        onMarkAsAccounted={handleMarkAsAccounted}
        onExport={handleExport}
      />
    </div>
  );
}

