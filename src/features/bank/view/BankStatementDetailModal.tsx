"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Loader2,
    FileText,
    AlertCircle,
    ArrowLeft,
    AlertTriangle,
    Plus,
    Save,
    Eye,
    Code,
    Link as LinkIcon,
    CheckCircle2,
    Calculator,
    MoreHorizontal,
} from "lucide-react"
import type { Account } from "@/lib/types"
import type { BankStatementV2, BankTransactionPreview, BankTransactionV2 } from "@/releve-bancaire/types"
import type { CmExpansion } from "@/liaison-rlv_b-ctr_mntq/types"
import { getCmExpansionsForStatement } from "@/liaison-rlv_b-ctr_mntq/api"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
    isAccountedStatus,
    isProcessingStatus,
    isValidatedStatus,
    normalizeBankStatus,
} from "@/src/features/bank/model/bank.model"
import { useAuth } from "@/hooks/use-auth"

interface BankStatementDetailModalProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    statement: BankStatementV2 | null
    onUpdateTransaction?: (transaction: BankTransactionV2) => void
    onUpdateStatement?: (statement: BankStatementV2) => void
    embedded?: boolean
    renderAsPage?: boolean
    onBack?: () => void
}

type NewTransactionForm = {
    transactionIndex: number
    dateOperation: string
    dateValeur: string
    compte: string
    libelle: string
    debit: number
    credit: number
}

const EMPTY_NEW_TRANSACTION: NewTransactionForm = {
    transactionIndex: 1,
    dateOperation: "",
    dateValeur: "",
    compte: "",
    libelle: "",
    debit: 0,
    credit: 0,
}

const DEFAULT_COMPTE_CODE = "349700000"
const DEFAULT_COMPTE_CM_CODE = "342100000"

function sortByIndex(items: BankTransactionV2[]): BankTransactionV2[] {
    return [...items].sort((a, b) => {
        const ia = a.transactionIndex ?? a.id
        const ib = b.transactionIndex ?? b.id
        return ia - ib
    })
}

function normalizeLibelle(value?: string | null): string {
    return (value || "")
        .toUpperCase()
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .replace(/[^A-Z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function parseFlexibleDate(value?: string | null): Date | null {
    const raw = (value || "").trim()
    if (!raw) return null

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
        const year = Number(isoMatch[1])
        const month = Number(isoMatch[2]) - 1
        const day = Number(isoMatch[3])
        const date = new Date(year, month, day)
        return Number.isNaN(date.getTime()) ? null : date
    }

    const frMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/)
    if (frMatch) {
        const day = Number(frMatch[1])
        const month = Number(frMatch[2]) - 1
        let year = Number(frMatch[3])
        if (year < 100) year += 2000
        const date = new Date(year, month, day)
        return Number.isNaN(date.getTime()) ? null : date
    }

    const fallback = new Date(raw)
    return Number.isNaN(fallback.getTime()) ? null : fallback
}

function getStatementPeriodStart(statement?: BankStatementV2 | null): Date | null {
    const month = Number(statement?.month)
    const year = Number(statement?.year)
    if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12 || year < 1900) {
        return null
    }
    const date = new Date(year, month - 1, 1)
    return Number.isNaN(date.getTime()) ? null : date
}

function formatDateForDisplay(value?: string | number | null, statement?: BankStatementV2 | null): string {
    if (value == null || value === "") return ""
    const parsed = parseFlexibleDate(String(value))
    if (!parsed) return String(value)
    const periodStart = getStatementPeriodStart(statement)
    const displayDate = periodStart && parsed < periodStart ? periodStart : parsed
    return displayDate.toLocaleDateString("fr-FR")
}

