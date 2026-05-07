"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Account, BankStatementV2, BankTransactionV2 } from "@/lib/types";
import type { CmExpansion } from "@/lib/centre-monetique/types";
import {
  applyAutoComptePropagation,
  buildLocalTransaction,
  EMPTY_NEW_TRANSACTION,
  isProcessingStatus,
  mapTransactionCreatePayload,
  mapTransactionUpdatePayload,
  NewTransactionForm,
  sortByIndex,
  TransactionEditableField,
} from "@/src/features/bank/model/bank.model";
import {
  createBankTransaction,
  fetchAccounts,
  fetchBankStatementById,
  fetchBankTransactionsByStatementId,
  fetchCmExpansionsByStatementId,
  retryBankStatementPages,
  updateBankTransaction,
} from "@/src/features/bank/model/bank.service";

interface UseBankStatementDetailViewModelParams {
  open: boolean;
  statement: BankStatementV2 | null;
  onUpdateTransaction?: (transaction: BankTransactionV2) => void;
}

export function useBankStatementDetailViewModel({
  open,
  statement,
  onUpdateTransaction,
}: UseBankStatementDetailViewModelParams) {
  const [transactions, setTransactions] = useState<BankTransactionV2[]>([]);
  const [editableTransactions, setEditableTransactions] = useState<BankTransactionV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [localStatement, setLocalStatement] = useState<BankStatementV2 | null>(null);
  const [cmExpansions, setCmExpansions] = useState<CmExpansion[]>([]);
  const [loadingCmExpansions, setLoadingCmExpansions] = useState(false);
  const [newTransaction, setNewTransaction] = useState<NewTransactionForm>(
    EMPTY_NEW_TRANSACTION,
  );
  const [editingCell, setEditingCell] = useState<{
    id: number;
    field: TransactionEditableField;
  } | null>(null);
  const [openComptePopoverTxId, setOpenComptePopoverTxId] = useState<number | null>(
    null,
  );

  const lastLoadedId = useRef<number | null>(null);

  const loadFullData = async (id: number, silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);

    try {
      const data = await fetchBankStatementById(id);
      setLocalStatement(data);

      const txData =
        data.transactions && data.transactions.length > 0
          ? data.transactions
          : await fetchBankTransactionsByStatementId(id);

      const sorted = sortByIndex(txData);
      setTransactions(sorted);
      setEditableTransactions(sorted);
      setNewTransaction((prev) => ({
        ...prev,
        transactionIndex: Math.max(sorted.length + 1, 1),
      }));

      setLoadingCmExpansions(true);
      try {
        const expansions = await fetchCmExpansionsByStatementId(id);
        setCmExpansions(Array.isArray(expansions) ? expansions : []);
      } catch {
        setCmExpansions([]);
      } finally {
        setLoadingCmExpansions(false);
      }
    } catch (error) {
      console.error("Error loading full data:", error);
      if (!silent) toast.error("Erreur de chargement des donnees");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  };

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
      setCmExpansions([]);
    }
  }, [open, statement?.id, statement?.status, statement?.transactionCount]);

  useEffect(() => {
    if (!open || !localStatement) return;

    const isProcessing = isProcessingStatus(localStatement.status);

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
  }, [open, accounts.length]);

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

  const handleRetry = async () => {
    if (!localStatement) return;

    setLoading(true);
    try {
      await retryBankStatementPages(localStatement.id);
      toast.success("Traitement relance en arriere-plan");
    } catch (error) {
      console.error("Error retrying:", error);
      toast.error("Echec du lancement du traitement");
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (
    id: number,
    field: TransactionEditableField,
    value: string,
  ) => {
    setEditableTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;

        if (field === "debit" || field === "credit" || field === "transactionIndex") {
          return { ...tx, [field]: Number(value || 0) };
        }

        return { ...tx, [field]: value };
      }),
    );
  };

  const handleAddTransaction = () => {
    if (!localStatement) return;

    if (
      !newTransaction.dateOperation ||
      !newTransaction.dateValeur ||
      !newTransaction.libelle
    ) {
      toast.error("Date operation, date valeur et libelle sont obligatoires");
      return;
    }

    const localTx = buildLocalTransaction(localStatement, newTransaction);
    const merged = sortByIndex([...editableTransactions, localTx]);

    setEditableTransactions(merged);
    setNewTransaction({
      ...EMPTY_NEW_TRANSACTION,
      transactionIndex: Math.max(merged.length + 1, 1),
    });

    toast.success("Transaction prete a etre enregistree");
  };

  const handleSaveAll = async () => {
    if (!localStatement) return;

    const toPersist = sortByIndex(editableTransactions);
    const effectiveRows = applyAutoComptePropagation(toPersist);

    const existingRows = effectiveRows.filter((tx) => tx.id > 0);
    const localRows = effectiveRows.filter((tx) => tx.id <= 0);

    setSaving(true);
    try {
      const existingPromises = existingRows.map((tx) =>
        updateBankTransaction(tx.id, mapTransactionUpdatePayload(tx)),
      );
      const localPromises = localRows.map((tx) =>
        createBankTransaction(mapTransactionCreatePayload(tx)),
      );

      const [updatedRows, createdRows] = await Promise.all([
        Promise.all(existingPromises),
        Promise.all(localPromises),
      ]);

      if (onUpdateTransaction) {
        updatedRows.forEach(onUpdateTransaction);
        createdRows.forEach(onUpdateTransaction);
      }

      await loadFullData(localStatement.id, true);
      toast.success("Modifications enregistrees");
    } catch (error) {
      console.error("Error saving transactions:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return {
    localStatement,
    transactions,
    editableTransactions,
    loading,
    saving,
    accounts,
    loadingAccounts,
    newTransaction,
    cmExpansions,
    loadingCmExpansions,
    editingCell,
    openComptePopoverTxId,
    hasChanges,
    setNewTransaction,
    setEditingCell,
    setOpenComptePopoverTxId,
    setEditableTransactions,
    loadFullData,
    handleRetry,
    handleCellChange,
    handleAddTransaction,
    handleSaveAll,
  };
}
