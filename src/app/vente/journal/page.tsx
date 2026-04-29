"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AccountingEntry, UserRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Loader2, RefreshCw, BookOpenCheck } from "lucide-react";
import { formatAmount, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function Page() {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const dossierId = getCurrentDossierId();
      if (!dossierId) {
        toast.error("Dossier requis");
        setEntries([]);
        return;
      }
      const data = await api.getSalesJournalEntries(dossierId);
      setEntries(data);
    } catch (err: any) {
      toast.error(err?.message || "Erreur chargement journal vente");
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    api
      .getCurrentUser()
      .then((u) => setUserRole(u.role))
      .catch(() => setUserRole(null));
  }, []);

  useEffect(() => {
    loadEntries();
  }, []);

  const totals = useMemo(() => {
    const debit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const credit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    return { debit, credit };
  }, [entries]);

  if (userRole === "CLIENT") {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Acces reserve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cette page est reservee aux roles comptable et administrateur.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Chargement du journal vente...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <BookOpenCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Journal Comptable Vente</CardTitle>
              <p className="text-sm text-muted-foreground">{entries.length} ecriture(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadEntries} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
            <div className="text-xs text-muted-foreground">Imprime le {formatDateTime(new Date())}</div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/50 bg-gradient-to-b from-background via-background to-muted/30">
        <CardHeader>
          <CardTitle className="text-base">
            Debit: {formatAmount(totals.debit)} | Credit: {formatAmount(totals.credit)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune ecriture comptable vente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Journal</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Piece</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={`${entry.invoiceId}-${entry.accountNumber}-${entry.label}-${entry.debit}-${entry.credit}`}>
                      <TableCell>{entry.journal || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.accountNumber}</TableCell>
                      <TableCell>{entry.entryDate ? formatDate(entry.entryDate) : "-"}</TableCell>
                      <TableCell>{entry.invoiceNumber || "-"}</TableCell>
                      <TableCell>{entry.supplier || "-"}</TableCell>
                      <TableCell className="text-right">{entry.debit && entry.debit > 0 ? formatAmount(entry.debit) : "-"}</TableCell>
                      <TableCell className="text-right">{entry.credit && entry.credit > 0 ? formatAmount(entry.credit) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                      Totaux
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.debit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.credit)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const id = Number(localStorage.getItem("currentDossierId"));
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