function formatDateForInput(value?: string | number | null): string {
    if (value == null || value === "") return ""
    const parsed = parseFlexibleDate(String(value))
    if (!parsed) return String(value)
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, "0")
    const day = String(parsed.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function formatSimulationDate(value?: string | number | null, statement?: BankStatementV2 | null): string {
    return formatDateForDisplay(value, statement) || "-"
}

function isCommissionVisualLine(value?: string | null): boolean {
    const normalized = normalizeLibelle(value)
    return /\bCOMM?ISSION\b/.test(normalized)
}

const RELEVE_OPERATIONS_HINTS = [
    "RELEVE DES OPERATIONS",
    "RELEVE D OPERATIONS",
    "RELEVE DES OPERATION",
    "RELEVE D OPERATION",
    "RELEVE OPERATIONS",
    "RELEVE OPERATION",
]

function isOperationsReleveLibelle(value?: string | null): boolean {
    const normalized = normalizeLibelle(value)
    if (!normalized) return false
    return RELEVE_OPERATIONS_HINTS.some((hint) => normalized.includes(hint))
}

function resolveCompteWithDefaults(
    compte: string | null | undefined,
    libelle: string | null | undefined,
    hasCentreMonetique: boolean
): string {
    const trimmed = (compte || "").trim()
    if (trimmed !== "" && trimmed !== DEFAULT_COMPTE_CODE) return trimmed
    if (hasCentreMonetique || isOperationsReleveLibelle(libelle)) {
        return DEFAULT_COMPTE_CM_CODE
    }
    return trimmed === "" ? DEFAULT_COMPTE_CODE : trimmed
}

function isDefaultCompte(value?: string | null): boolean {
    return (value || "").trim() === DEFAULT_COMPTE_CODE
}

function isCreditLikeLibelle(value?: string | null): boolean {
    const normalized = normalizeLibelle(value)
    return (
        normalized.startsWith("ENCAISSEMENT ") ||
        normalized.includes(" VIR RECU ") ||
        normalized.startsWith("VIR RECU ") ||
        normalized.includes(" VIREMENT RECU ") ||
        normalized.includes(" RTGS RECU ") ||
        normalized.includes(" INSTANTANE RECU ") ||
        normalized.startsWith("VERSEMENT ")
    )
}

function isDebitLikeLibelle(value?: string | null): boolean {
    const normalized = normalizeLibelle(value)
    return (
        normalized.includes(" VIR EMIS ") ||
        normalized.startsWith("VIR EMIS ") ||
        normalized.includes(" VIREMENT COMMERCIAL EMIS ") ||
        normalized.includes(" INSTANTANE EN FAVEUR ") ||
        normalized.startsWith("CHEQUE ") ||
        normalized.includes(" ACHAT PAR CARTE ") ||
        normalized.includes(" COMMISSION ") ||
        normalized.startsWith("COMMISSION ") ||
        normalized.includes(" TAXE SUR VALEUR AJOUTEE ") ||
        normalized.startsWith("TAXE SUR VALEUR AJOUTEE ") ||
        normalized.includes(" INTERETS DEBITEURS ") ||
        normalized.startsWith("INTERETS DEBITEURS ") ||
        normalized.includes(" COTISATIONS ") ||
        normalized.startsWith("COTISATIONS ") ||
        normalized.includes(" FRAIS ") ||
        normalized.startsWith("FRAIS ") ||
        normalized.includes(" REDEVANCES ") ||
        normalized.startsWith("REDEVANCES ") ||
        normalized.includes(" PRELEVEMENTS ") ||
        normalized.startsWith("PRELEVEMENTS ") ||
        normalized.includes(" RETRAIT ") ||
        normalized.startsWith("RETRAIT ") ||
        normalized.includes(" PAIEMENT FACTURES ") ||
        normalized.startsWith("PAIEMENT FACTURES ")
    )
}

function sanitizeTransactionAmounts(tx: BankTransactionV2): BankTransactionV2 {
    const debit = Number(tx.debit || 0)
    const credit = Number(tx.credit || 0)
    const hasDebit = debit > 0
    const hasCredit = credit > 0
    const isSplitRuleLine = Boolean(tx.fraisSplitRole)

    if (hasDebit && !hasCredit && tx.sens === "CREDIT") {
        return { ...tx, debit: 0, credit: debit, sens: "CREDIT" }
    }

    if (hasCredit && !hasDebit && tx.sens === "DEBIT") {
        return { ...tx, debit: credit, credit: 0, sens: "DEBIT" }
    }

    // Pour les lignes générées par les règles frais / TTC, on fait confiance
    // au sens et aux montants fournis par le backend.
    if (isSplitRuleLine) {
        return tx
    }

    if (hasDebit && !hasCredit && isCreditLikeLibelle(tx.libelle) && !isDebitLikeLibelle(tx.libelle)) {
        return { ...tx, debit: 0, credit: debit, sens: "CREDIT" }
    }

    if (hasCredit && !hasDebit && isDebitLikeLibelle(tx.libelle) && !isCreditLikeLibelle(tx.libelle)) {
        return { ...tx, debit: credit, credit: 0, sens: "DEBIT" }
    }

    return tx
}

function sanitizeTransactions(items: BankTransactionV2[]): BankTransactionV2[] {
    return items.map(sanitizeTransactionAmounts)
}

function formatMoney(value: number): string {
    return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`
}

function isBanquePopulaireLike(bankName?: string | null): boolean {
    const normalized = normalizeLibelle(bankName)
    return (
        normalized.includes("BANQUE POPULAIRE") ||
        normalized.includes("BANQUE CENTRALE POPULAIRE") ||
        normalized.includes("CHAABI") ||
        normalized === "BCP"
    )
}


const TTC_DIVISOR = 1.1
const ZERO_AMOUNT = 0
const FRONT_FRAIS_CHARGE_COMPTE = "614700000"
const FRONT_FRAIS_TVA_COMPTE = "345520106"
const FRONT_BANK_PRINCIPAL_COMPTE = "514100000"
const FRONT_COMMISSION_HT_LABEL = "COMMISSION HT"
const FRONT_COMMISSION_TVA_LABEL = "TVA SUR COMMISSION"
const FRONT_FRAIS_HT_LABEL = "FRAIS HT"
const FRONT_FRAIS_TVA_LABEL = "TVA SUR FRAIS"
const FRONT_AGIOS_HT_LABEL = "AGIOS HT"
const FRONT_AGIOS_TVA_LABEL = "TVA SUR AGIOS"
const FRONT_PACKAGE_HT_LABEL = "PACKAGE HT"
const FRONT_PACKAGE_TVA_LABEL = "TVA SUR PACKAGE"

function normalizeRuleText(value?: string | null): string {
    return (value || "")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
}

function normalizeRuleTextForMatch(value?: string | null): string {
    return normalizeRuleText(value)
        .replace(/[^A-Z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function matchesRuleStart(value: string | null | undefined, pattern: RegExp): boolean {
    const normalized = normalizeRuleTextForMatch(value)
    return normalized !== "" && pattern.test(normalized)
}

function containsCommissionKeyword(value?: string | null): boolean {
    const normalized = normalizeRuleTextForMatch(value)
    if (!normalized) return false
    if (isAlreadyDetailedFeeLine(normalized)) return false
    return /^COMM?ISSIONS?\b/.test(normalized)
}

function containsFraisKeywordForRule(value?: string | null): boolean {
    const normalized = normalizeRuleTextForMatch(value)
    if (!normalized || isAlreadyDetailedFeeLine(normalized)) return false
    return /^FRAIS\b/.test(normalized)
}

function containsAgiosKeywordForRule(value?: string | null): boolean {
    const normalized = normalizeRuleTextForMatch(value)
    if (!normalized || isAlreadyDetailedFeeLine(normalized)) return false
    return /^AGIOS?\b/.test(normalized)
}

function containsPackageKeywordForRule(value?: string | null): boolean {
    const normalized = normalizeRuleTextForMatch(value)
    if (!normalized || isAlreadyDetailedFeeLine(normalized)) return false
    return /^PACK(?:AGE)?\b/.test(normalized)
}

function isAlreadyDetailedFeeLine(normalized: string): boolean {
    return normalized === FRONT_COMMISSION_HT_LABEL
        || normalized === FRONT_COMMISSION_TVA_LABEL
        || normalized === FRONT_FRAIS_HT_LABEL
        || normalized === FRONT_FRAIS_TVA_LABEL
        || normalized === FRONT_AGIOS_HT_LABEL
        || normalized === FRONT_AGIOS_TVA_LABEL
        || normalized === FRONT_PACKAGE_HT_LABEL
        || normalized === FRONT_PACKAGE_TVA_LABEL
        || normalized === "TOTAL COMMISSIONS HT"
        || normalized === "TOTAL TVA SUR COMMISSIONS"
        || normalized === "TOTAL TVA SUR COMMISSION"
        || normalized === "TOTAL FRAIS HT"
        || normalized === "TOTAL TVA SUR FRAIS"
        || normalized === "TOTAL AGIOS HT"
        || normalized === "TOTAL TVA SUR AGIOS"
        || normalized === "TOTAL PACKAGE HT"
        || normalized === "TOTAL TVA SUR PACKAGE"
}

function hasSiblingDetailedFeeLines(items: BankTransactionV2[], source: BankTransactionV2): boolean {
    return items.some((candidate) => {
        if (!candidate || candidate.id === source.id) return false
        if (candidate.fraisRuleApplied === true) return false
        const sameIndex = candidate.transactionIndex != null && source.transactionIndex != null
            ? candidate.transactionIndex === source.transactionIndex
            : false
        const sameDate = candidate.dateOperation === source.dateOperation
        if (!sameIndex && !sameDate) return false
        return isAlreadyDetailedFeeLine(normalizeRuleText(candidate.libelle))
    })
}

function transactionAbsoluteAmount(tx: BankTransactionV2): number {
    const debit = Number(tx.debit || 0)
    if (debit > 0) return debit
    return Number(tx.credit || 0)
}

function isRuleRemiseNetLine(tx?: Pick<BankTransactionV2, "fraisSplitRole"> | null): boolean {
    return String(tx?.fraisSplitRole || "").endsWith("_REMISE_NET")
}

function shouldCountInDisplayedTotals(tx?: BankTransactionV2 | null): boolean {
    return !isRuleRemiseNetLine(tx)
}

function sumDisplayedDebit(items: BankTransactionV2[]): number {
    return items
        .filter(shouldCountInDisplayedTotals)
        .reduce((sum, tx) => sum + Number(tx.debit || 0), 0)
}

function sumDisplayedCredit(items: BankTransactionV2[]): number {
    return items
        .filter(shouldCountInDisplayedTotals)
        .reduce((sum, tx) => sum + Number(tx.credit || 0), 0)
}

function isDebitAmount(tx: BankTransactionV2): boolean {
    return Number(tx.debit || 0) > 0
}

function cloneRuleTransaction(tx: BankTransactionV2, overrides: Partial<BankTransactionV2>): BankTransactionV2 {
    return sanitizeTransactionAmounts({ ...tx, ...overrides })
}

function makeDerivedRuleId(sourceId: number, suffix: number): number {
    const base = Math.abs(Number(sourceId || Date.now()))
    return -(base * 10 + suffix)
}

function collapseRuleSplitTransactions(items: BankTransactionV2[]): BankTransactionV2[] {
    const grouped = new Map<string, BankTransactionV2[]>()
    const passthrough: BankTransactionV2[] = []

    for (const tx of items) {
        const groupId = (tx.fraisSplitGroupId || "").trim()
        if (groupId) {
            const list = grouped.get(groupId) || []
            list.push(tx)
            grouped.set(groupId, list)
        } else {
            passthrough.push({ ...tx, fraisRuleApplied: false, fraisSplitGroupId: null, fraisSplitRole: null, fraisOriginalAmount: null, ruleLabel: null })
        }
    }

    const restored: BankTransactionV2[] = [...passthrough]

    for (const group of grouped.values()) {
        const ordered = sortByIndex(group)
        const bankLine = ordered.find((tx) => String(tx.fraisSplitRole || "").endsWith("_REMISE_NET")) || ordered[ordered.length - 1]
        const amount = transactionAbsoluteAmount(bankLine)
        const originalWasDebit = !isDebitAmount(bankLine)
        restored.push(sanitizeTransactionAmounts({
            ...bankLine,
            debit: originalWasDebit ? amount : 0,
            credit: originalWasDebit ? 0 : amount,
            sens: originalWasDebit ? "DEBIT" : "CREDIT",
            fraisRuleApplied: false,
            fraisSplitGroupId: null,
            fraisSplitRole: null,
            fraisOriginalAmount: null,
            ruleLabel: null,
        }))
    }

    return sortByIndex(restored)
}

function applyFraisRuleSplitInstant(items: BankTransactionV2[]): BankTransactionV2[] {
    const expanded: BankTransactionV2[] = []

    for (const tx of items) {
        if (!tx
            || containsCommissionKeyword(tx.libelle)
            || containsFraisKeywordForRule(tx.libelle) === false
            || Boolean(tx.fraisSplitRole)
            || hasSiblingDetailedFeeLines(items, tx)) {
            expanded.push(tx)
            continue
        }

        const originalAmount = transactionAbsoluteAmount(tx)
        if (!(originalAmount > 0)) {
            expanded.push(tx)
            continue
        }

        const debitTransaction = isDebitAmount(tx)
        const netAmount = Number((originalAmount / TTC_DIVISOR).toFixed(2))
        const taxAmount = Number((originalAmount - netAmount).toFixed(2))
        const groupId = `instant-frais-${tx.id}-${tx.transactionIndex || 0}`

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 1),
            libelle: FRONT_FRAIS_HT_LABEL,
            debit: debitTransaction ? netAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : netAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_CHARGE_COMPTE,
            compteLibelle: "Frais bancaires",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "FRAIS_HT",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle frais - HT",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 2),
            libelle: FRONT_FRAIS_TVA_LABEL,
            debit: debitTransaction ? taxAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : taxAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_TVA_COMPTE,
            compteLibelle: "TVA sur frais",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "FRAIS_TVA",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle frais - TVA",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            debit: debitTransaction ? ZERO_AMOUNT : originalAmount,
            credit: debitTransaction ? originalAmount : ZERO_AMOUNT,
            sens: debitTransaction ? "CREDIT" : "DEBIT",
            compte: FRONT_BANK_PRINCIPAL_COMPTE,
            compteLibelle: "Banque principale",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "FRAIS_REMISE_NET",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle frais - Remise nette",
        }))
    }

    return sortByIndex(expanded)
}

function applyAgiosRuleSplitInstant(items: BankTransactionV2[]): BankTransactionV2[] {
    const expanded: BankTransactionV2[] = []

    for (const tx of items) {
        if (!tx
            || containsCommissionKeyword(tx.libelle)
            || containsFraisKeywordForRule(tx.libelle)
            || containsAgiosKeywordForRule(tx.libelle) === false
            || Boolean(tx.fraisSplitRole)
            || hasSiblingDetailedFeeLines(items, tx)) {
            expanded.push(tx)
            continue
        }

        const originalAmount = transactionAbsoluteAmount(tx)
        if (!(originalAmount > 0)) {
            expanded.push(tx)
            continue
        }

        const debitTransaction = isDebitAmount(tx)
        const netAmount = Number((originalAmount / TTC_DIVISOR).toFixed(2))
        const taxAmount = Number((originalAmount - netAmount).toFixed(2))
        const groupId = `instant-agios-${tx.id}-${tx.transactionIndex || 0}`

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 6),
            libelle: FRONT_AGIOS_HT_LABEL,
            debit: debitTransaction ? netAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : netAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_CHARGE_COMPTE,
            compteLibelle: "Frais bancaires",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "AGIOS_HT",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle agios - HT",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 7),
            libelle: FRONT_AGIOS_TVA_LABEL,
            debit: debitTransaction ? taxAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : taxAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_TVA_COMPTE,
            compteLibelle: "TVA sur frais",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "AGIOS_TVA",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle agios - TVA",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            debit: debitTransaction ? ZERO_AMOUNT : originalAmount,
            credit: debitTransaction ? originalAmount : ZERO_AMOUNT,
            sens: debitTransaction ? "CREDIT" : "DEBIT",
            compte: FRONT_BANK_PRINCIPAL_COMPTE,
            compteLibelle: "Banque principale",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "AGIOS_REMISE_NET",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle agios - Remise nette",
        }))
    }

    return sortByIndex(expanded)
}

function applyPackageRuleSplitInstant(items: BankTransactionV2[]): BankTransactionV2[] {
    const expanded: BankTransactionV2[] = []

    for (const tx of items) {
        if (!tx
            || containsCommissionKeyword(tx.libelle)
            || containsFraisKeywordForRule(tx.libelle)
            || containsAgiosKeywordForRule(tx.libelle)
            || containsPackageKeywordForRule(tx.libelle) === false
            || Boolean(tx.fraisSplitRole)
            || hasSiblingDetailedFeeLines(items, tx)) {
            expanded.push(tx)
            continue
        }

        const originalAmount = transactionAbsoluteAmount(tx)
        if (!(originalAmount > 0)) {
            expanded.push(tx)
            continue
        }

        const debitTransaction = isDebitAmount(tx)
        const netAmount = Number((originalAmount / TTC_DIVISOR).toFixed(2))
        const taxAmount = Number((originalAmount - netAmount).toFixed(2))
        const groupId = `instant-package-${tx.id}-${tx.transactionIndex || 0}`

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 8),
            libelle: FRONT_PACKAGE_HT_LABEL,
            debit: debitTransaction ? netAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : netAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_CHARGE_COMPTE,
            compteLibelle: "Frais bancaires",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "PACKAGE_HT",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle package - HT",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 9),
            libelle: FRONT_PACKAGE_TVA_LABEL,
            debit: debitTransaction ? taxAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : taxAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_TVA_COMPTE,
            compteLibelle: "TVA sur frais",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "PACKAGE_TVA",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle package - TVA",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            debit: debitTransaction ? ZERO_AMOUNT : originalAmount,
            credit: debitTransaction ? originalAmount : ZERO_AMOUNT,
            sens: debitTransaction ? "CREDIT" : "DEBIT",
            compte: FRONT_BANK_PRINCIPAL_COMPTE,
            compteLibelle: "Banque principale",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "PACKAGE_REMISE_NET",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle package - Remise nette",
        }))
    }

    return sortByIndex(expanded)
}

function applyTtcRuleSplitInstant(items: BankTransactionV2[]): BankTransactionV2[] {
    const expanded: BankTransactionV2[] = []

    for (const tx of items) {
        if (!tx
            || Boolean(tx.fraisRuleApplied)
            || Boolean(tx.fraisSplitRole)
            || !containsCommissionKeyword(tx.libelle)
            || hasSiblingDetailedFeeLines(items, tx)) {
            expanded.push(tx)
            continue
        }

        const originalAmount = transactionAbsoluteAmount(tx)
        if (!(originalAmount > 0)) {
            expanded.push(tx)
            continue
        }

        const debitTransaction = isDebitAmount(tx)
        const netAmount = Number((originalAmount / TTC_DIVISOR).toFixed(2))
        const taxAmount = Number((originalAmount - netAmount).toFixed(2))
        const groupId = `instant-ttc-${tx.id}-${tx.transactionIndex || 0}`

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 4),
            libelle: FRONT_COMMISSION_HT_LABEL,
            debit: debitTransaction ? netAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : netAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_CHARGE_COMPTE,
            compteLibelle: "Frais bancaires",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "COMMISSION_HT",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle TTC - HT",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            id: makeDerivedRuleId(tx.id, 5),
            libelle: FRONT_COMMISSION_TVA_LABEL,
            debit: debitTransaction ? taxAmount : ZERO_AMOUNT,
            credit: debitTransaction ? ZERO_AMOUNT : taxAmount,
            sens: debitTransaction ? "DEBIT" : "CREDIT",
            compte: FRONT_FRAIS_TVA_COMPTE,
            compteLibelle: "TVA sur frais",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "COMMISSION_TVA",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle TTC - TVA",
        }))

        expanded.push(cloneRuleTransaction(tx, {
            debit: debitTransaction ? ZERO_AMOUNT : originalAmount,
            credit: debitTransaction ? originalAmount : ZERO_AMOUNT,
            sens: debitTransaction ? "CREDIT" : "DEBIT",
            compte: FRONT_BANK_PRINCIPAL_COMPTE,
            compteLibelle: "Banque principale",
            isLinked: true,
            fraisRuleApplied: true,
            fraisSplitGroupId: groupId,
            fraisSplitRole: "COMMISSION_REMISE_NET",
            fraisOriginalAmount: originalAmount,
            ruleLabel: "Regle TTC - Remise nette",
        }))
    }

    return sortByIndex(expanded)
}

function projectTransactionsForRules(
    baseItems: BankTransactionV2[],
    applyFraisRule: boolean,
    applyTtcRule: boolean,
    applyAgiosRule: boolean,
    applyPackageRule: boolean,
): BankTransactionV2[] {
    let projected = sortByIndex(baseItems.map((tx) => sanitizeTransactionAmounts({ ...tx })))
    if (applyFraisRule) {
        projected = applyFraisRuleSplitInstant(projected)
    }
    if (applyAgiosRule) {
        projected = applyAgiosRuleSplitInstant(projected)
    }
    if (applyPackageRule) {
        projected = applyPackageRuleSplitInstant(projected)
    }
    if (applyTtcRule) {
        projected = applyTtcRuleSplitInstant(projected)
    }
    return sortByIndex(projected.map(sanitizeTransactionAmounts))
}

function toTransactionPreview(tx: BankTransactionV2): BankTransactionPreview {
    return {
        id: tx.id,
        date: tx.dateOperation,
        libelle: tx.libelle,
        debit: Number(tx.debit || 0),
        credit: Number(tx.credit || 0),
        compte: tx.compte,
        isLinked: tx.isLinked,
        transactionIndex: tx.transactionIndex,
        sens: tx.sens,
        isValid: tx.isValid,
    }
}

function projectStatementForRules(
    statement: BankStatementV2,
    projected: BankTransactionV2[],
    applyFraisRule: boolean,
    applyTtcRule: boolean,
    applyAgiosRule: boolean,
    applyPackageRule: boolean,
): BankStatementV2 {
    const totalDebit = sumDisplayedDebit(projected)
    const totalCredit = sumDisplayedCredit(projected)
    const fraisGroups = new Set(projected.filter((tx) => String(tx.fraisSplitRole || "").startsWith("FRAIS_")).map((tx) => tx.fraisSplitGroupId).filter(Boolean))
    const agiosGroups = new Set(projected.filter((tx) => String(tx.fraisSplitRole || "").startsWith("AGIOS_")).map((tx) => tx.fraisSplitGroupId).filter(Boolean))
    const packageGroups = new Set(projected.filter((tx) => String(tx.fraisSplitRole || "").startsWith("PACKAGE_")).map((tx) => tx.fraisSplitGroupId).filter(Boolean))
    const ttcGroups = new Set(projected.filter((tx) => String(tx.fraisSplitRole || "").startsWith("COMMISSION_")).map((tx) => tx.fraisSplitGroupId).filter(Boolean))
    return {
        ...statement,
        applyFraisRule,
        applyTtcRule,
        applyAgiosRule,
        applyPackageRule,
        transactions: projected,
        transactionsPreview: projected.map(toTransactionPreview),
        transactionCount: projected.length,
        totalDebit,
        totalCredit,
        fraisRuleAppliedCount: fraisGroups.size,
        hasFraisRuleApplied: fraisGroups.size > 0,
        fraisRuleWarningMessage: fraisGroups.size > 0
            ? `${fraisGroups.size} transaction(s) d'origine ont ete traitees par la regle frais.`
            : null,
        agiosRuleAppliedCount: agiosGroups.size,
        hasAgiosRuleApplied: agiosGroups.size > 0,
        agiosRuleWarningMessage: agiosGroups.size > 0
            ? `${agiosGroups.size} transaction(s) d'origine ont ete traitees par la regle agios.`
            : null,
        packageRuleAppliedCount: packageGroups.size,
        hasPackageRuleApplied: packageGroups.size > 0,
        packageRuleWarningMessage: packageGroups.size > 0
            ? `${packageGroups.size} transaction(s) d'origine ont ete traitees par la regle package.`
            : null,
        ttcRuleAppliedCount: ttcGroups.size,
        hasTtcRuleApplied: ttcGroups.size > 0,
        ttcRuleWarningMessage: ttcGroups.size > 0
            ? `${ttcGroups.size} transaction(s) d'origine ont ete traitees par la regle TTC / commission.`
            : null,
    }
}



