"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BankStatsCards } from "@/components/bank-stats-cards";
import { ValidatedBankStatementsPage } from "@/components/validated-bank-statements-page";
import { api } from "@/lib/api";
import { BankStatementStats, BankStatementV2 } from "@/lib/types";
import { toast } from "sonner";

export default function BankAccountedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BankStatementStats | null>(null);
  const [statements, setStatements] = useState<BankStatementV2[]>([]);

  const isAccountedStatement = (statement: BankStatementV2): boolean => {
    const rawStatus = String(
      statement.statusCode || statement.status || "",
    ).toUpperCase();
    const normalized = rawStatus
      .normalize("NFD")
      .replace(/\p{M}+/gu, "");
    return normalized.includes("COMPTABILIS") || Boolean(statement.accountedAt);
  };

  const loadData = async () => {
    try {
      const [statementsData, statsData] = await Promise.all([
        api.getAllBankStatements({ limit: 1000 }),
        api.getBankStatementStats(),
      ]);
      const accounted = (
        Array.isArray(statementsData) ? statementsData : []
      ).filter(isAccountedStatement);
      setStatements(accounted);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading accounted bank statements:", error);
      toast.error("Impossible de charger les releves comptabilises");
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
    if (!confirm("Etes-vous sur de vouloir supprimer ce releve ?")) return;
    try {
      await api.deleteBankStatement(id);
      setStatements((prev) => prev.filter((s) => s.id !== id));
      toast.success("Releve supprime");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleExport = (_format: "csv" | "excel" | "pdf") => {
    toast.info("Export disponible prochainement");
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
        onExport={handleExport}
        title="Releves Bancaires Comptabilises"
        emptyTitle="Aucun releve bancaire comptabilise"
        emptyDescription="Les releves bancaires comptabilises apparaitront ici"
        statusWord="comptabilise"
      />
    </div>
  );
}
