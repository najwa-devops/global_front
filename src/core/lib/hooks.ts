"use client";

import { useState, useCallback } from "react";
import { api } from "./api";
import type { DynamicInvoice, FieldPattern } from "./types";
import { dynamicInvoiceDtoToLocal } from "./utils";

// ============================================
// HOOK : UPLOAD ET PROCESS
// ============================================

export function useInvoiceUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAndProcess = useCallback(
    async (file: File): Promise<DynamicInvoice | null> => {
      setError(null);
      setIsUploading(true);

      try {
        // Upload
        const uploaded = await api.uploadInvoice(file);

        setIsUploading(false);
        setIsProcessing(true);

        // Process OCR
        const processed = await api.processInvoice(uploaded.id);

        setIsProcessing(false);

        return dynamicInvoiceDtoToLocal(processed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setIsUploading(false);
        setIsProcessing(false);
        return null;
      }
    },
    [],
  );

  return {
    uploadAndProcess,
    isUploading,
    isProcessing,
    error,
  };
}

// ============================================
// HOOK : CHARGER UNE FACTURE
// ============================================

export function useInvoice(id: number | null) {
  const [invoice, setInvoice] = useState<DynamicInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoice = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const dto = await api.getInvoiceById(id);
      setInvoice(dynamicInvoiceDtoToLocal(dto));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  return {
    invoice,
    isLoading,
    error,
    loadInvoice,
    setInvoice,
  };
}

// ============================================
// HOOK : LISTE DES FACTURES
// ============================================

export function useInvoices() {
  const [invoices, setInvoices] = useState<DynamicInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dtos = await api.getAllInvoices();
      setInvoices(dtos.map(dynamicInvoiceDtoToLocal));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    invoices,
    isLoading,
    error,
    loadInvoices,
    setInvoices,
  };
}

// ============================================
// HOOK : PATTERNS (Admin)
// ============================================

// ============================================
// HOOK : PATTERNS (Désactivé car non supporté par le nouveau backend)
// ============================================

export function useFieldPatterns() {
  const [patterns] = useState<FieldPattern[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const loadPatterns = useCallback(async () => {
    console.warn("loadPatterns non supporté par le backend actuel");
  }, []);

  const addPattern = useCallback(async (_pattern: FieldPattern) => {
    return false;
  }, []);

  const updatePattern = useCallback(
    async (_id: number, _pattern: FieldPattern) => {
      return false;
    },
    [],
  );

  const deletePattern = useCallback(async (_id: number) => {
    return false;
  }, []);

  return {
    patterns,
    isLoading,
    error,
    loadPatterns,
    addPattern,
    updatePattern,
    deletePattern,
  };
}
