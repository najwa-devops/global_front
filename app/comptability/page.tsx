"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AccountingEntry, UserRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Loader2, RefreshCw, BookOpenCheck } from "lucide-react";
import { formatAmount, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const getEntryYear = (entry: AccountingEntry): number | null => {
  const rawDate = entry.entryDate || entry.createdAt;
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
};

export default function Page() {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAccountingEntries();
      setEntries(data);
    } catch (err: any) {
      toast.error(err?.message || "Erreur chargement journal");
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

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const entry of entries) {
      const year = getEntryYear(entry);
      if (year !== null) years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [entries]);

  useEffect(() => {
    if (availableYears.length === 0) {
      setSelectedYear("");
      return;
    }

    const hasSelectedYear = selectedYear
      ? availableYears.includes(Number(selectedYear))
      : false;

    if (!hasSelectedYear) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [availableYears, selectedYear]);

  const filteredEntries = useMemo(() => {
    if (!selectedYear) return entries;
    return entries.filter(
      (entry) => String(getEntryYear(entry) ?? "") === selectedYear
    );
  }, [entries, selectedYear]);

  const totals = useMemo(() => {
    const debit = filteredEntries.reduce(
      (sum, entry) => sum + (entry.debit || 0),
      0
    );
    const credit = filteredEntries.reduce(
      (sum, entry) => sum + (entry.credit || 0),
      0
    );
    return { debit, credit };
  }, [filteredEntries]);

  const balance = totals.debit - totals.credit;
  const isBalanced = Math.abs(balance) < 0.01;

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
        <p className="mt-4 text-muted-foreground">Chargement du journal...</p>
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
              <CardTitle className="text-2xl">Journal Comptable</CardTitle>
              <p className="text-sm text-muted-foreground">
                {filteredEntries.length} ecriture
                {filteredEntries.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-700">
              Exercice {selectedYear || "N/A"}
            </div>
            <div>Imprime le {formatDateTime(new Date())}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadEntries} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/50 bg-gradient-to-b from-background via-background to-muted/30">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Résumé du journal</CardTitle>
            <Select
              value={selectedYear}
              onValueChange={setSelectedYear}
              disabled={availableYears.length === 0}
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div>
              Debit:{" "}
              <span className="font-semibold text-foreground">
                {formatAmount(totals.debit)}
              </span>
            </div>
            <div>
              Credit:{" "}
              <span className="font-semibold text-foreground">
                {formatAmount(totals.credit)}
              </span>
            </div>
            <div className={isBalanced ? "text-emerald-600" : "text-amber-600"}>
              Solde:{" "}
              <span className="font-semibold">{formatAmount(balance)}</span>{" "}
              <span className="text-xs">
                {isBalanced ? "(Equilibre)" : "(A verifier)"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEntries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune ecriture comptable pour {selectedYear || "cet exercice"}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      N°
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Journal
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Compte
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Piece
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Désignation
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                      Debit
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                      Credit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry, index) => (
                    <TableRow
                      key={entry.id}
                      className={
                        index % 2 === 0 ? "bg-background" : "bg-muted/30"
                      }
                    >
                      <TableCell className="text-xs font-semibold text-muted-foreground">
                        {entry.AC ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">
                        {entry.journal || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.accountNumber}
                      </TableCell>
                      <TableCell>
                        {entry.entryDate ? formatDate(entry.entryDate) : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.invoiceNumber || "-"}
                      </TableCell>
                      <TableCell className="max-w-[340px] truncate">
                        {entry.supplier || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-700">
                        {entry.debit && entry.debit > 0
                          ? formatAmount(entry.debit)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-700">
                        {entry.credit && entry.credit > 0
                          ? formatAmount(entry.credit)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-right text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Totaux
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(totals.debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(totals.credit)}
                    </TableCell>
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
