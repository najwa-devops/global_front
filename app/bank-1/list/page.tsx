"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BankStatementTable } from "@/components/bank-statement-table";
import { BankStatsCards } from "@/components/bank-stats-cards";
import { api } from "@/lib/api";
import { BankStatementStats, BankStatementV2 } from "@/lib/types";
import { toast } from "sonner";
import { getConfiguredBankCodes } from "@/lib/accounting-config-banks";

export default function BankListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statements, setStatements] = useState<BankStatementV2[]>([]);
  const [stats, setStats] = useState<BankStatementStats | null>(null);

  const loadData = async () => {
    try {
      const [statementsData, statsData] = await Promise.all([
        api.getAllBankStatements({ limit: 1000 }),
        api.getBankStatementStats(),
      ]);
      setStatements(Array.isArray(statementsData) ? statementsData : []);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading bank statements:", error);
      toast.error("Impossible de charger les relevés bancaires");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const hasProcessing = statements.some((s) =>
      ["PENDING", "PROCESSING", "EN_ATTENTE", "EN_COURS"].includes(String(s.status || "").toUpperCase()),
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadData();
    }, 2000);
    return () => clearInterval(interval);
  }, [statements]);

  const pendingStatements = statements.filter(
    (s) =>
      !["VALIDATED", "VALIDE", "COMPTABILISE", "COMPTABILISÉ"].includes(
        String(s.status || "").toUpperCase(),
      ),
  );

  const handleView = (statement: BankStatementV2) => {
    router.push(`/bank/ocr/${statement.id}`);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteBankStatement(id);
      setStatements((prev) => prev.filter((s) => s.id !== id));
      toast.success("Relevé supprimé");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleValidate = async (id: number) => {
    try {
      await api.validateBankStatement(id);
      await loadData();
      toast.success("Relevé validé");
    } catch (error) {
      toast.error("Erreur lors de la validation");
    }
  };

  const handleReprocess = async (statement: BankStatementV2) => {
    try {
      // Reflect the action immediately in UI while backend starts processing.
      setStatements((prev) =>
        prev.map((s) =>
          s.id === statement.id
            ? { ...s, status: "PROCESSING", canReprocess: false }
            : s,
        ),
      );

      const allowedBanks = await getConfiguredBankCodes();

      const updatedStatement = await api.processBankStatement(
        statement.id,
        allowedBanks,
      );
      setStatements((prev) =>
        prev.map((s) =>
          s.id === statement.id ? { ...s, ...updatedStatement } : s,
        ),
      );
      toast.success("Reprocessage lancé");

      // Force short polling on the single statement to keep UI in sync immediately.
      const maxAttempts = 8;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const latest = await api.getBankStatementById(statement.id);
        setStatements((prev) =>
          prev.map((s) => (s.id === statement.id ? { ...s, ...latest } : s)),
        );
        const isStillProcessing = [
          "PENDING",
          "PROCESSING",
          "EN_ATTENTE",
          "EN_COURS",
        ].includes(latest.status);
        if (!isStillProcessing) {
          break;
        }
      }
      await loadData();
    } catch (error) {
      toast.error("Erreur lors du reprocessage");
      await loadData();
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Supprimer tous les relevés bancaires ?")) return;
    try {
      await api.deleteAllBankStatements();
      await loadData();
      toast.success("Tous les relevés ont été supprimés");
    } catch (error) {
      toast.error("Erreur lors de la suppression globale");
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
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                Liste des Relevés Bancaires
              </CardTitle>
              <CardDescription>
                {pendingStatements.length} relevé
                {pendingStatements.length > 1 ? "s" : ""} en cours de gestion
              </CardDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAll}
              disabled={statements.length === 0}
            >
              Tout supprimer
            </Button>
          </div>
        </CardHeader>
      </Card>

      <BankStatsCards stats={stats} />

      <BankStatementTable
        statements={pendingStatements}
        onView={handleView}
        onDelete={handleDelete}
        onValidate={handleValidate}
        onReprocess={handleReprocess}
      />
    </div>
  );
}