export function BankStatementDetailModal({
    open = false,
    onOpenChange,
    statement,
    onUpdateTransaction,
    onUpdateStatement,
    embedded = false,
    renderAsPage = false,
    onBack,
}: BankStatementDetailModalProps) {
    const router = useRouter()
    const { isClient } = useAuth()
    const isClientUser = isClient()
    const [transactions, setTransactions] = useState<BankTransactionV2[]>([])
    const [editableTransactions, setEditableTransactions] = useState<BankTransactionV2[]>([])
    const [baseTransactions, setBaseTransactions] = useState<BankTransactionV2[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [showAccountingModal, setShowAccountingModal] = useState(false)
    const [accountingLoading, setAccountingLoading] = useState(false)
    const [confirmLoading, setConfirmLoading] = useState(false)
    const [showConfirmAccountingDialog, setShowConfirmAccountingDialog] = useState(false)
    const [simulationResult, setSimulationResult] = useState<any | null>(null)
    const [accountingConfirmed, setAccountingConfirmed] = useState(false)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loadingAccounts, setLoadingAccounts] = useState(false)
    const [localStatement, setLocalStatement] = useState<BankStatementV2 | null>(null)
    const isClientValidated = isClientUser && Boolean(localStatement?.clientValidated)
    const [ttcUpdating, setTtcUpdating] = useState(false)
    const [fraisUpdating, setFraisUpdating] = useState(false)
    const [agiosUpdating, setAgiosUpdating] = useState(false)
    const [packageUpdating, setPackageUpdating] = useState(false)
    const [newTransaction, setNewTransaction] = useState<NewTransactionForm>(EMPTY_NEW_TRANSACTION)
    const [showNewTransactionForm, setShowNewTransactionForm] = useState(false)
    const [editingCell, setEditingCell] = useState<{
        id: number
        field: "transactionIndex" | "dateOperation" | "dateValeur" | "compte" | "libelle" | "debit" | "credit"
    } | null>(null)
    const [openComptePopoverTxId, setOpenComptePopoverTxId] = useState<number | null>(null)
    const [openNewComptePopover, setOpenNewComptePopover] = useState(false)
    const lastLoadedId = useRef<number | null>(null)
    const lastCmExpansionsStatementId = useRef<number | null>(null)
    const [cmExpansions, setCmExpansions] = useState<Record<number, CmExpansion>>({})
    const [cmAppliedOverrides, setCmAppliedOverrides] = useState<Record<number, boolean>>({})
    // bankTransactionIds où l'utilisateur a décoché l'expansion (affiche la ligne originale)
    const [collapsedCmTxIds, setCollapsedCmTxIds] = useState<Set<number>>(new Set())

    const getCmOverridesStorageKey = (statementId: number) => `bank-statement-cm-overrides:${statementId}`

    const readCmOverrides = (statementId: number): Record<number, boolean> => {
        if (typeof window === "undefined") {
            return {}
        }
        try {
            const raw = window.localStorage.getItem(getCmOverridesStorageKey(statementId))
            if (!raw) {
                return {}
            }
            const parsed = JSON.parse(raw) as Record<string, boolean>
            return Object.fromEntries(
                Object.entries(parsed).map(([key, value]) => [Number(key), Boolean(value)])
            )
        } catch {
            return {}
        }
    }

    const writeCmOverrides = (statementId: number, overrides: Record<number, boolean>) => {
        if (typeof window === "undefined") {
            return
        }
        const serialized = JSON.stringify(
            Object.fromEntries(
                Object.entries(overrides).map(([key, value]) => [String(key), Boolean(value)])
            )
        )
        window.localStorage.setItem(getCmOverridesStorageKey(statementId), serialized)
    }

    const persistCmAppliedChange = async (txId: number, nextApplied: boolean) => {
        const previousEditable = editableTransactions
        const previousTransactions = transactions
        const previousBase = baseTransactions

        const applyLocal = (rows: BankTransactionV2[]) =>
            rows.map((row) => (row.id === txId ? { ...row, cmApplied: nextApplied } : row))

        setEditableTransactions((prev) => applyLocal(prev))
        setTransactions((prev) => applyLocal(prev))
        setBaseTransactions((prev) => applyLocal(prev))

        try {
            const updated = await api.updateBankTransaction(txId, { cmApplied: nextApplied })
            const normalized = { ...updated, cmApplied: nextApplied }
            setEditableTransactions((prev) => prev.map((row) => (row.id === txId ? normalized : row)))
            setTransactions((prev) => prev.map((row) => (row.id === txId ? normalized : row)))
            setBaseTransactions((prev) => prev.map((row) => (row.id === txId ? normalized : row)))
            if (localStatement?.id) {
                setCmAppliedOverrides((prev) => {
                    const next = { ...prev }
                    if (nextApplied) {
                        delete next[txId]
                    } else {
                        next[txId] = false
                    }
                    writeCmOverrides(localStatement.id, next)
                    return next
                })
            }
            onUpdateTransaction?.(normalized)
        } catch (error) {
            setEditableTransactions(previousEditable)
            setTransactions(previousTransactions)
            setBaseTransactions(previousBase)
            toast.error("Impossible d'enregistrer la liaison Centre Monétique")
        }
    }

    const resolveDisplayCompteForTx = (tx: BankTransactionV2): string => {
        return resolveCompteWithDefaults(tx.compte, tx.libelle, Boolean(cmExpansions[tx.id]))
    }

    const formatCmStructureLabel = (structure?: string | null): string => {
        const normalized = String(structure || "").trim().toUpperCase()
        if (!normalized) return "CM"
        switch (normalized) {
            case "BARID_BANK":
                return "BARID BANK"
            case "AMEX":
                return "AMEX"
            case "VPS":
                return "VPS"
            case "CMI":
                return "CMI"
            case "AUTO":
                return "AUTO"
            default:
                return normalized.replace(/_/g, " ")
        }
    }

    const isSelectedCompteForTx = (tx: BankTransactionV2): boolean => {
        return resolveDisplayCompteForTx(tx) !== DEFAULT_COMPTE_CODE
    }

    const isCmAppliedForTx = (tx: BankTransactionV2): boolean => {
        const override = cmAppliedOverrides[tx.id]
        if (override !== undefined) {
            return override
        }
        if (cmExpansions[tx.id] != null) {
            return true
        }
        return Boolean(tx.cmApplied)
    }

    const cmSummary = useMemo(() => {
        const linkedIds = new Set<number>()
        for (const key of Object.keys(cmExpansions)) {
            const id = Number(key)
            if (!Number.isNaN(id)) linkedIds.add(id)
        }
        const linkedCount = linkedIds.size
        const appliedCount = editableTransactions.filter((tx) => linkedIds.has(tx.id) && isCmAppliedForTx(tx)).length
        const skippedCount = Math.max(linkedCount - appliedCount, 0)
        return { linkedCount, appliedCount, skippedCount }
    }, [cmAppliedOverrides, cmExpansions, editableTransactions])

    const ttcSummary = useMemo(() => {
        const sourceCount = Number(localStatement?.ttcRuleAppliedCount || 0)
        const detectedCount = editableTransactions.filter((tx) => String(tx.fraisSplitRole || "").startsWith("COMMISSION_")).length
        return {
            sourceCount,
            detectedCount,
            hasApplied: sourceCount > 0 || Boolean(localStatement?.hasTtcRuleApplied) || Boolean(localStatement?.applyTtcRule),
        }
    }, [editableTransactions, localStatement?.ttcRuleAppliedCount, localStatement?.hasTtcRuleApplied, localStatement?.applyTtcRule])

    const fraisSummary = useMemo(() => {
        const sourceCount = Number(localStatement?.fraisRuleAppliedCount || 0)
        const splitCount = editableTransactions.filter((tx) => Boolean(tx.fraisRuleApplied)).length
        return {
            sourceCount,
            splitCount,
            hasApplied: sourceCount > 0 || Boolean(localStatement?.hasFraisRuleApplied) || Boolean(localStatement?.applyFraisRule),
            message: localStatement?.fraisRuleWarningMessage || null,
        }
    }, [editableTransactions, localStatement?.fraisRuleAppliedCount, localStatement?.hasFraisRuleApplied, localStatement?.fraisRuleWarningMessage, localStatement?.applyFraisRule])

    const agiosSummary = useMemo(() => {
        const sourceCount = Number(localStatement?.agiosRuleAppliedCount || 0)
        const splitCount = editableTransactions.filter((tx) => String(tx.fraisSplitRole || "").startsWith("AGIOS_")).length
        return {
            sourceCount,
            splitCount,
            hasApplied: sourceCount > 0 || Boolean(localStatement?.hasAgiosRuleApplied) || Boolean(localStatement?.applyAgiosRule),
            message: localStatement?.agiosRuleWarningMessage || null,
        }
    }, [editableTransactions, localStatement?.agiosRuleAppliedCount, localStatement?.hasAgiosRuleApplied, localStatement?.agiosRuleWarningMessage, localStatement?.applyAgiosRule])

    const packageSummary = useMemo(() => {
        const sourceCount = Number(localStatement?.packageRuleAppliedCount || 0)
        const splitCount = editableTransactions.filter((tx) => String(tx.fraisSplitRole || "").startsWith("PACKAGE_")).length
        return {
            sourceCount,
            splitCount,
            hasApplied: sourceCount > 0 || Boolean(localStatement?.hasPackageRuleApplied) || Boolean(localStatement?.applyPackageRule),
            message: localStatement?.packageRuleWarningMessage || null,
        }
    }, [editableTransactions, localStatement?.packageRuleAppliedCount, localStatement?.hasPackageRuleApplied, localStatement?.packageRuleWarningMessage, localStatement?.applyPackageRule])

    const balanceRule = useMemo(() => {
        const openingBalance = Number(localStatement?.openingBalance || 0)
        const expectedClosingBalance = Number(localStatement?.closingBalance || 0)
        const totalDebit = sumDisplayedDebit(editableTransactions)
        const totalCredit = sumDisplayedCredit(editableTransactions)
        const calculatedClosingBalance = openingBalance + totalCredit - totalDebit
        const difference = calculatedClosingBalance - expectedClosingBalance
        const roundedDifference = Math.round(difference * 100) / 100
        const isValid = Math.abs(roundedDifference) < 0.01
        const backendAvailable =
            typeof localStatement?.isBalanceValid === "boolean" ||
            typeof localStatement?.balanceDifference === "number"
        const backendDifference = Math.round(Number(localStatement?.balanceDifference || 0) * 100) / 100
        const backendIsValid = Boolean(localStatement?.isBalanceValid)

        return {
            openingBalance,
            totalDebit,
            totalCredit,
            expectedClosingBalance,
            calculatedClosingBalance,
            difference: roundedDifference,
            isValid,
            backendAvailable,
            backendDifference,
            backendIsValid,
        }
    }, [editableTransactions, localStatement?.openingBalance, localStatement?.closingBalance, localStatement?.balanceDifference, localStatement?.isBalanceValid])

    const usesPopularBankRule = isBanquePopulaireLike(localStatement?.bankName)
    const showBalanceFormula = usesPopularBankRule

    // Vérification débit/crédit pour les autres banques (comparaison PDF vs calculé)
    const otherBankCheck = useMemo(() => {
        const debitCalcule  = balanceRule.totalDebit
        const creditCalcule = balanceRule.totalCredit
        const debitPdf      = Number(localStatement?.totalDebitPdf  ?? null)
        const creditPdf     = Number(localStatement?.totalCreditPdf ?? null)
        const hasPdfTotals  = localStatement?.totalDebitPdf != null && localStatement?.totalCreditPdf != null
        const ecartDebit    = hasPdfTotals ? Math.round(Math.abs(debitPdf  - debitCalcule)  * 100) / 100 : null
        const ecartCredit   = hasPdfTotals ? Math.round(Math.abs(creditPdf - creditCalcule) * 100) / 100 : null
        const isValid       = hasPdfTotals ? (ecartDebit! < 0.01 && ecartCredit! < 0.01) : null
        return { debitCalcule, creditCalcule, debitPdf, creditPdf, hasPdfTotals, ecartDebit, ecartCredit, isValid }
    }, [balanceRule.totalDebit, balanceRule.totalCredit, localStatement?.totalDebitPdf, localStatement?.totalCreditPdf])

    useEffect(() => {
        if ((embedded || open) && statement) {
            const isNewId = lastLoadedId.current !== statement.id
            setLocalStatement(statement)
            if (isNewId) {
                lastLoadedId.current = statement.id
                loadFullData(statement.id, false)
            } else {
                loadFullData(statement.id, true)
            }
        } else if (!open) {
            lastLoadedId.current = null
            lastCmExpansionsStatementId.current = null
            setOpenComptePopoverTxId(null)
            setOpenNewComptePopover(false)
            setShowNewTransactionForm(false)
            setCmAppliedOverrides({})
        }
    }, [open, statement?.id, statement?.status, statement?.transactionCount])

    useEffect(() => {
        if (!(embedded || open) || !localStatement) return
        const isProcessing = isProcessingStatus(localStatement.status)
        if (!isProcessing) return
        const interval = setInterval(() => {
            loadFullData(localStatement.id, true)
        }, 1500)
        return () => clearInterval(interval)
    }, [embedded, open, localStatement?.status, localStatement?.id])

    useEffect(() => {
        if ((embedded || open) && accounts.length === 0) {
            loadAccounts()
        }
    }, [embedded, open])

    const loadFullData = async (id: number, silent = false): Promise<BankStatementV2 | null> => {
        if (!id) return null
        if (!silent) setLoading(true)
        try {
            const data = await api.getBankStatementById(id)
            setLocalStatement(data)
            const txData = data.transactions && data.transactions.length > 0
                ? data.transactions
                : await api.getTransactionsByStatementId(id)
            const sorted = sortByIndex(sanitizeTransactions(txData))
            const canonical = collapseRuleSplitTransactions(sorted)
            const projected = projectTransactionsForRules(
                canonical,
                Boolean(data.applyFraisRule),
                Boolean(data.applyTtcRule),
                Boolean(data.applyAgiosRule),
                Boolean(data.applyPackageRule),
            )
            setBaseTransactions(canonical)
            setTransactions(projected)
            setEditableTransactions(projected)
            setLocalStatement((prev) => prev ? projectStatementForRules(
                { ...prev, ...data },
                projected,
                Boolean(data.applyFraisRule),
                Boolean(data.applyTtcRule),
                Boolean(data.applyAgiosRule),
                Boolean(data.applyPackageRule),
            ) : projectStatementForRules(
                data,
                projected,
                Boolean(data.applyFraisRule),
                Boolean(data.applyTtcRule),
                Boolean(data.applyAgiosRule),
                Boolean(data.applyPackageRule),
            ))
            setNewTransaction((prev) => ({
                ...prev,
                transactionIndex: Math.max(projected.length + 1, 1),
            }))
            // Charger les expansions CM en arrière-plan (non bloquant)
            getCmExpansionsForStatement(id).then((expansions) => {
                const map: Record<number, CmExpansion> = {}
                for (const exp of expansions) {
                    map[exp.bankTransactionId] = exp
                }
                setCmExpansions(map)
                setCmAppliedOverrides(readCmOverrides(id))
                const expansionIds = new Set(expansions.map((exp) => exp.bankTransactionId))
                setCollapsedCmTxIds((prev) => {
                    if (lastCmExpansionsStatementId.current !== id) {
                        lastCmExpansionsStatementId.current = id
                        return new Set()
                    }
                    return new Set([...prev].filter((txId) => expansionIds.has(txId)))
                })
            }).catch(() => {/* silencieux */})
            return data
        } catch (error) {
            console.error("Error loading full data:", error)
            if (!silent) toast.error("Erreur de chargement des données")
            return null
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const loadAccounts = async () => {
        setLoadingAccounts(true)
        try {
            const data = await api.getAccounts(true)
            if (data.length > 0) {
                setAccounts(data)
                return
            }

            const fallback = await api.getAccountOptions()
            setAccounts(fallback)
        } catch (error) {
            console.error("Error loading accounts:", error)
        } finally {
            setLoadingAccounts(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const normalized = String(status || "").toUpperCase()
        switch (normalized) {
            case "PENDING":
            case "EN_ATTENTE":
                return <Badge className="bg-sky-400/10 text-sky-500 border-sky-400/30">En attente</Badge>
            case "PROCESSING":
            case "EN_COURS":
                return <Badge className="bg-blue-500/10 text-blue-600 border-blue-400/30 animate-pulse">En cours</Badge>
            case "TREATED":
            case "TRAITE":
            case "VERIFY":
            case "A_VERIFIER":
                return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/40 animate-pulse shadow-[0_0_0_1px_rgba(249,115,22,0.18)]">À vérifier</Badge>
            case "READY_TO_VALIDATE":
            case "PRET_A_VALIDER":
                return <Badge className="bg-emerald-400/10 text-emerald-500 border-emerald-400/30">Prêt à valider</Badge>
            case "VALIDATED":
            case "VALIDE":
                return <Badge className="bg-emerald-600 text-white border-emerald-700">Validé</Badge>
            case "COMPTABILISE":
            case "COMPTABILISÉ":
                return <Badge className="bg-violet-600 text-white border-violet-700">Comptabilisé</Badge>
            case "ERROR":
            case "ERREUR":
                return <Badge className="bg-destructive text-white border-destructive">Erreur</Badge>
            case "PARTIAL_SUCCESS":
                return <Badge className="bg-orange-400/10 text-orange-600 border-orange-400/30">Succès Partiel</Badge>
            default:
                return <Badge className="bg-muted/10 text-muted-foreground border-muted/30">{normalized || "INCONNU"}</Badge>
        }
    }

    const handleRetry = async () => {
        if (!localStatement) return
        setLoading(true)
        try {
            await api.retryFailedBankStatementPages(localStatement.id)
            toast.success("Traitement relancé en arrière-plan")
        } catch (error) {
            console.error("Error retrying:", error)
            toast.error("Échec du lancement du traitement")
        } finally {
            setLoading(false)
        }
    }

    const applyRuleProjection = (applyFraisRule: boolean, applyTtcRule: boolean, applyAgiosRule: boolean, applyPackageRule: boolean) => {
        if (!localStatement) return null
        const canonical = collapseRuleSplitTransactions(baseTransactions.length > 0 ? baseTransactions : editableTransactions)
        const projected = projectTransactionsForRules(canonical, applyFraisRule, applyTtcRule, applyAgiosRule, applyPackageRule)
        setBaseTransactions(canonical)
        setTransactions(projected)
        setEditableTransactions(projected)
        const projectedStatement = projectStatementForRules(localStatement, projected, applyFraisRule, applyTtcRule, applyAgiosRule, applyPackageRule)
        setLocalStatement(projectedStatement)
        setNewTransaction((prev) => ({ ...prev, transactionIndex: Math.max(projected.length + 1, 1) }))
        return { canonical, projectedStatement }
    }

    const handleToggleTtcRule = async (checked: boolean) => {
        if (!localStatement) return
        const previousStatement = localStatement
        const previousTransactions = transactions
        const previousEditableTransactions = editableTransactions
        const previousBaseTransactions = baseTransactions

        setTtcUpdating(true)
        applyRuleProjection(Boolean(localStatement.applyFraisRule), checked, Boolean(localStatement.applyAgiosRule), Boolean(localStatement.applyPackageRule))
        try {
            const updated = await api.updateBankStatementTtcRule(localStatement.id, checked, true)
            setLocalStatement(updated)
            await loadFullData(updated.id, true)
            toast.success("Mise à jour TTC terminée")
        } catch (error) {
            console.error("Error updating TTC rule:", error)
            const recovered = await loadFullData(localStatement.id, true)
            if (recovered && Boolean(recovered.applyTtcRule) === checked) {
                toast.success("Règle TTC enregistrée")
            } else {
                setLocalStatement(previousStatement)
                setTransactions(previousTransactions)
                setEditableTransactions(previousEditableTransactions)
                setBaseTransactions(previousBaseTransactions)
                toast.error("Échec de mise à jour de la règle TTC")
            }
        } finally {
            setTtcUpdating(false)
        }
    }

    const handleToggleFraisRule = async (checked: boolean) => {
        if (!localStatement) return
        const previousStatement = localStatement
        const previousTransactions = transactions
        const previousEditableTransactions = editableTransactions
        const previousBaseTransactions = baseTransactions

        setFraisUpdating(true)
        applyRuleProjection(checked, Boolean(localStatement.applyTtcRule), Boolean(localStatement.applyAgiosRule), Boolean(localStatement.applyPackageRule))
        try {
            const updated = await api.updateBankStatementFraisRule(localStatement.id, checked, true)
            setLocalStatement(updated)
            await loadFullData(updated.id, true)
            toast.success("Mise à jour règle frais terminée")
        } catch (error) {
            console.error("Error updating frais rule:", error)
            const recovered = await loadFullData(localStatement.id, true)
            if (recovered && Boolean(recovered.applyFraisRule) === checked) {
                toast.success("Règle frais enregistrée")
            } else {
                setLocalStatement(previousStatement)
                setTransactions(previousTransactions)
                setEditableTransactions(previousEditableTransactions)
                setBaseTransactions(previousBaseTransactions)
                toast.error("Échec de mise à jour de la règle frais")
            }
        } finally {
            setFraisUpdating(false)
        }
    }

    const handleToggleAgiosRule = async (checked: boolean) => {
        if (!localStatement) return
        const previousStatement = localStatement
        const previousTransactions = transactions
        const previousEditableTransactions = editableTransactions
        const previousBaseTransactions = baseTransactions

        setAgiosUpdating(true)
        applyRuleProjection(Boolean(localStatement.applyFraisRule), Boolean(localStatement.applyTtcRule), checked, Boolean(localStatement.applyPackageRule))
        try {
            const updated = await api.updateBankStatementAgiosRule(localStatement.id, checked, true)
            setLocalStatement(updated)
            await loadFullData(updated.id, true)
            toast.success("Mise à jour règle agios terminée")
        } catch (error) {
            console.error("Error updating agios rule:", error)
            const recovered = await loadFullData(localStatement.id, true)
            if (recovered && Boolean(recovered.applyAgiosRule) === checked) {
                toast.success("Règle agios enregistrée")
            } else {
                setLocalStatement(previousStatement)
                setTransactions(previousTransactions)
                setEditableTransactions(previousEditableTransactions)
                setBaseTransactions(previousBaseTransactions)
                toast.error("Échec de mise à jour de la règle agios")
            }
        } finally {
            setAgiosUpdating(false)
        }
    }

    const handleTogglePackageRule = async (checked: boolean) => {
        if (!localStatement) return
        const previousStatement = localStatement
        const previousTransactions = transactions
        const previousEditableTransactions = editableTransactions
        const previousBaseTransactions = baseTransactions

        setPackageUpdating(true)
        applyRuleProjection(Boolean(localStatement.applyFraisRule), Boolean(localStatement.applyTtcRule), Boolean(localStatement.applyAgiosRule), checked)
        try {
            const updated = await api.updateBankStatementPackageRule(localStatement.id, checked, true)
            setLocalStatement(updated)
            await loadFullData(updated.id, true)
            toast.success("Mise à jour règle package terminée")
        } catch (error) {
            console.error("Error updating package rule:", error)
            const recovered = await loadFullData(localStatement.id, true)
            if (recovered && Boolean(recovered.applyPackageRule) === checked) {
                toast.success("Règle package enregistrée")
            } else {
                setLocalStatement(previousStatement)
                setTransactions(previousTransactions)
                setEditableTransactions(previousEditableTransactions)
                setBaseTransactions(previousBaseTransactions)
                toast.error("Échec de mise à jour de la règle package")
            }
        } finally {
            setPackageUpdating(false)
        }
    }

    const handleCellChange = (
        id: number,
        field: keyof Pick<BankTransactionV2, "transactionIndex" | "dateOperation" | "dateValeur" | "compte" | "libelle" | "debit" | "credit">,
        value: string
    ) => {
        setEditableTransactions((prev) =>
            prev.map((tx) => {
                if (tx.id !== id) return tx
                if (field === "debit" || field === "credit" || field === "transactionIndex") {
                    return { ...tx, [field]: Number(value || 0) }
                }
                return { ...tx, [field]: value }
            })
        )
    }

    const isEditingCell = (
        id: number,
        field: "transactionIndex" | "dateOperation" | "dateValeur" | "compte" | "libelle" | "debit" | "credit"
    ) => editingCell?.id === id && editingCell.field === field

    const renderEditableCell = (
        tx: BankTransactionV2,
        field: "transactionIndex" | "dateOperation" | "dateValeur" | "compte" | "libelle" | "debit" | "credit",
        options?: { type?: "text" | "number" | "date"; step?: string; className?: string; emptyLabel?: string }
    ) => {
        const readOnly = !!localStatement && (isAccountedStatus(localStatement.status) || isClientValidated)
        const isEditing = isEditingCell(tx.id, field)
        const rawValue = (tx[field] ?? "") as string | number
        const value = field === "compte"
            ? resolveDisplayCompteForTx(tx)
            : rawValue
        const displayValue = field === "compte"
            ? String(value)
            : options?.type === "date"
                ? formatDateForDisplay(value, localStatement)
                : (value === "" || value === null ? (options?.emptyLabel || "—") : String(value))
        const inputValue = field === "compte"
            ? String(value)
            : options?.type === "date"
                ? formatDateForInput(value)
                : value

        if (readOnly) {
            return (
                <div className={cn("rounded px-2 py-1", options?.className)}>
                    {displayValue}
                </div>
            )
        }

        if (isEditing) {
            return (
                <Input
                    autoFocus
                    type={options?.type || "text"}
                    step={options?.step}
                    min={options?.type === "number" ? 0 : undefined}
                    value={inputValue}
                    onChange={(e) => handleCellChange(tx.id, field, e.target.value)}
                    onBlur={() => setEditingCell(null)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                            setEditingCell(null)
                        }
                    }}
                />
            )
        }

        return (
            <div
                role="button"
                tabIndex={0}
                onClick={() => setEditingCell({ id: tx.id, field })}
                onKeyDown={(e) => {
                    if (e.key === "Enter") setEditingCell({ id: tx.id, field })
                }}
                className={cn("cursor-pointer rounded px-2 py-1 hover:bg-muted/50", options?.className)}
                title="Cliquer pour modifier"
            >
                {displayValue}
            </div>
        )
    }

    const handleAddTransaction = () => {
        if (!localStatement) return
        if (!newTransaction.dateOperation || !newTransaction.dateValeur || !newTransaction.libelle) {
            toast.error("Date opération, date valeur et libellé sont obligatoires")
            return
        }
        const targetIndex = Math.max(1, Math.floor(newTransaction.transactionIndex || 1))
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
            cmApplied: false,
            categorie: "MANUAL",
            role: "MANUAL",
            extractionConfidence: 1,
            isValid: true,
            needsReview: false,
            reviewNotes: null,
            extractionErrors: null,
            lineNumber: targetIndex,
            transactionIndex: targetIndex,
        }
        const merged = sortByIndex([...editableTransactions, localTx])
        setEditableTransactions(merged)
        setNewTransaction({
            ...EMPTY_NEW_TRANSACTION,
            transactionIndex: Math.max(merged.length + 1, 1),
        })
        setShowNewTransactionForm(false)
        toast.success("Transaction prête à être enregistrée")
    }

    const hasChanges = useMemo(() => {
        if (editableTransactions.length !== transactions.length) return true
        const baseline = sortByIndex(transactions)
        const current = sortByIndex(editableTransactions)
        return current.some((tx, idx) => {
            const base = baseline[idx]
            if (!base) return true
            return (
                tx.transactionIndex !== base.transactionIndex ||
                tx.dateOperation !== base.dateOperation ||
                tx.dateValeur !== base.dateValeur ||
                tx.compte !== base.compte ||
                tx.libelle !== base.libelle ||
                tx.debit !== base.debit ||
                tx.credit !== base.credit ||
                Boolean(tx.cmApplied) !== Boolean(base.cmApplied)
            )
        })
    }, [editableTransactions, transactions])

    const handleSaveAll = async () => {
        if (isDuplicateStatement) {
            toast.error("Relevé dupliqué: enregistrement interdit")
            return
        }
        const toPersist = sortByIndex(editableTransactions)
        const baselineById = new Map(transactions.map((tx) => [tx.id, tx]))

        // Propagation locale avant sauvegarde: même libellé -> même code choisi.
        const learnedByLibelle = new Map<string, string>()
        for (const tx of toPersist) {
            const normalized = normalizeLibelle(tx.libelle)
            if (!normalized) continue
            if (isSelectedCompteForTx(tx)) {
                learnedByLibelle.set(normalized, resolveDisplayCompteForTx(tx).trim())
            }
        }

        const effectiveRows = toPersist.map((tx) => {
            if (isSelectedCompteForTx(tx)) return { ...tx, compte: resolveDisplayCompteForTx(tx) }
            const learned = learnedByLibelle.get(normalizeLibelle(tx.libelle))
            if (!learned) return tx
            return { ...tx, compte: learned, isLinked: true }
        })

        const existingRows = effectiveRows.filter((tx) => {
            if (tx.id <= 0) return false
            const base = baselineById.get(tx.id)
            if (!base) return true
            return (
                tx.transactionIndex !== base.transactionIndex ||
                tx.dateOperation !== base.dateOperation ||
                tx.dateValeur !== base.dateValeur ||
                tx.compte !== base.compte ||
                tx.libelle !== base.libelle ||
                Number(tx.debit || 0) !== Number(base.debit || 0) ||
                Number(tx.credit || 0) !== Number(base.credit || 0) ||
                Boolean(tx.cmApplied) !== Boolean(base.cmApplied) ||
                Boolean(tx.isLinked) !== Boolean(base.isLinked) ||
                String(tx.sens || "") !== String(base.sens || "")
            )
        })
        const localRows = effectiveRows.filter((tx) => tx.id <= 0)
        const buildUpdatePayload = (tx: BankTransactionV2, base?: BankTransactionV2): Partial<BankTransactionV2> => {
            const payload: Partial<BankTransactionV2> = {}
            if (!base || tx.transactionIndex !== base.transactionIndex) {
                payload.transactionIndex = tx.transactionIndex ?? 0
            }
            if (!base || tx.dateOperation !== base.dateOperation) {
                payload.dateOperation = tx.dateOperation
            }
            if (!base || tx.dateValeur !== base.dateValeur) {
                payload.dateValeur = tx.dateValeur
            }
            if (!base || tx.compte !== base.compte) {
                payload.compte = isSelectedCompteForTx(tx) ? resolveDisplayCompteForTx(tx) : ""
                payload.isLinked = isSelectedCompteForTx(tx)
            }
            if (!base || tx.libelle !== base.libelle) {
                payload.libelle = tx.libelle
            }
            if (!base || Number(tx.debit || 0) !== Number(base.debit || 0)) {
                payload.debit = Number(tx.debit || 0)
            }
            if (!base || Number(tx.credit || 0) !== Number(base.credit || 0)) {
                payload.credit = Number(tx.credit || 0)
            }
            if (!base || String(tx.sens || "") !== String(base.sens || "")) {
                payload.sens = Number(tx.debit || 0) > 0 ? "DEBIT" : "CREDIT"
            }
            if (!base || Boolean(tx.cmApplied) !== Boolean(base.cmApplied)) {
                payload.cmApplied = Boolean(tx.cmApplied)
            }
            return payload
        }

        setSaving(true)
        try {
            const existingResults = await Promise.allSettled(
                existingRows.map((tx) => api.updateBankTransaction(tx.id, buildUpdatePayload(tx, baselineById.get(tx.id))))
            )
            const localResults = await Promise.allSettled(
                localRows.map((tx) => api.createBankTransaction({
                    statementId: tx.statementId,
                    transactionIndex: tx.transactionIndex ?? 0,
                    dateOperation: tx.dateOperation,
                    dateValeur: tx.dateValeur,
                    libelle: tx.libelle,
                    compte: isSelectedCompteForTx(tx) ? resolveDisplayCompteForTx(tx) : "",
                    categorie: tx.categorie,
                    sens: tx.sens,
                    debit: Number(tx.debit || 0),
                    credit: Number(tx.credit || 0),
                    isLinked: isSelectedCompteForTx(tx),
                    cmApplied: Boolean(tx.cmApplied),
                }))
            )

            const updatedRows = existingResults
                .filter((result): result is PromiseFulfilledResult<BankTransactionV2> => result.status === "fulfilled")
                .map((result) => result.value)
            const createdRows = localResults
                .filter((result): result is PromiseFulfilledResult<BankTransactionV2> => result.status === "fulfilled")
                .map((result) => result.value)
            const failedCount = existingResults.filter((result) => result.status === "rejected").length
                + localResults.filter((result) => result.status === "rejected").length

            if (onUpdateTransaction) {
                updatedRows.forEach(onUpdateTransaction)
                createdRows.forEach(onUpdateTransaction)
            }

            if (localStatement) {
                try {
                    const refreshed = await loadFullData(localStatement.id, true)
                    if (refreshed) {
                        onUpdateStatement?.(refreshed)
                    }
                } catch (reloadError) {
                    console.warn("Reload after save failed, keeping local edits:", reloadError)
                    setTransactions(effectiveRows)
                    setEditableTransactions(effectiveRows)
                    setBaseTransactions(sortByIndex(effectiveRows))
                }
            }
            if (failedCount > 0) {
                console.warn(`Save completed with ${failedCount} failed request(s)`)
            }
            toast.success("Modifications enregistrées")
        } catch (error) {
            console.error("Error saving transactions:", error)
            toast.error("Erreur lors de l'enregistrement")
        } finally {
            setSaving(false)
        }
    }
    const simulateComptabilisation = async () => {
        if (!localStatement) return
        if (isDuplicateStatement) {
            toast.error("Relevé dupliqué: comptabilisation interdite")
            return
        }

        setAccountingLoading(true)
        setAccountingConfirmed(false)
        try {
            const result = await api.simulateComptabilisation(localStatement.id)
            setSimulationResult(result)
            toast.success("Simulation de comptabilisation prête")
        } catch (error) {
            console.error("Error simulation comptabilisation:", error)
            toast.error(error instanceof Error ? error.message : "Erreur lors de la simulation")
            setSimulationResult(null)
        } finally {
            setAccountingLoading(false)
        }
    }

    const confirmComptabilisation = async () => {
        if (!simulationResult?.simulationId || !localStatement) return

        setConfirmLoading(true)

        const optimistic: BankStatementV2 = {
            ...localStatement,
            status: "COMPTABILISE",
            statusCode: "COMPTABILISE",
            accountedAt: new Date().toISOString(),
        }
        setLocalStatement(optimistic)
        onUpdateStatement?.(optimistic)

        try {
            const result = await api.confirmComptabilisation(simulationResult.simulationId)
            setAccountingConfirmed(true)

            const serverPatched: BankStatementV2 = {
                ...optimistic,
                status: result?.statementStatus || "COMPTABILISE",
                statusCode: result?.statementStatus || "COMPTABILISE",
                accountedAt: result?.accountedAt || optimistic.accountedAt,
                accountedBy: result?.accountedBy || optimistic.accountedBy,
            }
            setLocalStatement(serverPatched)
            onUpdateStatement?.(serverPatched)

            void loadFullData(localStatement.id, true)
            toast.success("Comptabilisation confirmée avec succès")
        } catch (error) {
            console.error("Error confirm comptabilisation:", error)
            void loadFullData(localStatement.id, true)
            toast.error(error instanceof Error ? error.message : "Erreur lors de la confirmation")
        } finally {
            setConfirmLoading(false)
        }
    }

    const askConfirmComptabilisation = () => {
        if (isDuplicateStatement) {
            toast.error("Relevé dupliqué: comptabilisation interdite")
            return
        }
        if (!simulationResult?.simulationId || !localStatement) return
        setShowConfirmAccountingDialog(true)
    }

    useEffect(() => {
        if (!showAccountingModal) {
            setSimulationResult(null)
            setAccountingConfirmed(false)
            return
        }
        if (localStatement) {
            void simulateComptabilisation()
        }
    }, [showAccountingModal, localStatement?.id])

    const selectedNewTransactionAccount = accounts.find((account) => account.code === newTransaction.compte) || null
    if (!localStatement) return null
    const isAccounted = isAccountedStatus(localStatement.status)
    const displayStatus = normalizeBankStatus(localStatement.displayStatus || localStatement.statusCode || localStatement.status)
    const isDuplicateStatement = Boolean(localStatement.isDuplicate)
        || displayStatus === "DUPLIQUE"
        || Boolean(localStatement.duplicateOfId)
        || (typeof localStatement.validationErrors === "string" && localStatement.validationErrors.includes("DUPLIQUE_OF"))
    const hasVerificationMismatch = displayStatus === "VERIFY"
        || displayStatus === "READY_TO_VALIDATE"
        || localStatement.verificationStatus === "INCOHERENCE"
        || (balanceRule.backendAvailable && !balanceRule.backendIsValid)
        || otherBankCheck.isValid === false
    const headerStatus = hasVerificationMismatch ? "VERIFY" : displayStatus
    const isPageMode = embedded || renderAsPage

    const handleClose = () => {
        if (isPageMode) {
            if (onBack) {
                onBack()
                return
            }
            router.back()
            return
        }
        onOpenChange?.(false)
    }

    const content = (
        <>
                <DialogHeader className="p-6 pb-2 border-b bg-card z-10">
                    <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClose}
                                className="gap-2 text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Retour
                            </Button>
                            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                {isPageMode ? (
                                    <>
                                        <h1 className="text-xl font-semibold">Détail du Relevé Bancaire</h1>
                                        <p className="text-sm text-muted-foreground">
                                            {localStatement.originalName} • {localStatement.bankName}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <DialogTitle className="text-xl">Détail du Relevé Bancaire</DialogTitle>
                                        <DialogDescription>
                                            {localStatement.originalName} • {localStatement.bankName}
                                        </DialogDescription>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-6 pr-8">
                            <div className="text-right">
                                <span className="text-xs text-muted-foreground uppercase font-semibold block">Statut</span>
                                {getStatusBadge(headerStatus)}
                                {isAccountedStatus(localStatement.status) && localStatement.accountedAt && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {new Date(localStatement.accountedAt).toLocaleString()} {localStatement.accountedBy ? `• ${localStatement.accountedBy}` : ""}
                                    </p>
                                )}
                            </div>
                            <div className="text-right border-l pl-6">
                                <span className="text-xs text-muted-foreground uppercase font-semibold block">Compte</span>
                                <Badge variant={localStatement.isLinked ? "default" : "outline"}
                                    className={cn(
                                        localStatement.isLinked
                                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                            : "text-orange-600 bg-orange-500/10 border-orange-500/60"
                                    )}>
                                    {localStatement.isLinked ? "LIÉ" : "NON LIÉ"}
                                </Badge>
                                {localStatement.status === "ERROR" || localStatement.status === "PARTIAL_SUCCESS" ? (
                                    <div className="flex flex-col gap-1 mt-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRetry}
                                            disabled={loading}
                                            className="h-7 text-[10px] gap-1 px-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                                        >
                                            <Loader2 className={cn("h-3 w-3", loading && "animate-spin")} />
                                            Relancer
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                            <div className="text-right border-l pl-6 space-y-1">
                                <span className="text-xs text-muted-foreground uppercase font-semibold block">Outils</span>
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
                                            <DialogTitle>Inspection du Texte Extrait (OCR)</DialogTitle>
                                            <DialogDescription>
                                                Visualisez le texte brut et nettoyé pour diagnostiquer les erreurs d'extraction.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <Tabs defaultValue="cleaned" className="flex-1 flex flex-col overflow-hidden">
                                            <TabsList className="mb-4">
                                                <TabsTrigger value="cleaned">Texte Nettoyé</TabsTrigger>
                                                <TabsTrigger value="raw">Texte Brut</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="cleaned" className="flex-1 overflow-hidden">
                                                <ScrollArea className="h-[50vh] w-full rounded-md border p-4 bg-muted/20">
                                                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                                                        {localStatement.cleanedOcrText || "Aucun texte nettoyé disponible."}
                                                    </pre>
                                                </ScrollArea>
                                            </TabsContent>
                                            <TabsContent value="raw" className="flex-1 overflow-hidden">
                                                <ScrollArea className="h-[50vh] w-full rounded-md border p-4 bg-muted/20">
                                                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                                                        {localStatement.rawOcrText || "Aucun texte brut disponible."}
                                                    </pre>
                                                </ScrollArea>
                                            </TabsContent>
                                        </Tabs>
                                    </DialogContent>
                                </Dialog>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-[10px] gap-1 px-2 border-primary/20 hover:bg-primary/5"
                                        >
                                            <Code className="h-3 w-3" />
                                            Voir JSON
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-[60vw] sm:max-w-[60vw] w-full max-h-[85vh] flex flex-col p-6">
                                        <DialogHeader>
                                            <DialogTitle>Données JSON du Relevé</DialogTitle>
                                            <DialogDescription>
                                                Visualisez les données brutes du relevé bancaire pour vérifier l'extraction.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <Tabs defaultValue="statement" className="flex-1 flex flex-col overflow-hidden">
                                            <TabsList className="mb-4">
                                                <TabsTrigger value="statement">Relevé</TabsTrigger>
                                                <TabsTrigger value="transactions">Transactions ({editableTransactions.length})</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="statement" className="flex-1 overflow-hidden">
                                                <ScrollArea className="h-[55vh] w-full rounded-md border p-4 bg-muted/20">
                                                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                                                        {JSON.stringify(
                                                            (() => {
                                                                const { rawOcrText, cleanedOcrText, ...rest } = localStatement as any;
                                                                return rest;
                                                            })(),
                                                            null, 2
                                                        )}
                                                    </pre>
                                                </ScrollArea>
                                            </TabsContent>
                                            <TabsContent value="transactions" className="flex-1 overflow-hidden">
                                                <ScrollArea className="h-[55vh] w-full rounded-md border p-4 bg-muted/20">
                                                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                                                        {JSON.stringify(editableTransactions, null, 2)}
                                                    </pre>
                                                </ScrollArea>
                                            </TabsContent>
                                        </Tabs>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="text-right border-l pl-6">
                                <span className="text-xs text-muted-foreground uppercase font-semibold block">Transactions</span>
                                <span className="font-bold text-lg">{editableTransactions.length || 0}</span>
                            </div>
                            <div className="text-right border-l pl-6">
                                <span className="text-xs text-muted-foreground uppercase font-semibold block text-red-500">Débit Total</span>
                                <span className="font-bold text-lg text-red-500">
                                    {localStatement.totalDebit ? `${localStatement.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} DH` : "0.00 DH"}
                                </span>
                            </div>
                            <div className="text-right border-l pl-6">
                                <span className="text-xs text-muted-foreground uppercase font-semibold block text-emerald-500">Crédit Total</span>
                                <span className="font-bold text-lg text-emerald-500">
                                    {localStatement.totalCredit ? `${localStatement.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} DH` : "0.00 DH"}
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
                                <p className="text-sm font-semibold text-red-700">Erreur de Traitement</p>
                                <p className="text-sm">{Array.isArray(localStatement.validationErrors) ? localStatement.validationErrors.join("; ") : localStatement.validationErrors}</p>
                            </div>
                        </div>
                    )}

                    <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-4 py-3 shrink-0">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                            <div className="flex-1 space-y-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-950">{ttcSummary.sourceCount} transaction(s) avec règle TTC / commission</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`ttc-rule-inline-${localStatement.id}`}
                                            checked={Boolean(localStatement.applyTtcRule)}
                                            onCheckedChange={(checked) => handleToggleTtcRule(checked === true)}
                                            disabled={ttcUpdating || isAccounted}
                                        />
                                        <Label
                                            htmlFor={`ttc-rule-inline-${localStatement.id}`}
                                            className="cursor-pointer text-sm font-medium text-amber-900"
                                        >
                                            Appliquer la règle TTC / commission
                                        </Label>
                                        {ttcUpdating ? <Loader2 className="h-4 w-4 animate-spin text-amber-700" /> : null}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 border-t border-amber-300/40 pt-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-950">{fraisSummary.sourceCount} transaction(s) avec règle frais appliquée</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`frais-rule-inline-${localStatement.id}`}
                                            checked={Boolean(localStatement.applyFraisRule)}
                                            onCheckedChange={(checked) => handleToggleFraisRule(checked === true)}
                                            disabled={fraisUpdating || isAccounted}
                                        />
                                        <Label
                                            htmlFor={`frais-rule-inline-${localStatement.id}`}
                                            className="cursor-pointer text-sm font-medium text-amber-900"
                                        >
                                            Appliquer la règle frais
                                        </Label>
                                        {fraisUpdating ? <Loader2 className="h-4 w-4 animate-spin text-amber-700" /> : null}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 border-t border-amber-300/40 pt-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-950">{agiosSummary.sourceCount} transaction(s) avec règle agios appliquée</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`agios-rule-inline-${localStatement.id}`}
                                            checked={Boolean(localStatement.applyAgiosRule)}
                                            onCheckedChange={(checked) => handleToggleAgiosRule(checked === true)}
                                            disabled={agiosUpdating || isAccounted}
                                        />
                                        <Label
                                            htmlFor={`agios-rule-inline-${localStatement.id}`}
                                            className="cursor-pointer text-sm font-medium text-amber-900"
                                        >
                                            Appliquer la règle agios
                                        </Label>
                                        {agiosUpdating ? <Loader2 className="h-4 w-4 animate-spin text-amber-700" /> : null}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 border-t border-amber-300/40 pt-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-950">{packageSummary.sourceCount} transaction(s) avec règle package appliquée</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`package-rule-inline-${localStatement.id}`}
                                            checked={Boolean(localStatement.applyPackageRule)}
                                            onCheckedChange={(checked) => handleTogglePackageRule(checked === true)}
                                            disabled={packageUpdating || isAccounted}
                                        />
                                        <Label
                                            htmlFor={`package-rule-inline-${localStatement.id}`}
                                            className="cursor-pointer text-sm font-medium text-amber-900"
                                        >
                                            Appliquer la règle package
                                        </Label>
                                        {packageUpdating ? <Loader2 className="h-4 w-4 animate-spin text-amber-700" /> : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Contrôle du solde : formule solde initial + crédit - débit = solde final ── */}
                    {/* Affiché pour toute banque ayant un solde initial ou final extrait (BCP, Attijariwafa, etc.) */}
                    {showBalanceFormula && (
                        <div className={cn(
                            "rounded-xl border shadow-sm p-4 shrink-0",
                            balanceRule.isValid ? "border-emerald-200 bg-emerald-50/70" : "border-red-200 bg-red-50/70"
                        )}>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Calculator className={cn("h-4 w-4", balanceRule.isValid ? "text-emerald-700" : "text-red-700")} />
                                        <p className={cn("text-sm font-semibold", balanceRule.isValid ? "text-emerald-900" : "text-red-900")}>
                                            Contrôle du solde bancaire
                                        </p>
                                        <Badge className={cn(
                                            balanceRule.isValid
                                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                : "bg-red-100 text-red-800 border-red-200"
                                        )}>
                                            {balanceRule.isValid ? "Règle respectée" : "Règle non respectée"}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {localStatement?.bankName || "Banque"} : <span className="font-medium text-foreground">solde initial + crédit - débit = solde final</span>
                                    </p>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2 font-mono text-sm text-slate-800">
                                        {formatMoney(balanceRule.openingBalance)} + {formatMoney(balanceRule.totalCredit)} - {formatMoney(balanceRule.totalDebit)} = {formatMoney(balanceRule.calculatedClosingBalance)}
                                    </div>
                                    {balanceRule.backendAvailable ? (
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="text-muted-foreground">Verdict backend :</span>
                                            <Badge className={cn(
                                                balanceRule.backendIsValid
                                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                    : "bg-red-100 text-red-800 border-red-200"
                                            )}>
                                                {balanceRule.backendIsValid ? "Cohérent" : "Incohérent"}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                                Écart backend : <span className="font-semibold text-foreground">{formatMoney(balanceRule.backendDifference)}</span>
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 min-w-0">
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-muted-foreground">Solde initial</div>
                                        <div className="text-sm font-bold text-slate-900">{formatMoney(balanceRule.openingBalance)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-emerald-700">Total crédit</div>
                                        <div className="text-sm font-bold text-emerald-700">{formatMoney(balanceRule.totalCredit)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-red-700">Total débit</div>
                                        <div className="text-sm font-bold text-red-700">{formatMoney(balanceRule.totalDebit)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-muted-foreground">Solde final attendu</div>
                                        <div className="text-sm font-bold text-slate-900">{formatMoney(balanceRule.expectedClosingBalance)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-muted-foreground">Écart</div>
                                        <div className={cn("text-sm font-bold", balanceRule.isValid ? "text-emerald-700" : "text-red-700")}>
                                            {formatMoney(balanceRule.difference)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Contrôle des totaux PDF (toutes banques) — affiché si totalDebitPdf/totalCreditPdf disponibles ── */}
                    {otherBankCheck.hasPdfTotals && (
                        <div className={cn(
                            "rounded-xl border shadow-sm p-4 shrink-0",
                            otherBankCheck.isValid === true  ? "border-emerald-200 bg-emerald-50/70" :
                            otherBankCheck.isValid === false ? "border-red-200 bg-red-50/70" :
                                                               "border-border bg-muted/30"
                        )}>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Calculator className={cn(
                                            "h-4 w-4",
                                            otherBankCheck.isValid === true  ? "text-emerald-700" :
                                            otherBankCheck.isValid === false ? "text-red-700" : "text-muted-foreground"
                                        )} />
                                        <p className="text-sm font-semibold text-foreground">Contrôle des totaux PDF</p>
                                        <Badge className={cn(
                                            otherBankCheck.isValid
                                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                : "bg-red-100 text-red-800 border-red-200"
                                        )}>
                                            {otherBankCheck.isValid ? "Totaux cohérents" : "Écart détecté"}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Total calculé (transactions) vs total extrait du PDF
                                    </p>
                                    <div className="flex flex-col gap-1 rounded-lg border bg-white/80 px-3 py-2 font-mono text-sm text-slate-800">
                                        <span>Débit calculé : {formatMoney(otherBankCheck.debitCalcule)} — PDF : {formatMoney(otherBankCheck.debitPdf)}</span>
                                        <span>Crédit calculé : {formatMoney(otherBankCheck.creditCalcule)} — PDF : {formatMoney(otherBankCheck.creditPdf)}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 min-w-0">
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-red-700">Débit calculé</div>
                                        <div className="text-sm font-bold text-red-700">{formatMoney(otherBankCheck.debitCalcule)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-red-400">Débit PDF</div>
                                        <div className="text-sm font-bold text-red-400">{formatMoney(otherBankCheck.debitPdf)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-emerald-700">Crédit calculé</div>
                                        <div className="text-sm font-bold text-emerald-700">{formatMoney(otherBankCheck.creditCalcule)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-emerald-400">Crédit PDF</div>
                                        <div className="text-sm font-bold text-emerald-400">{formatMoney(otherBankCheck.creditPdf)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-muted-foreground">Écart débit</div>
                                        <div className={cn("text-sm font-bold", otherBankCheck.ecartDebit! < 0.01 ? "text-emerald-700" : "text-red-700")}>
                                            {formatMoney(otherBankCheck.ecartDebit!)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border bg-white/80 px-3 py-2">
                                        <div className="text-[11px] uppercase font-semibold text-muted-foreground">Écart crédit</div>
                                        <div className={cn("text-sm font-bold", otherBankCheck.ecartCredit! < 0.01 ? "text-emerald-700" : "text-red-700")}>
                                            {formatMoney(otherBankCheck.ecartCredit!)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isAccounted && !isClientValidated && (
                        <div className="rounded-md border bg-card shadow-sm p-4 shrink-0">
                            {!showNewTransactionForm ? (
                                <div className="flex justify-end">
                                    <Button className="gap-2" onClick={() => setShowNewTransactionForm(true)}>
                                        <Plus className="h-4 w-4" />
                                        Ajouter transaction
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
                                        <div className="space-y-1">
                                            <Label>N° Transaction</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={newTransaction.transactionIndex}
                                                onChange={(e) => setNewTransaction((prev) => ({ ...prev, transactionIndex: Number(e.target.value || 1) }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Date Opération</Label>
                                            <Input
                                                type="date"
                                                value={newTransaction.dateOperation}
                                                onChange={(e) => setNewTransaction((prev) => ({ ...prev, dateOperation: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Date Valeur</Label>
                                            <Input
                                                type="date"
                                                value={newTransaction.dateValeur}
                                                onChange={(e) => setNewTransaction((prev) => ({ ...prev, dateValeur: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Compte</Label>
                                            <Popover open={openNewComptePopover} onOpenChange={setOpenNewComptePopover}>
                                                <PopoverTrigger asChild>
                                                    <div
                                                        className="min-h-10 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                                                        role="button"
                                                        tabIndex={0}
                                                    >
                                                        <div className="font-mono">
                                                            {newTransaction.compte || "Choisir un compte"}
                                                        </div>
                                                        {selectedNewTransactionAccount ? (
                                                            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                                                {selectedNewTransactionAccount.libelle}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[320px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Chercher un compte..." />
                                                        <CommandList className="max-h-[260px] overflow-y-auto">
                                                            <CommandEmpty>Aucun compte trouvé.</CommandEmpty>
                                                            <CommandGroup>
                                                                {loadingAccounts ? (
                                                                    <div className="flex items-center justify-center p-4">
                                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                        Chargement...
                                                                    </div>
                                                                ) : accounts.map((account) => (
                                                                    <CommandItem
                                                                        key={account.id}
                                                                        value={`${account.code} ${account.libelle}`}
                                                                        onSelect={() => {
                                                                            setNewTransaction((prev) => ({ ...prev, compte: account.code }))
                                                                            setOpenNewComptePopover(false)
                                                                        }}
                                                                        className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                                                    >
                                                                        <div className="flex items-center w-full justify-between">
                                                                            <span className="font-medium text-sm">{account.libelle}</span>
                                                                            {newTransaction.compte === account.code ? (
                                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                            ) : null}
                                                                        </div>
                                                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                                                            {account.code}
                                                                        </span>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label>Libellé</Label>
                                            <Input
                                                value={newTransaction.libelle}
                                                onChange={(e) => setNewTransaction((prev) => ({ ...prev, libelle: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Débit</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={newTransaction.debit}
                                                onChange={(e) => setNewTransaction((prev) => ({ ...prev, debit: Number(e.target.value || 0) }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Crédit</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={newTransaction.credit}
                                                onChange={(e) => setNewTransaction((prev) => ({ ...prev, credit: Number(e.target.value || 0) }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setShowNewTransactionForm(false)}>
                                            Annuler
                                        </Button>
                                        <Button className="gap-2" onClick={handleAddTransaction}>
                                            <Plus className="h-4 w-4" />
                                            Ajouter transaction
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="relative rounded-md border bg-card shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
                            {(isValidatedStatus(localStatement.status) || isAccountedStatus(localStatement.status)) && (
                                <div className="pointer-events-none absolute inset-x-0 top-14 bottom-0 z-20 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-8">
                                        {isValidatedStatus(localStatement.status) && (
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
                                        {isAccountedStatus(localStatement.status) && (
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
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <div className="px-4 py-3 border-b bg-muted/30 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium">Liaisons Centre Monétique:</span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                                        Liées (coché) {cmSummary.appliedCount}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-800">
                                        Liées (décoché) {cmSummary.skippedCount}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-white/60 px-2 py-0.5 text-muted-foreground">
                                        Total liaisons {cmSummary.linkedCount}
                                    </span>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="w-[100px] text-center">Transaction</TableHead>
                                            <TableHead className="w-[150px]">Date Opération</TableHead>
                                            <TableHead className="w-[150px]">Date Valeur</TableHead>
                                            <TableHead className="w-[160px]">Compte</TableHead>
                                            <TableHead className="min-w-[280px]">Libellé</TableHead>
                                            <TableHead className="text-right w-[130px]">Débit</TableHead>
                                            <TableHead className="text-right w-[130px]">Crédit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortByIndex(editableTransactions).map((tx, idx) => {
                                            const cmExp = cmExpansions[tx.id]
                                            const isExpanded = cmExp != null && !collapsedCmTxIds.has(tx.id) && isCmAppliedForTx(tx)
                                            const isCmLinked = cmExp != null
                                            const isCmApplied = isCmAppliedForTx(tx)

                                            // ---- Lignes CM de remplacement ----
                                            if (isExpanded) {
                                                const cmDisplayCompte = resolveDisplayCompteForTx(tx)
                                                const cmCompteIsDefault = isDefaultCompte(cmDisplayCompte)
                                                const cmHasCompteLibelle = (tx.compteLibelle || "").trim() !== ""
                                                return (
                                                    <React.Fragment key={`cm-group-${tx.id}`}>
                                                        {/* Ligne d'en-tête du groupe CM */}
                                                        <TableRow key={`cm-header-${tx.id}`} className="bg-emerald-50 border-l-4 border-emerald-400 hover:bg-emerald-100/60">
                                                            <TableCell className="text-center">
                                                                <Checkbox
                                                                    checked={true}
                                                                    onCheckedChange={() => {
                                                                        void persistCmAppliedChange(tx.id, false)
                                                                        setCollapsedCmTxIds((prev) => {
                                                                            const next = new Set(prev)
                                                                            next.add(tx.id)
                                                                            return next
                                                                        })
                                                                    }}
                                                                    className="border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                                    title="Décocher pour revenir à la ligne originale"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-xs font-semibold text-emerald-800" colSpan={2}>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span>{cmExp.cmBatchOriginalName}</span>
                                                                    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                                                        {formatCmStructureLabel(cmExp.cmBatchStructure)}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs font-mono font-semibold text-emerald-700">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span>{cmExp.cmReference}</span>
                                                                    <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                                                                        {formatCmStructureLabel(cmExp.cmBatchStructure)}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs font-semibold text-emerald-800">
                                                                Solde net remise
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs font-semibold text-red-500 bg-red-50/30" />
                                                            <TableCell className="text-right text-xs font-semibold text-emerald-700 bg-emerald-50/50">
                                                                {cmExp.cmMontant}
                                                            </TableCell>
                                                        </TableRow>
                                                        {/* Lignes de détail CM — même design que les lignes originales */}
                                                        {cmExp.lines.map((line, li) => (
                                                            <TableRow key={`cm-line-${tx.id}-${li}`} className="bg-emerald-50/40 border-l-4 border-emerald-300 hover:bg-emerald-50/80">
                                                                <TableCell className="text-center">
                                                                    <Badge variant="secondary" className="font-normal text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                                        {li + 1}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm">{line.date}</TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                                                <TableCell>
                                                                    <div className={cn(
                                                                        "inline-flex min-w-[145px] max-w-[250px] flex-col rounded-md border px-3 py-1.5 text-sm font-medium",
                                                                        cmCompteIsDefault
                                                                            ? "border-orange-500 bg-orange-100 text-orange-900"
                                                                            : tx.isLinked
                                                                                ? "border-orange-500 bg-transparent text-foreground"
                                                                                : isSelectedCompteForTx(tx)
                                                                                    ? "border-orange-500 bg-orange-100 text-orange-900"
                                                                                    : "border-transparent text-muted-foreground"
                                                                    )}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={cn(
                                                                                "h-6 w-6 rounded flex items-center justify-center",
                                                                                cmCompteIsDefault ? "bg-white text-orange-700"
                                                                                    : tx.isLinked ? "bg-orange-100 text-orange-700"
                                                                                    : isSelectedCompteForTx(tx) ? "bg-white text-orange-700"
                                                                                    : "bg-muted text-muted-foreground"
                                                                            )}>
                                                                                <LinkIcon className="h-3.5 w-3.5" />
                                                                            </div>
                                                                            <span className="font-mono text-[13px]">{cmDisplayCompte}</span>
                                                                        </div>
                                                                        {cmHasCompteLibelle && (
                                                                            <span className={cn("mt-0.5 text-[10px] leading-tight", cmCompteIsDefault ? "text-orange-900/90" : "text-muted-foreground")}>
                                                                                {tx.compteLibelle}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm font-medium">{line.stan}</TableCell>
                                                                <TableCell className="text-right font-medium text-red-600 bg-red-50/30">
                                                                    {line.dcFlag === "D" ? line.montant : ""}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium text-emerald-600 bg-emerald-50/30">
                                                                    {line.dcFlag !== "D" ? line.montant : ""}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {/* Ligne Submission Amount — montant brut AMEX avant commission */}
                                                        {cmExp.cmSubmissionAmount && cmExp.cmSubmissionAmount !== "" && (
                                                            <TableRow key={`cm-sub-${tx.id}`} className="bg-emerald-50/40 border-l-4 border-emerald-300 hover:bg-emerald-50/80">
                                                                <TableCell className="text-center">
                                                                    <Badge variant="secondary" className="font-normal text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">S</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                                                <TableCell>
                                                                    <div className="inline-flex min-w-[145px] flex-col rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-6 w-6 rounded flex items-center justify-center bg-muted text-muted-foreground">
                                                                                <Calculator className="h-3.5 w-3.5" />
                                                                            </div>
                                                                            <span className="font-mono text-[13px]">Total</span>
                                                                        </div>
                                                                        <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Submission Amount</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm font-semibold text-emerald-800">TOTAL SUBMISSION AMEX</TableCell>
                                                                <TableCell className="bg-red-50/30" />
                                                                <TableCell className="text-right font-semibold text-emerald-700 bg-emerald-50/30">{cmExp.cmSubmissionAmount}</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {/* Ligne Commission HT — compte 614700000 en DÉBIT */}
                                                        {cmExp.commissionHt && cmExp.commissionHt !== "" && (
                                                            <TableRow key={`cm-comm-${tx.id}`} className="bg-emerald-50/40 border-l-4 border-emerald-300 hover:bg-emerald-50/80">
                                                                <TableCell className="text-center">
                                                                    <Badge variant="secondary" className="font-normal text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">C</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                                                <TableCell>
                                                                    <div className="inline-flex min-w-[145px] flex-col rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-6 w-6 rounded flex items-center justify-center bg-muted text-muted-foreground">
                                                                                <LinkIcon className="h-3.5 w-3.5" />
                                                                            </div>
                                                                            <span className="font-mono text-[13px]">614700000</span>
                                                                        </div>
                                                                        <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Commission HT</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">TOTAL COMMISSIONS HT</TableCell>
                                                                <TableCell className="text-right font-medium text-red-600 bg-red-50/30">{cmExp.commissionHt}</TableCell>
                                                                <TableCell className="bg-emerald-50/30" />
                                                            </TableRow>
                                                        )}
                                                        {/* Ligne TVA — compte 345520100 en DÉBIT */}
                                                        {cmExp.tvaSurCommissions && cmExp.tvaSurCommissions !== "" && (
                                                            <TableRow key={`cm-tva-${tx.id}`} className="bg-emerald-50/40 border-l-4 border-emerald-300 hover:bg-emerald-50/80">
                                                                <TableCell className="text-center">
                                                                    <Badge variant="secondary" className="font-normal text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">T</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                                                <TableCell>
                                                                    <div className="inline-flex min-w-[145px] flex-col rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-6 w-6 rounded flex items-center justify-center bg-muted text-muted-foreground">
                                                                                <LinkIcon className="h-3.5 w-3.5" />
                                                                            </div>
                                                                            <span className="font-mono text-[13px]">345520100</span>
                                                                        </div>
                                                                        <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">TVA sur commissions</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">TOTAL TVA SUR COMMISSIONS</TableCell>
                                                                <TableCell className="text-right font-medium text-red-600 bg-red-50/30">{cmExp.tvaSurCommissions}</TableCell>
                                                                <TableCell className="bg-emerald-50/30" />
                                                            </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            }

                                            // ---- Ligne bancaire originale ----
                                            const displayCompte = resolveDisplayCompteForTx(tx)
                                            const hasCompteLibelle = (tx.compteLibelle || "").trim() !== ""
                                            const compteIsDefault = isDefaultCompte(displayCompte)
                                            const isCommissionLine = isCommissionVisualLine(tx.libelle)
                                            const isFraisLine = Boolean(tx.fraisRuleApplied)
                                            return (
                                            <TableRow
                                                key={tx.id}
                                                className={cn(
                                                    isCmLinked && isCmApplied
                                                        ? "bg-emerald-50/70 hover:bg-emerald-100/70"
                                                        : isCmLinked
                                                            ? "bg-blue-50/70 hover:bg-blue-100/70"
                                                            : isFraisLine
                                                                ? "bg-amber-50/70 hover:bg-amber-100/70"
                                                            : isCommissionLine
                                                                ? "bg-orange-50/70 hover:bg-orange-100/70"
                                                                : (idx % 2 === 0 ? "bg-white hover:bg-muted/20" : "bg-muted/30 hover:bg-muted/40")
                                                )}
                                            >
                                            <TableCell className="text-center">
                                                {isEditingCell(tx.id, "transactionIndex") ? (
                                                    renderEditableCell(tx, "transactionIndex", { type: "number" })
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn("font-normal text-xs bg-muted text-muted-foreground", !isAccounted && !isClientValidated && "cursor-pointer")}
                                                            onClick={() => {
                                                                if (!isAccounted && !isClientValidated) setEditingCell({ id: tx.id, field: "transactionIndex" })
                                                            }}
                                                        >
                                                            {tx.transactionIndex || tx.id}
                                                        </Badge>
                                                        {cmExp != null && (
                                                            <div className="flex items-center gap-1">
                                                                <Checkbox
                                                                    checked={isCmApplied}
                                                                    onCheckedChange={(checked) => {
                                                                        const nextApplied = checked === true
                                                                        void persistCmAppliedChange(tx.id, nextApplied)
                                                                        if (nextApplied) {
                                                                            setCollapsedCmTxIds((prev) => {
                                                                                const next = new Set(prev)
                                                                                next.delete(tx.id)
                                                                                return next
                                                                            })
                                                                        }
                                                                    }}
                                                                    className="border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                                    title="Cocher pour appliquer la liaison"
                                                                />
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn(
                                                                        "h-6 px-2 text-[10px] font-semibold uppercase",
                                                                        cmExp.cmBatchStructure === "AMEX"
                                                                            ? "border-sky-300 text-sky-700 bg-sky-50"
                                                                            : cmExp.cmBatchStructure === "BARID_BANK"
                                                                                ? "border-amber-300 text-amber-700 bg-amber-50"
                                                                                : cmExp.cmBatchStructure === "VPS"
                                                                                    ? "border-violet-300 text-violet-700 bg-violet-50"
                                                                                    : "border-emerald-300 text-emerald-700 bg-emerald-50"
                                                                    )}
                                                                    title={cmExp.cmBatchOriginalName}
                                                                >
                                                                    {formatCmStructureLabel(cmExp.cmBatchStructure)}
                                                                </Badge>
                                                                <button
                                                                    type="button"
                                                                    className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                                    onClick={() => setCollapsedCmTxIds((prev) => {
                                                                        const next = new Set(prev)
                                                                        if (next.has(tx.id)) {
                                                                            next.delete(tx.id)
                                                                        } else {
                                                                            next.add(tx.id)
                                                                        }
                                                                        return next
                                                                    })}
                                                                    title="Afficher/Masquer les détails"
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {renderEditableCell(tx, "dateOperation", { type: "date", emptyLabel: "Cliquer pour date" })}
                                            </TableCell>
                                            <TableCell>
                                                {renderEditableCell(tx, "dateValeur", { type: "date", emptyLabel: "Cliquer pour date" })}
                                            </TableCell>
                                            <TableCell>
                                                {isEditingCell(tx.id, "compte") ? (
                                                    renderEditableCell(tx, "compte", { className: "font-mono", emptyLabel: DEFAULT_COMPTE_CODE })
                                                ) : (
                                                    <Popover
                                                        open={!isAccounted && !isClientValidated && openComptePopoverTxId === tx.id}
                                                        onOpenChange={(nextOpen) => {
                                                            if (isAccounted || isClientValidated) return
                                                            setOpenComptePopoverTxId(nextOpen ? tx.id : null)
                                                        }}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <div
                                                                className={cn(
                                                                    "group inline-flex min-w-[145px] max-w-[250px] flex-col rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                                                                    !isAccounted && !isClientValidated && "cursor-pointer",
                                                                    compteIsDefault
                                                                        ? "border-orange-500 bg-orange-100 text-orange-900 hover:bg-orange-200"
                                                                        : tx.isLinked
                                                                            ? "border-orange-500 bg-transparent text-foreground hover:bg-orange-50/50"
                                                                            : isSelectedCompteForTx(tx)
                                                                                ? "border-orange-500 bg-orange-100 text-orange-900 hover:bg-orange-200"
                                                                                : "border-transparent hover:bg-muted text-muted-foreground"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn(
                                                                        "h-6 w-6 rounded flex items-center justify-center transition-colors",
                                                                        compteIsDefault
                                                                            ? "bg-white text-orange-700"
                                                                            : tx.isLinked
                                                                                ? "bg-orange-100 text-orange-700"
                                                                                : isSelectedCompteForTx(tx)
                                                                                    ? "bg-white text-orange-700"
                                                                                    : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20"
                                                                    )}>
                                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                                    </div>
                                                                    <span className={cn("font-mono", compteIsDefault ? "font-semibold text-[13px]" : "text-[13px]")}>
                                                                        {displayCompte}
                                                                    </span>
                                                                </div>
                                                                {hasCompteLibelle ? (
                                                                    <span className={cn("mt-0.5 text-[10px] leading-tight", compteIsDefault ? "text-orange-900/90" : "text-muted-foreground")}>
                                                                        {tx.compteLibelle}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] p-0" align="start">
                                                            <Command>
                                                                <CommandInput placeholder="Chercher un compte..." />
                                                                <CommandList className="max-h-[260px] overflow-y-auto overscroll-contain touch-pan-y">
                                                                    <CommandEmpty>Aucun compte trouvé.</CommandEmpty>
                                                                    <CommandGroup className="pr-1">
                                                                        {loadingAccounts ? (
                                                                            <div className="flex items-center justify-center p-4">
                                                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                                Chargement...
                                                                            </div>
                                                                        ) : accounts.map((account) => {
                                                                            return (
                                                                                <CommandItem
                                                                                    key={account.id}
                                                                                    value={`${account.code} ${account.libelle}`}
                                                                                    onSelect={() => {
                                                                                        const targetLibelle = normalizeLibelle(tx.libelle)
                                                                                        setEditableTransactions((prev) =>
                                                                                            prev.map((row) =>
                                                                                                row.id === tx.id || (
                                                                                                    targetLibelle !== "" &&
                                                                                                    normalizeLibelle(row.libelle) === targetLibelle &&
                                                                                                    !isSelectedCompteForTx(row)
                                                                                                )
                                                                                                    ? { ...row, compte: account.code, compteLibelle: account.libelle, isLinked: true }
                                                                                                    : row
                                                                                            )
                                                                                        )
                                                                                        setOpenComptePopoverTxId(null)
            setOpenNewComptePopover(false)
                                                                                    }}
                                                                                    className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                                                                >
                                                                                    <div className="flex items-center w-full justify-between">
                                                                                        <span className="font-medium text-sm">{account.libelle}</span>
                                                                                        {tx.compte === account.code && (
                                                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                                                                        {account.code}
                                                                                    </span>
                                                                                </CommandItem>
                                                                            )
                                                                        })}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {renderEditableCell(tx, "libelle", { className: "max-w-[400px] truncate", emptyLabel: "Cliquer pour libellé" })}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-red-600 bg-red-50/30">
                                                {renderEditableCell(tx, "debit", { type: "number", step: "0.01", className: "text-right", emptyLabel: "0" })}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-emerald-600 bg-emerald-50/30">
                                                {renderEditableCell(tx, "credit", { type: "number", step: "0.01", className: "text-right", emptyLabel: "0" })}
                                            </TableCell>
                                            </TableRow>
                                        )})}
                                        {editableTransactions.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
                            Les comptes marqués en <span className="font-medium text-orange-600">orange</span> sont liés au plan comptable. Cliquez sur l'icône pour modifier l'imputation.
                        </p>
                    </div>
                    {isDuplicateStatement ? (
                        <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/30 animate-pulse">
                            Doublon détecté, actions bloquées
                        </Badge>
                    ) : null}
                    {!isAccounted && (
                        <div className="flex items-center gap-2">
                            {!isClientUser && (
                                <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowAccountingModal(true)} disabled={saving || accountingLoading || confirmLoading || isDuplicateStatement}>
                                    <Calculator className="h-4 w-4" />
                                    Comptabiliser
                                </Button>
                            )}
                            {(!isClientUser || !isClientValidated) && (
                                <Button size="sm" className="gap-2" onClick={handleSaveAll} disabled={!hasChanges || saving || isDuplicateStatement}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Enregistrer
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            <Dialog open={showAccountingModal} onOpenChange={setShowAccountingModal}>
                <DialogContent className="max-w-[95vw] sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Simulation de Comptabilisation</DialogTitle>
                        <DialogDescription>
                            Chaque transaction du relevé est transformée automatiquement en 2 ou 4 écritures comptables.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {(accountingLoading || confirmLoading) ? (
                            <div className="rounded-md border bg-muted/30 p-4 flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {accountingLoading ? "Simulation en cours..." : "Confirmation en cours..."}
                            </div>
                        ) : null}

                        {simulationResult?.entries?.length ? (
                            <div className="rounded-md border overflow-hidden">
                                <div className="max-h-[55vh] overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/40">
                                                <TableHead>Numero</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Journal</TableHead>
                                                <TableHead>N° Compte</TableHead>
                                                <TableHead>Libellé</TableHead>
                                                <TableHead className="text-right">Débit</TableHead>
                                                <TableHead className="text-right">Crédit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(() => {
                                                const groupIndexByNumero = new Map<number, number>()
                                                let groupIndex = 0
                                                return simulationResult.entries.map((row: any, index: number) => {
                                                    const numero = Number(row.numero)
                                                    if (!groupIndexByNumero.has(numero)) {
                                                        groupIndexByNumero.set(numero, groupIndex)
                                                        groupIndex += 1
                                                    }
                                                    const tone = (groupIndexByNumero.get(numero) ?? 0) % 2
                                                    return (
                                                        <TableRow key={`${row.numero}-${index}`} className={tone === 1 ? "bg-muted/50" : ""}>
                                                    <TableCell className="font-mono text-xs">{row.numero}</TableCell>
                                                    <TableCell>{formatSimulationDate(row.dateOperation, localStatement)}</TableCell>
                                                    <TableCell>{row.journal}</TableCell>
                                                    <TableCell className="font-mono">{row.ncompte}</TableCell>
                                                    <TableCell className="max-w-[280px] truncate" title={row.libelle}>{row.libelle || "-"}</TableCell>
                                                    <TableCell className="text-right text-red-600">{Number(row.debit || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="text-right text-emerald-600">{Number(row.credit || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                        </TableRow>
                                                    )
                                                })
                                            })()}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            !accountingLoading && (
                                <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                                    Aucune écriture simulée pour ce relevé.
                                </div>
                            )
                        )}
                    </div>

                    <div className="mt-2 flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowAccountingModal(false)}
                            disabled={accountingLoading || confirmLoading}
                        >
                            Fermer
                        </Button>
                        <Button
                            onClick={askConfirmComptabilisation}
                            disabled={
                                accountingLoading ||
                                confirmLoading ||
                                accountingConfirmed ||
                                !simulationResult?.simulationId ||
                                !(simulationResult?.entries?.length > 0)
                            }
                        >
                            {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                            {accountingConfirmed ? "Comptabilisé" : "Confirmer Comptabilisation"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showConfirmAccountingDialog} onOpenChange={setShowConfirmAccountingDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmation de comptabilisation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Etes-vous sur de vouloir confirmer cette comptabilisation ?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={confirmLoading}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={confirmLoading}
                            onClick={(e) => {
                                e.preventDefault()
                                setShowConfirmAccountingDialog(false)
                                void confirmComptabilisation()
                            }}
                        >
                            Oui, je confirme
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )

    if (isPageMode) {
        return (
            <div className="min-h-screen bg-muted/20">
                <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
                        {content}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => onOpenChange?.(nextOpen)}>
            <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-full h-[90vh] min-h-0 flex flex-col p-0 gap-0 overflow-hidden">
                    {content}
            </DialogContent>
        </Dialog>
    )
}
