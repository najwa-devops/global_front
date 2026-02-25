"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  FileText,
  AlertCircle,
  ArrowLeft,
  AlertTriangle,
  Plus,
  Save,
  Eye,
  Link as LinkIcon,
  CheckCircle2,
} from "lucide-react";
import type { Account, BankStatementV2, BankTransactionV2 } from "@/lib/types";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BankStatementDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: BankStatementV2 | null;
  onUpdateTransaction?: (transaction: BankTransactionV2) => void;
}

type NewTransactionForm = {
  transactionIndex: number;
  dateOperation: string;
  dateValeur: string;
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
};

const EMPTY_NEW_TRANSACTION: NewTransactionForm = {
  transactionIndex: 1,
  dateOperation: "",
  dateValeur: "",
  compte: "",
  libelle: "",
  debit: 0,
  credit: 0,
};

const DEFAULT_COMPTE_CODE = "349700000";
function normalizeBankStatus(status?: string): string {
  return String(status || "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase()
    .trim();
}

function isValidatedStatus(status?: string): boolean {
  const normalized = normalizeBankStatus(status);
  return normalized === "VALIDATED" || normalized === "VALIDE";
}

function isAccountedStatus(status?: string): boolean {
  const normalized = normalizeBankStatus(status);
  return normalized.includes("COMPTABILIS");
}

function sortByIndex(items: BankTransactionV2[]): BankTransactionV2[] {
  return [...items].sort((a, b) => {
    const ia = a.transactionIndex ?? a.id;
    const ib = b.transactionIndex ?? b.id;
    return ia - ib;
  });
}

function normalizeLibelle(value?: string | null): string {
  return (value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSelectedCompte(value?: string | null): boolean {
  return resolveDisplayCompte(value) !== DEFAULT_COMPTE_CODE;
}

function isDefaultCompte(value?: string | null): boolean {
  return resolveDisplayCompte(value) === DEFAULT_COMPTE_CODE;
}

function resolveDisplayCompte(value?: string | null): string {
  const compte = (value || "").trim();
  return compte === "" ? DEFAULT_COMPTE_CODE : compte;
}

export function BankStatementDetailModal({
  open,
  onOpenChange,
  statement,
  onUpdateTransaction,
}: BankStatementDetailModalProps) {
  const [transactions, setTransactions] = useState<BankTransactionV2[]>([]);
  const [editableTransactions, setEditableTransactions] = useState<
    BankTransactionV2[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [localStatement, setLocalStatement] = useState<BankStatementV2 | null>(
    null,
  );
  const [newTransaction, setNewTransaction] = useState<NewTransactionForm>(
    EMPTY_NEW_TRANSACTION,
  );
  const [editingCell, setEditingCell] = useState<{
    id: number;
    field:
      | "transactionIndex"
      | "dateOperation"
      | "dateValeur"
      | "compte"
      | "libelle"
      | "debit"
      | "credit";
  } | null>(null);
  const [openComptePopoverTxId, setOpenComptePopoverTxId] = useState<
    number | null
  >(null);
  const lastLoadedId = useRef<number | null>(null);

  useEffect(() => {
    if (open && statement) {
      const isNewId = lastLoadedId.current !== statement.id;
      setLocalStatement(statement);
      if (isNewId) {
        lastLoadedId.current = statement.id;
        loadFullData(statement.id, false);
      } else {
        loadFullData(statement.id, true);
      }
    } else if (!open) {
      lastLoadedId.current = null;
      setOpenComptePopoverTxId(null);
    }
  }, [open, statement?.id, statement?.status, statement?.transactionCount]);

  useEffect(() => {
    if (!open || !localStatement) return;
    const isProcessing =
      localStatement.status === "PROCESSING" ||
      localStatement.status === "PENDING" ||
      localStatement.status === "EN_COURS" ||
      localStatement.status === "EN_ATTENTE";
    if (!isProcessing) return;
    const interval = setInterval(() => {
      loadFullData(localStatement.id, true);
    }, 1500);
    return () => clearInterval(interval);
  }, [open, localStatement?.status, localStatement?.id]);

  useEffect(() => {
    if (open && accounts.length === 0) {
      loadAccounts();
    }
  }, [open]);

  const loadFullData = async (id: number, silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.getBankStatementById(id);
      setLocalStatement(data);
      const txData =
        data.transactions && data.transactions.length > 0
          ? data.transactions
          : await api.getTransactionsByStatementId(id);
      const sorted = sortByIndex(txData);
      setTransactions(sorted);
      setEditableTransactions(sorted);
      setNewTransaction((prev) => ({
        ...prev,
        transactionIndex: Math.max(sorted.length + 1, 1),
      }));
    } catch (error) {
      console.error("Error loading full data:", error);
      if (!silent) toast.error("Erreur de chargement des données");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const data = await api.getAccounts(true);
      setAccounts(data);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
      case "EN_ATTENTE":
        return (
          <Badge className="bg-sky-400/10 text-sky-500 border-sky-400/30">
            En attente
          </Badge>
        );
      case "PROCESSING":
      case "EN_COURS":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-400/30 animate-pulse">
            En cours
          </Badge>
        );
      case "TREATED":
      case "TRAITE":
        return (
          <Badge className="bg-blue-700/10 text-blue-800 border-blue-700/30">
            Traité
          </Badge>
        );
      case "READY_TO_VALIDATE":
      case "PRET_A_VALIDER":
        return (
          <Badge className="bg-emerald-400/10 text-emerald-500 border-emerald-400/30">
            Prêt à valider
          </Badge>
        );
      case "VALIDATED":
      case "VALIDE":
        return (
          <Badge className="bg-emerald-600 text-white border-emerald-700">
            Validé
          </Badge>
        );
      case "COMPTABILISE":
      case "COMPTABILISÉ":
        return (
          <Badge className="bg-violet-600 text-white border-violet-700">
            Comptabilisé
          </Badge>
        );
      case "ERROR":
      case "ERREUR":
        return (
          <Badge className="bg-destructive text-white border-destructive">
            Erreur
          </Badge>
        );
      case "PARTIAL_SUCCESS":
        return (
          <Badge className="bg-orange-400/10 text-orange-600 border-orange-400/30">
            Succès Partiel
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted/10 text-muted-foreground border-muted/30">
            {status}
          </Badge>
        );
    }
  };

  const handleRetry = async () => {
    if (!localStatement) return;
    setLoading(true);
    try {
      await api.retryFailedBankStatementPages(localStatement.id);
      toast.success("Traitement relancé en arrière-plan");
    } catch (error) {
      console.error("Error retrying:", error);
      toast.error("Échec du lancement du traitement");
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (
    id: number,
    field: keyof Pick<
      BankTransactionV2,
      | "transactionIndex"
      | "dateOperation"
      | "dateValeur"
      | "compte"
      | "libelle"
      | "debit"
      | "credit"
    >,
    value: string,
  ) => {
    setEditableTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        if (
          field === "debit" ||
          field === "credit" ||
          field === "transactionIndex"
        ) {
          return { ...tx, [field]: Number(value || 0) };
        }
        return { ...tx, [field]: value };
      }),
    );
  };

  const isEditingCell = (
    id: number,
    field:
      | "transactionIndex"
      | "dateOperation"
      | "dateValeur"
      | "compte"
      | "libelle"
      | "debit"
      | "credit",
  ) => editingCell?.id === id && editingCell.field === field;

  const renderEditableCell = (
    tx: BankTransactionV2,
    field:
      | "transactionIndex"
      | "dateOperation"
      | "dateValeur"
      | "compte"
      | "libelle"
      | "debit"
      | "credit",
    options?: {
      type?: "text" | "number" | "date";
      step?: string;
      className?: string;
      emptyLabel?: string;
    },
  ) => {
    const readOnly =
      !!localStatement && isAccountedStatus(localStatement.status);
    const isEditing = isEditingCell(tx.id, field);
    const rawValue = (tx[field] ?? "") as string | number;
    const value =
      field === "compte" && typeof rawValue === "string"
        ? resolveDisplayCompte(rawValue)
        : rawValue;
    const displayValue =
      field === "compte"
        ? String(value)
        : value === "" || value === null
          ? options?.emptyLabel || "—"
          : String(value);

    if (readOnly) {
      return (
        <div className={cn("rounded px-2 py-1", options?.className)}>
          {displayValue}
        </div>
      );
    }

    if (isEditing) {
      return (
        <Input
          autoFocus
          type={options?.type || "text"}
          step={options?.step}
          min={options?.type === "number" ? 0 : undefined}
          value={value}
          onChange={(e) => handleCellChange(tx.id, field, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              setEditingCell(null);
            }
          }}
        />
      );
    }

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditingCell({ id: tx.id, field })}
        onKeyDown={(e) => {
          if (e.key === "Enter") setEditingCell({ id: tx.id, field });
        }}
        className={cn(
          "cursor-pointer rounded px-2 py-1 hover:bg-muted/50",
          options?.className,
        )}
        title="Cliquer pour modifier"
      >
        {displayValue}
      </div>
    );
  };

  const handleAddTransaction = () => {
    if (!localStatement) return;
    if (
      !newTransaction.dateOperation ||
      !newTransaction.dateValeur ||
      !newTransaction.libelle
    ) {
      toast.error("Date opération, date valeur et libellé sont obligatoires");
      return;
    }
    const targetIndex = Math.max(
      1,
      Math.floor(newTransaction.transactionIndex || 1),
    );
    const localTx: BankTransactionV2 = {
      id: -Date.now(),
      statementId: localStatement.id,
      dateOperation: newTransaction.dateOperation,
      dateValeur: newTransaction.dateValeur,
      libelle: newTransaction.libelle,
      rib: localStatement.rib || null,
      debit: Number(newTransaction.debit || 0),
      credit: Number(newTransaction.credit || 0),
      sens: Number(newTransaction.debit || 0) > 0 ? "DEBIT" : "CREDIT",
      compte: newTransaction.compte,
      isLinked: false,
      categorie: "MANUAL",
      role: "MANUAL",
      extractionConfidence: 1,
      isValid: true,
      needsReview: false,
      reviewNotes: null,
      extractionErrors: null,
      lineNumber: targetIndex,
      transactionIndex: targetIndex,
    };
    const merged = sortByIndex([...editableTransactions, localTx]);
    setEditableTransactions(merged);
    setNewTransaction((prev) => ({
      ...EMPTY_NEW_TRANSACTION,
      transactionIndex: Math.max(merged.length + 1, 1),
    }));
    toast.success("Transaction prête à être enregistrée");
  };

  const hasChanges = useMemo(() => {
    if (editableTransactions.length !== transactions.length) return true;
    const baseline = sortByIndex(transactions);
    const current = sortByIndex(editableTransactions);
    return current.some((tx, idx) => {
      const base = baseline[idx];
      if (!base) return true;
      return (
        tx.transactionIndex !== base.transactionIndex ||
        tx.dateOperation !== base.dateOperation ||
        tx.dateValeur !== base.dateValeur ||
        tx.compte !== base.compte ||
        tx.libelle !== base.libelle ||
        tx.debit !== base.debit ||
        tx.credit !== base.credit
      );
    });
  }, [editableTransactions, transactions]);

  const handleSaveAll = async () => {
    const toPersist = sortByIndex(editableTransactions);

    // Propagation locale avant sauvegarde: même libellé -> même code choisi.
    const learnedByLibelle = new Map<string, string>();
    for (const tx of toPersist) {
      const normalized = normalizeLibelle(tx.libelle);
      if (!normalized) continue;
      if (isSelectedCompte(tx.compte)) {
        learnedByLibelle.set(normalized, tx.compte.trim());
      }
    }

    const effectiveRows = toPersist.map((tx) => {
      if (isSelectedCompte(tx.compte)) return tx;
      const learned = learnedByLibelle.get(normalizeLibelle(tx.libelle));
      if (!learned) return tx;
      return { ...tx, compte: learned, isLinked: true };
    });

    const existingRows = effectiveRows.filter((tx) => tx.id > 0);
    const localRows = effectiveRows.filter((tx) => tx.id <= 0);

    setSaving(true);
    try {
      const existingPromises = existingRows.map((tx) => {
        const payload: Partial<BankTransactionV2> = {
          transactionIndex: tx.transactionIndex,
          dateOperation: tx.dateOperation,
          dateValeur: tx.dateValeur,
          compte: isSelectedCompte(tx.compte) ? tx.compte : "",
          libelle: tx.libelle,
          debit: Number(tx.debit || 0),
          credit: Number(tx.credit || 0),
          sens: Number(tx.debit || 0) > 0 ? "DEBIT" : "CREDIT",
          isLinked: isSelectedCompte(tx.compte),
        };
        return api.updateBankTransaction(tx.id, payload);
      });

      const localPromises = localRows.map((tx) => {
        return api.createBankTransaction({
          statementId: tx.statementId,
          transactionIndex: tx.transactionIndex,
          dateOperation: tx.dateOperation,
          dateValeur: tx.dateValeur,
          libelle: tx.libelle,
          compte: isSelectedCompte(tx.compte) ? tx.compte : "",
          categorie: tx.categorie,
          sens: tx.sens,
          debit: Number(tx.debit || 0),
          credit: Number(tx.credit || 0),
          isLinked: isSelectedCompte(tx.compte),
        });
      });

      const [updatedRows, createdRows] = await Promise.all([
        Promise.all(existingPromises),
        Promise.all(localPromises),
      ]);

      if (onUpdateTransaction) {
        updatedRows.forEach(onUpdateTransaction);
        createdRows.forEach(onUpdateTransaction);
      }

      await loadFullData(localStatement.id, true);
      toast.success("Modifications enregistrées");
    } catch (error) {
      console.error("Error saving transactions:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (!localStatement) return null;
  const isAccounted = isAccountedStatus(localStatement.statusCode || localStatement.status) || Boolean(localStatement.accountedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-full h-[90vh] min-h-0 flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b bg-card z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  Détail du Relevé Bancaire
                </DialogTitle>
                <DialogDescription>
                  {localStatement.originalName} • {localStatement.bankName}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-6 pr-8">
              <div className="text-right">
                <span className="text-xs text-muted-foreground uppercase font-semibold block">
                  Statut
                </span>
                {getStatusBadge(localStatement.status)}
                {isAccounted && localStatement.accountedAt && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(localStatement.accountedAt).toLocaleString()}{" "}
                      {localStatement.accountedBy
                        ? `• ${localStatement.accountedBy}`
                        : ""}
                    </p>
                  )}
              </div>
              <div className="text-right border-l pl-6">
                <span className="text-xs text-muted-foreground uppercase font-semibold block">
                  Compte
                </span>
                <Badge
                  variant={localStatement.isLinked ? "default" : "outline"}
                  className={cn(
                    localStatement.isLinked
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "text-orange-600 bg-orange-500/10 border-orange-500/60",
                  )}
                >
                  {localStatement.isLinked ? "LIÉ" : "NON LIÉ"}
                </Badge>
                {localStatement.status === "ERROR" ||
                localStatement.status === "PARTIAL_SUCCESS" ? (
                  <div className="flex flex-col gap-1 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={loading}
                      className="h-7 text-[10px] gap-1 px-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      <Loader2
                        className={cn("h-3 w-3", loading && "animate-spin")}
                      />
                      Relancer
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="text-right border-l pl-6 space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-semibold block">
                  Outils
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 px-2 border-primary/20 hover:bg-primary/5"
                    >
                      <Eye className="h-3 w-3" />
                      Inspecter OCR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[50vw] sm:max-w-[50vw] w-full max-h-[85vh] flex flex-col p-6">
                    <DialogHeader>
                      <DialogTitle>
                        Inspection du Texte Extrait (OCR)
                      </DialogTitle>
                      <DialogDescription>
                        Visualisez le texte brut et nettoyé pour diagnostiquer
                        les erreurs d'extraction.
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs
                      defaultValue="cleaned"
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      <TabsList className="mb-4">
                        <TabsTrigger value="cleaned">Texte Nettoyé</TabsTrigger>
                        <TabsTrigger value="raw">Texte Brut</TabsTrigger>
                      </TabsList>
                      <TabsContent
                        value="cleaned"
                        className="flex-1 overflow-hidden"
                      >
                        <ScrollArea className="h-[50vh] w-full rounded-md border p-4 bg-muted/20">
                          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                            {localStatement.cleanedOcrText ||
                              "Aucun texte nettoyé disponible."}
                          </pre>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent
                        value="raw"
                        className="flex-1 overflow-hidden"
                      >
                        <ScrollArea className="h-[50vh] w-full rounded-md border p-4 bg-muted/20">
                          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                            {localStatement.rawOcrText ||
                              "Aucun texte brut disponible."}
                          </pre>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="text-right border-l pl-6">
                <span className="text-xs text-muted-foreground uppercase font-semibold block">
                  Transactions
                </span>
                <span className="font-bold text-lg">
                  {editableTransactions.length || 0}
                </span>
              </div>
              <div className="text-right border-l pl-6">
                <span className="text-xs text-muted-foreground uppercase font-semibold block text-red-500">
                  Débit Total
                </span>
                <span className="font-bold text-lg text-red-500">
                  {localStatement.totalDebit
                    ? `${localStatement.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} DH`
                    : "0.00 DH"}
                </span>
              </div>
              <div className="text-right border-l pl-6">
                <span className="text-xs text-muted-foreground uppercase font-semibold block text-emerald-500">
                  Crédit Total
                </span>
                <span className="font-bold text-lg text-emerald-500">
                  {localStatement.totalCredit
                    ? `${localStatement.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} DH`
                    : "0.00 DH"}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto bg-muted/10 p-6 flex flex-col gap-6">
          {localStatement.validationErrors && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-500 shrink-0">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  Erreur de Traitement
                </p>
                <p className="text-sm">
                  {Array.isArray(localStatement.validationErrors)
                    ? localStatement.validationErrors.join("; ")
                    : localStatement.validationErrors}
                </p>
              </div>
            </div>
          )}

          {!isAccounted && (
            <div className="rounded-md border bg-card shadow-sm p-4">
              <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
                <div className="space-y-1">
                  <Label>N° Transaction</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newTransaction.transactionIndex}
                    onChange={(e) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        transactionIndex: Number(e.target.value || 1),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Date Opération</Label>
                  <Input
                    type="date"
                    value={newTransaction.dateOperation}
                    onChange={(e) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        dateOperation: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Date Valeur</Label>
                  <Input
                    type="date"
                    value={newTransaction.dateValeur}
                    onChange={(e) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        dateValeur: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Compte</Label>
                  <Input
                    list="bank-account-codes"
                    value={newTransaction.compte}
                    onChange={(e) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        compte: e.target.value,
                      }))
                    }
                  />
                  <datalist id="bank-account-codes">
                    {accounts.map((account) => (
                      <option key={account.id} value={account.code}>
                        {account.libelle}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Libellé</Label>
                  <Input
                    value={newTransaction.libelle}
                    onChange={(e) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        libelle: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Débit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newTransaction.debit}
                    onChange={(e) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        debit: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Crédit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newTransaction.credit}
                    onChange={(e) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        credit: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button className="gap-2" onClick={handleAddTransaction}>
                  <Plus className="h-4 w-4" />
                  Ajouter transaction
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="relative rounded-md border bg-card shadow-sm overflow-hidden">
              {(isValidatedStatus(localStatement.statusCode || localStatement.status) || isAccounted) && (
                <div className="pointer-events-none absolute inset-x-0 top-14 bottom-0 z-20 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-8">
                    {isValidatedStatus(localStatement.statusCode || localStatement.status) && (
                      <div
                        className="select-none border-[6px] border-emerald-600 text-emerald-600 rounded-xl px-12 py-3 text-6xl font-extrabold tracking-wider uppercase rotate-[-8deg] opacity-90 bg-white/10"
                        style={{
                          textShadow: "0 0 1px rgba(5,150,105,0.45)",
                          boxShadow: "inset 0 0 0 2px rgba(5,150,105,0.45)",
                        }}
                      >
                        Validé
                      </div>
                    )}
                    {isAccounted && (
                      <div
                        className="select-none border-[6px] border-violet-600 text-violet-600 rounded-xl px-12 py-3 text-6xl font-extrabold tracking-wider uppercase rotate-[-8deg] opacity-90 bg-white/10"
                        style={{
                          textShadow: "0 0 1px rgba(124,58,237,0.45)",
                          boxShadow: "inset 0 0 0 2px rgba(124,58,237,0.45)",
                        }}
                      >
                        COMPTABILISÉ
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="max-h-[52vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[100px] text-center">
                        Transaction
                      </TableHead>
                      <TableHead className="w-[150px]">
                        Date Opération
                      </TableHead>
                      <TableHead className="w-[150px]">Date Valeur</TableHead>
                      <TableHead className="w-[160px]">Compte</TableHead>
                      <TableHead className="min-w-[280px]">Libellé</TableHead>
                      <TableHead className="text-right w-[130px]">
                        Débit
                      </TableHead>
                      <TableHead className="text-right w-[130px]">
                        Crédit
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortByIndex(editableTransactions).map((tx) => {
                      const displayCompte = resolveDisplayCompte(tx.compte);
                      const hasCompteLibelle =
                        (tx.compteLibelle || "").trim() !== "";
                      const compteIsDefault = isDefaultCompte(displayCompte);
                      return (
                        <TableRow key={tx.id} className="hover:bg-muted/20">
                          <TableCell className="text-center">
                            {isEditingCell(tx.id, "transactionIndex") ? (
                              renderEditableCell(tx, "transactionIndex", {
                                type: "number",
                              })
                            ) : (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "font-normal text-xs bg-muted text-muted-foreground",
                                  !isAccounted && "cursor-pointer",
                                )}
                                onClick={() => {
                                  if (!isAccounted)
                                    setEditingCell({
                                      id: tx.id,
                                      field: "transactionIndex",
                                    });
                                }}
                              >
                                {tx.transactionIndex || tx.id}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(tx, "dateOperation", {
                              type: "date",
                              emptyLabel: "Cliquer pour date",
                            })}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(tx, "dateValeur", {
                              type: "date",
                              emptyLabel: "Cliquer pour date",
                            })}
                          </TableCell>
                          <TableCell>
                            {isEditingCell(tx.id, "compte") ? (
                              renderEditableCell(tx, "compte", {
                                className: "font-mono",
                                emptyLabel: DEFAULT_COMPTE_CODE,
                              })
                            ) : (
                              <Popover
                                open={
                                  !isAccounted &&
                                  openComptePopoverTxId === tx.id
                                }
                                onOpenChange={(nextOpen) => {
                                  if (isAccounted) return;
                                  setOpenComptePopoverTxId(
                                    nextOpen ? tx.id : null,
                                  );
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <div
                                    className={cn(
                                      "group inline-flex min-w-[145px] max-w-[250px] flex-col rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                                      !isAccounted && "cursor-pointer",
                                      compteIsDefault
                                        ? "border-orange-500 bg-orange-100 text-orange-900 hover:bg-orange-200"
                                        : tx.isLinked
                                          ? "border-orange-500 bg-transparent text-foreground hover:bg-orange-50/50"
                                          : isSelectedCompte(tx.compte)
                                            ? "border-orange-500 bg-orange-100 text-orange-900 hover:bg-orange-200"
                                            : "border-transparent hover:bg-muted text-muted-foreground",
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={cn(
                                          "h-6 w-6 rounded flex items-center justify-center transition-colors",
                                          compteIsDefault
                                            ? "bg-white text-orange-700"
                                            : tx.isLinked
                                              ? "bg-orange-100 text-orange-700"
                                              : isSelectedCompte(tx.compte)
                                                ? "bg-white text-orange-700"
                                                : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20",
                                        )}
                                      >
                                        <LinkIcon className="h-3.5 w-3.5" />
                                      </div>
                                      <span
                                        className={cn(
                                          "font-mono",
                                          compteIsDefault
                                            ? "font-semibold text-[13px]"
                                            : "text-[13px]",
                                        )}
                                      >
                                        {displayCompte}
                                      </span>
                                    </div>
                                    {hasCompteLibelle ? (
                                      <span
                                        className={cn(
                                          "mt-0.5 text-[10px] leading-tight",
                                          compteIsDefault
                                            ? "text-orange-900/90"
                                            : "text-muted-foreground",
                                        )}
                                      >
                                        {tx.compteLibelle}
                                      </span>
                                    ) : null}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-[300px] p-0"
                                  align="start"
                                >
                                  <Command>
                                    <CommandInput placeholder="Chercher un compte..." />
                                    <CommandList className="max-h-[260px] overflow-y-auto overscroll-contain touch-pan-y">
                                      <CommandEmpty>
                                        Aucun compte trouvé.
                                      </CommandEmpty>
                                      <CommandGroup className="pr-1">
                                        {loadingAccounts ? (
                                          <div className="flex items-center justify-center p-4">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Chargement...
                                          </div>
                                        ) : (
                                          accounts.map((account) => {
                                            return (
                                              <CommandItem
                                                key={account.id}
                                                value={`${account.code} ${account.libelle}`}
                                                onSelect={() => {
                                                  const targetLibelle =
                                                    normalizeLibelle(
                                                      tx.libelle,
                                                    );
                                                  setEditableTransactions(
                                                    (prev) =>
                                                      prev.map((row) =>
                                                        row.id === tx.id ||
                                                        (targetLibelle !== "" &&
                                                          normalizeLibelle(
                                                            row.libelle,
                                                          ) === targetLibelle &&
                                                          !isSelectedCompte(
                                                            row.compte,
                                                          ))
                                                          ? {
                                                              ...row,
                                                              compte:
                                                                account.code,
                                                              compteLibelle:
                                                                account.libelle,
                                                              isLinked: true,
                                                            }
                                                          : row,
                                                      ),
                                                  );
                                                  setOpenComptePopoverTxId(
                                                    null,
                                                  );
                                                }}
                                                className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                              >
                                                <div className="flex items-center w-full justify-between">
                                                  <span className="font-medium text-sm">
                                                    {account.libelle}
                                                  </span>
                                                  {tx.compte ===
                                                    account.code && (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                  )}
                                                </div>
                                                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                                  {account.code}
                                                </span>
                                              </CommandItem>
                                            );
                                          })
                                        )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            )}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(tx, "libelle", {
                              className: "max-w-[400px] truncate",
                              emptyLabel: "Cliquer pour libellé",
                            })}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600 bg-red-50/30">
                            {renderEditableCell(tx, "debit", {
                              type: "number",
                              step: "0.01",
                              className: "text-right",
                              emptyLabel: "0",
                            })}
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600 bg-emerald-50/30">
                            {renderEditableCell(tx, "credit", {
                              type: "number",
                              step: "0.01",
                              className: "text-right",
                              emptyLabel: "0",
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {editableTransactions.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-muted-foreground"
                        >
                          Aucune transaction trouvée pour ce relevé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <p className="text-sm text-muted-foreground">
              Les comptes marqués en{" "}
              <span className="font-medium text-orange-600">orange</span> sont
              liés au plan comptable. Cliquez sur l'icône pour modifier
              l'imputation.
            </p>
          </div>
          {!isAccounted && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-2"
                onClick={handleSaveAll}
                disabled={!hasChanges || saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
