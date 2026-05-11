"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2,
  RefreshCw,
  Upload,
  CloudUpload,
  Building2,
  FileText,
  Trash2,
  RotateCcw,
  AlertCircle,
  Eye,
  MoreHorizontal,
  Plus,
  Save,
  Pencil,
  X,
  Link2,
  CheckCircle2,
  CreditCard,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

import { api as bankingApi } from "@/lib/api"
import * as centreApi from "@/centre-monetique/api"
import * as liaisonApi from "@/liaison-rlv_b-ctr_mntq/api"
import { Account } from "@/lib/types"
import {
  CentreMonetiqueBatchDetail,
  CentreMonetiqueBatchSummary,
  CentreMonetiqueExtractionRow,
} from "@/centre-monetique/types"
import { RapprochementResult } from "@/liaison-rlv_b-ctr_mntq/types"

export default function CentreMonetiquePage() {
  const { user } = useAuth()
  const isClient = user?.role === "CLIENT"

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const [files, setFiles] = useState<File[]>([])

  const [batches, setBatches] = useState<CentreMonetiqueBatchSummary[]>([])
  const [selected, setSelected] = useState<CentreMonetiqueBatchDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [ocrOpen, setOcrOpen] = useState(false)

  const [statusFilter, setStatusFilter] = useState<"all" | "processed" | "error" | "processing">("all")
  const [rowsPerPage, setRowsPerPage] = useState("50")
  const [page, setPage] = useState(1)
  const [modalRowsPerPage, setModalRowsPerPage] = useState("50")
  const [modalGlobalRowsPerPage, setModalGlobalRowsPerPage] = useState("50")
  const [modalPage, setModalPage] = useState(1)
  const [selectedStructure, setSelectedStructure] = useState<"AUTO" | "CMI" | "BARID_BANK" | "AMEX" | "VPS">("AUTO")
  const [accountOptions, setAccountOptions] = useState<Account[]>([])
  const [baridAccountSelections, setBaridAccountSelections] = useState<Record<string, string>>({})
  const [editableRows, setEditableRows] = useState<CentreMonetiqueExtractionRow[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [savingRows, setSavingRows] = useState(false)
  const [deleteBatchId, setDeleteBatchId] = useState<number | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)

  // RIB saisi lors de l'upload
  const [uploadRib, setUploadRib] = useState("")
  // RIB en cours d'édition pour un batch existant
  const [editRibBatchId, setEditRibBatchId] = useState<number | null>(null)
  const [editRibValue, setEditRibValue] = useState("")
  const [savingRib, setSavingRib] = useState(false)
  // Rapprochement
  const [rapprochementLoading, setRapprochementLoading] = useState(false)
  const [rapprochementResult, setRapprochementResult] = useState<RapprochementResult | null>(null)
  const [rapprochementOpen, setRapprochementOpen] = useState(false)

  const acceptedExtensions = ".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.xlsx,.xls"

  const loadHistory = async () => {
    try {
      const data = await centreApi.getCentreMonetiqueBatches(100)
      setBatches(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      toast.error("Impossible de charger l'historique Centre Monétique")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, rowsPerPage])

  useEffect(() => {
    setModalPage(1)
  }, [modalRowsPerPage, selected?.id])

  useEffect(() => {
    setModalRowsPerPage(modalGlobalRowsPerPage)
  }, [modalGlobalRowsPerPage])

  useEffect(() => {
    if (!detailOpen || selected?.structure !== "BARID_BANK") return
    bankingApi.getAccounts(true)
      .then((accounts) => {
        const filtered = (accounts || []).filter((a) => /^\d{9}$/.test((a.code || "").trim()))
        setAccountOptions(filtered)
      })
      .catch(() => setAccountOptions([]))
  }, [detailOpen, selected?.id, selected?.structure])

  useEffect(() => {
    setBaridAccountSelections({})
  }, [selected?.id])

  useEffect(() => {
    setEditableRows(selected?.rows ? selected.rows.map((r) => ({ ...r })) : [])
    setIsEditing(false)
  }, [selected?.id])

  useEffect(() => {
    if (selected?.structure !== "BARID_BANK") return
    const nextSelections: Record<string, string> = {}
    editableRows.forEach((row) => {
      if ((row.section || "").trim() !== "REGLEMENT META") return
      const match = (row.credit || "").match(/REGLEMENT\s+([A-Z0-9]+)/i)
      if (!match) return
      const reglement = match[1]
      const accountCode = (row.reference || "").trim()
      if (reglement && accountCode) {
        nextSelections[reglement] = accountCode
      }
    })
    setBaridAccountSelections((prev) => ({ ...nextSelections, ...prev }))
  }, [editableRows, selected?.structure])

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const status = (batch.status || "").toUpperCase()
      if (statusFilter === "processed") return status === "PROCESSED"
      if (statusFilter === "error") return status === "ERROR"
      if (statusFilter === "processing") return status === "PROCESSING" || status === "PENDING"
      return true
    })
  }, [batches, statusFilter])

  const totalPages = useMemo(() => {
    const size = Math.max(1, Number(rowsPerPage))
    return Math.max(1, Math.ceil(filteredBatches.length / size))
  }, [filteredBatches.length, rowsPerPage])

  const paginatedBatches = useMemo(() => {
    const size = Math.max(1, Number(rowsPerPage))
    const start = (page - 1) * size
    return filteredBatches.slice(start, start + size)
  }, [filteredBatches, page, rowsPerPage])

  const detailRows: CentreMonetiqueExtractionRow[] = useMemo(() => editableRows || [], [editableRows])

  type BaridDisplayRow = {
    key: string
    rowIndex: number
    reglement: string
    sourceCompte: string
    date: string
    cardNumber: string
    montantTransaction: string
    dc: string
    commissionHt: string
    tva: string
    reglementAmount: string
    reglementDc: string
    reglementCommHt: string
    reglementCommTva: string
  }

  type CmiDisplayRow = {
    key: string
    rowIndex: number
    section: string
    date: string
    reference: string
    montant: string
    debit: string
    credit: string
    totalRemise: string
    totalCommissionsHt: string
    totalTvaSurCommissions: string
    soldeNetRemise: string
  }

  const baridRows: BaridDisplayRow[] = useMemo(() => {
    if (selected?.structure !== "BARID_BANK") return []
    const reglementToCompte = new Map<string, string>()
    const reglementToTotals = new Map<string, { amount: string; dc: string; commHt: string; commTva: string }>()
    const rows: BaridDisplayRow[] = []

    detailRows.forEach((row) => {
      const section = (row.section || "").trim()
      if (section === "REGLEMENT META") {
        const regMatch = (row.credit || "").match(/REGLEMENT\s+([A-Z0-9]+)/i)
        if (regMatch) {
          reglementToCompte.set(regMatch[1], (row.reference || "").trim())
        }
        return
      }
      if (section === "REGLEMENT TOTALS") {
        const reglement = (row.reference || "").trim()
        if (reglement) {
          reglementToTotals.set(reglement, {
            amount: (row.montant || "").trim(),
            dc: (row.dc || "").trim().toUpperCase(),
            commHt: (row.debit || "").trim(),
            commTva: (row.credit || "").trim(),
          })
        }
      }
    })

    detailRows.forEach((row, idx) => {
      const section = (row.section || "").trim()
      if (section === "REGLEMENT META" || section === "REGLEMENT TOTALS") return
      if (!section.startsWith("REGLEMENT ")) return

      const reglement = section.replace(/^REGLEMENT\s+/i, "").trim()
      const dc = ((row.dc || "").trim().toUpperCase() === "D" ? "D" : (row.dc || "").trim().toUpperCase() === "C" ? "C" : "")
      const commissionRaw = (row.debit || "").trim()
      const commission = Number.parseFloat(commissionRaw.replace(",", "."))
      const commissionFormatted = commissionRaw !== "" && Number.isFinite(commission)
        ? commission.toFixed(4)
        : commissionRaw
      const tva = commissionRaw !== "" && Number.isFinite(commission)
        ? (commission * 0.1).toFixed(4)
        : ""
      const reglementTotals = reglementToTotals.get(reglement)

      rows.push({
        key: `${reglement}-${row.date}-${row.reference}-${idx}`,
        rowIndex: idx,
        reglement,
        sourceCompte: baridAccountSelections[reglement] || reglementToCompte.get(reglement) || "",
        date: row.date || "",
        cardNumber: row.reference || "",
        montantTransaction: row.montant || "",
        dc,
        commissionHt: commissionFormatted,
        tva,
        reglementAmount: reglementTotals?.amount || "",
        reglementDc: reglementTotals?.dc || "",
        reglementCommHt: reglementTotals?.commHt || "",
        reglementCommTva: reglementTotals?.commTva || "",
      })
    })

    return rows
  }, [detailRows, selected?.structure, baridAccountSelections])

  type AmexDisplayRow = {
    key: string
    rowIndex: number
    terminalId: string
    cardNumber: string
    date: string
    transactionDate: string
    submissionAmount: string
    discountAmount: string
    netAmount: string
    isTotal: boolean
    totalLabel?: string
  }

  const amexRows: AmexDisplayRow[] = useMemo(() => {
    if (selected?.structure !== "AMEX") return []
    return detailRows
      .map((row, idx) => {
        const section = (row.section || "").trim()
        if (!section.startsWith("AMEX ")) return null
        const upper = section.toUpperCase()
        if (upper === "AMEX SETTLEMENT" || upper === "AMEX TERMINAL") return null

        if (upper === "AMEX TOTAL TERMINAL") {
          return {
            key: `amex-total-terminal-${idx}`,
            rowIndex: idx,
            terminalId: row.reference || "",
            cardNumber: "",
            date: "",
            transactionDate: "",
            submissionAmount: row.montant || "",
            discountAmount: row.debit || "",
            netAmount: row.credit || "",
            isTotal: true,
            totalLabel: "Total terminal",
          } as AmexDisplayRow
        }

        if (upper === "AMEX SUB TOTAL") {
          return {
            key: `amex-sub-total-${idx}`,
            rowIndex: idx,
            terminalId: "",
            cardNumber: row.reference || "",
            date: row.date || "",
            transactionDate: "",
            submissionAmount: row.montant || "",
            discountAmount: row.debit || "",
            netAmount: row.credit || "",
            isTotal: true,
            totalLabel: "Sous-total règlement",
          } as AmexDisplayRow
        }

        const terminalId = section.replace(/^AMEX\s+/i, "").trim()
        return {
          key: `amex-${terminalId}-${row.date}-${row.reference}-${idx}`,
          rowIndex: idx,
          terminalId,
          cardNumber: row.reference || "",
          date: row.date || "",
          transactionDate: row.dc || "",
          submissionAmount: row.montant || "",
          discountAmount: row.debit || "",
          netAmount: row.credit || "",
          isTotal: false,
        } as AmexDisplayRow
      })
      .filter((r): r is AmexDisplayRow => r !== null)
  }, [detailRows, selected?.structure])

  type VpsDisplayRow = {
    key: string
    rowIndex: number
    date: string
    montantTotalTranx: string
    totalComHt: string
    tva10: string
    creditDebitMarchand: string
  }

  const vpsRows: VpsDisplayRow[] = useMemo(() => {
    if (selected?.structure !== "VPS") return []
    return detailRows.map((row, idx) => ({
      key: `vps-${idx}`,
      rowIndex: idx,
      date: row.date || "",
      montantTotalTranx: row.montant || "",
      totalComHt: row.debit || "",
      tva10: row.dc || "",
      creditDebitMarchand: row.credit || "",
    }))
  }, [detailRows, selected?.structure])

  const cmiRows: CmiDisplayRow[] = useMemo(() => {
    if (selected?.structure === "BARID_BANK" || selected?.structure === "AMEX" || selected?.structure === "VPS") return []

    const rows: CmiDisplayRow[] = []
    let currentTransactionIndexes: number[] = []
    let blockTotals: {
      totalRemise: string
      totalCommissionsHt: string
      totalTvaSurCommissions: string
      soldeNetRemise: string
      debitTags: string[]
      creditTags: string[]
    } = {
      totalRemise: "",
      totalCommissionsHt: "",
      totalTvaSurCommissions: "",
      soldeNetRemise: "",
      debitTags: [],
      creditTags: [],
    }

    const hasAnyBlockTotal = () =>
      !!(blockTotals.totalRemise || blockTotals.totalCommissionsHt || blockTotals.totalTvaSurCommissions || blockTotals.soldeNetRemise)

    const applyCurrentTotals = () => {
      if (!hasAnyBlockTotal() || currentTransactionIndexes.length === 0) return
      currentTransactionIndexes.forEach((displayIdx) => {
        rows[displayIdx] = {
          ...rows[displayIdx],
          totalRemise: blockTotals.totalRemise,
          totalCommissionsHt: blockTotals.totalCommissionsHt,
          totalTvaSurCommissions: blockTotals.totalTvaSurCommissions,
          soldeNetRemise: blockTotals.soldeNetRemise,
          debit: blockTotals.debitTags.join(" | "),
          credit: blockTotals.creditTags.join(" | "),
        }
      })
    }

    const resetBlock = () => {
      currentTransactionIndexes = []
      blockTotals = {
        totalRemise: "",
        totalCommissionsHt: "",
        totalTvaSurCommissions: "",
        soldeNetRemise: "",
        debitTags: [],
        creditTags: [],
      }
    }

    detailRows.forEach((row, idx) => {
      const section = (row.section || "").trim()
      const upperSection = section.toUpperCase()

      if (upperSection === "REMISE" || (upperSection.startsWith("REMISE ") && upperSection !== "REMISE ACHAT")) {
        if (hasAnyBlockTotal()) {
          applyCurrentTotals()
          resetBlock()
        }
        rows.push({
          key: `${section}-${row.reference}-${row.date}-${idx}`,
          rowIndex: idx,
          section: row.section || "",
          date: row.date || "",
          reference: row.reference || "",
          montant: row.montant || "",
          debit: row.debit || "",
          credit: row.credit || "",
          totalRemise: "",
          totalCommissionsHt: "",
          totalTvaSurCommissions: "",
          soldeNetRemise: "",
        })
        currentTransactionIndexes.push(rows.length - 1)
        return
      }

      if (upperSection.startsWith("TOTAL REMISE")) {
        blockTotals.totalRemise = row.montant || ""
        return
      }
      if (upperSection.startsWith("TOTAL COMMISSIONS")) {
        const value = row.debit || row.credit || ""
        blockTotals.totalCommissionsHt = value
        if (value) {
          if (row.debit) blockTotals.debitTags.push("HT")
          else blockTotals.creditTags.push("HT")
        }
        return
      }
      if (upperSection.startsWith("TOTAL TVA SUR COMMISSIONS")) {
        const value = row.debit || row.credit || ""
        blockTotals.totalTvaSurCommissions = value
        if (value) {
          if (row.debit) blockTotals.debitTags.push("TVA")
          else blockTotals.creditTags.push("TVA")
        }
        return
      }
      if (upperSection.startsWith("SOLDE NET REMISE")) {
        const value = row.credit || row.debit || ""
        blockTotals.soldeNetRemise = value
        if (value) {
          if (row.credit) blockTotals.creditTags.push("SRN")
          else blockTotals.debitTags.push("SRN")
        }
        applyCurrentTotals()
        resetBlock()
      }
    })
    applyCurrentTotals()
    return rows
  }, [detailRows, selected?.structure])

  const modalRows =
    selected?.structure === "BARID_BANK" ? baridRows :
    selected?.structure === "AMEX" ? amexRows :
    selected?.structure === "VPS" ? vpsRows :
    cmiRows

  const totalModalPages = useMemo(() => {
    const size = Math.max(1, Number(modalRowsPerPage))
    return Math.max(1, Math.ceil(modalRows.length / size))
  }, [modalRows.length, modalRowsPerPage])

  const paginatedDetailRows = useMemo(() => {
    const size = Math.max(1, Number(modalRowsPerPage))
    const start = (modalPage - 1) * size
    return modalRows.slice(start, start + size)
  }, [modalRows, modalPage, modalRowsPerPage])

  const cleanedOcrText = useMemo(() => {
    const raw = selected?.rawOcrText || ""
    if (!raw) return ""
    return raw
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }, [selected?.rawOcrText])

  const openDetail = async (id: number) => {
    try {
      const detail = await centreApi.getCentreMonetiqueBatchById(id, true)
      setSelected(detail)
      setDetailOpen(true)
    } catch (error: any) {
      toast.error(error?.message || "Erreur détail")
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Sélectionnez au moins un fichier")
      return
    }

    setUploading(true)
    try {
      let lastBatch: CentreMonetiqueBatchDetail | null = null
      for (const f of files) {
        const response = await centreApi.uploadCentreMonetique(f, undefined, selectedStructure, uploadRib || undefined)
        lastBatch = response.batch
      }
      if (lastBatch) {
        setSelected(lastBatch)
      }
      setFiles([])
      toast.success(`${files.length} fichier(s) traité(s)`)
      await loadHistory()
    } catch (error: any) {
      toast.error(error?.message || "Erreur upload Centre Monétique")
    } finally {
      setUploading(false)
    }
  }

  const refreshHistoryAndSelection = async (batchId?: number) => {
    await loadHistory()
    const targetId = batchId ?? selected?.id
    if (targetId) {
      try {
        const refreshed = await centreApi.getCentreMonetiqueBatchById(targetId, true)
        setSelected(refreshed)
      } catch {
        // on garde l'état courant si le refresh detail échoue
      }
    }
  }

  const handleReprocess = async (batch: CentreMonetiqueBatchSummary) => {
    try {
      const effectiveStructure = batch.structure && batch.structure !== "AUTO"
        ? batch.structure
        : selectedStructure
      const response = await centreApi.reprocessCentreMonetique(batch.id, undefined, effectiveStructure as any)
      const refreshedId = response?.batch?.id ?? batch.id
      setSelected(response.batch)
      toast.success("Retraitement terminé")
      await refreshHistoryAndSelection(refreshedId)
    } catch (error: any) {
      toast.error(error?.message || "Erreur retraitement")
    }
  }

  const handleDelete = (id: number) => {
    setDeleteBatchId(id)
  }

  const handleClientValidate = async (batchId: number) => {
    try {
      const updated = await centreApi.clientValidateCentreMonetiqueBatch(batchId)
      setBatches((prev) =>
        prev.map((batch) =>
          batch.id === batchId
            ? {
                ...batch,
                clientValidated: true,
                clientValidatedAt: updated.clientValidatedAt ?? batch.clientValidatedAt,
                clientValidatedBy: updated.clientValidatedBy ?? batch.clientValidatedBy,
              }
            : batch,
        ),
      )
      if (selected?.id === batchId) {
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                clientValidated: true,
                clientValidatedAt: updated.clientValidatedAt ?? prev.clientValidatedAt,
                clientValidatedBy: updated.clientValidatedBy ?? prev.clientValidatedBy,
              }
            : prev,
        )
      }
      toast.success("Batch validé par le client")
      await loadHistory()
    } catch (error: any) {
      toast.error(error?.message || "Erreur validation client")
    }
  }

  const confirmDelete = async () => {
    if (deleteBatchId == null) return
    try {
      await centreApi.deleteCentreMonetiqueBatch(deleteBatchId)
      if (selected?.id === deleteBatchId) setSelected(null)
      toast.success("Batch supprimé")
      await loadHistory()
    } catch (error: any) {
      toast.error(error?.message || "Erreur suppression")
    } finally {
      setDeleteBatchId(null)
    }
  }

  const handleDeleteAll = () => {
    setDeleteAllOpen(true)
  }

  const confirmDeleteAll = async () => {
    const ids = batches.map((b) => b.id)
    try {
      await Promise.all(ids.map((id) => centreApi.deleteCentreMonetiqueBatch(id)))
      setSelected(null)
      toast.success("Tous les batches ont été supprimés")
      await loadHistory()
    } catch (error: any) {
      toast.error(error?.message || "Erreur suppression globale")
    } finally {
      setDeleteAllOpen(false)
    }
  }

  const handleOpenFile = async (id: number) => {
    try {
      const response = await fetch(centreApi.getCentreMonetiqueFileUrl(id))
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const win = window.open(objectUrl, "_blank", "noopener,noreferrer")
      if (!win) {
        throw new Error("Popup bloquée")
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error: any) {
      toast.error(error?.message || "Impossible d'ouvrir le fichier")
    }
  }

  const handleSaveRib = async (batchId: number) => {
    setSavingRib(true)
    try {
      const updated = await centreApi.updateCentreMonetiqueBatchRib(batchId, editRibValue)
      setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, rib: updated.rib } : b))
      if (selected?.id === batchId) setSelected((prev) => prev ? { ...prev, rib: updated.rib } : prev)
      setEditRibBatchId(null)
      setEditRibValue("")
      toast.success("RIB mis à jour")
    } catch (error: any) {
      toast.error(error?.message || "Erreur mise à jour RIB")
    } finally {
      setSavingRib(false)
    }
  }

  const handleRapprochement = async (batchId: number) => {
    setRapprochementLoading(true)
    setRapprochementResult(null)
    setRapprochementOpen(true)
    try {
      const result = await liaisonApi.getRapprochement(batchId)
      setRapprochementResult(result)
    } catch (error: any) {
      toast.error(error?.message || "Erreur rapprochement")
      setRapprochementOpen(false)
    } finally {
      setRapprochementLoading(false)
    }
  }

  const updateRowField = (index: number, field: keyof CentreMonetiqueExtractionRow, value: string) => {
    setEditableRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        return { ...row, [field]: value }
      })
    )
  }

  const addTransactionRow = () => {
    if (selected?.structure === "BARID_BANK") {
      setEditableRows((prev) => ([
        ...prev,
        {
          section: "REGLEMENT ",
          date: "",
          reference: "",
          montant: "",
          debit: "",
          credit: "C | LOCAL | Paiement",
          dc: "C",
        },
      ]))
      return
    }
    if (selected?.structure === "AMEX") {
      setEditableRows((prev) => ([
        ...prev,
        {
          section: "AMEX TX",
          date: "",
          reference: "",
          montant: "",
          debit: "",
          credit: "",
          dc: "C",
        },
      ]))
      return
    }
    if (selected?.structure === "VPS") {
      setEditableRows((prev) => ([
        ...prev,
        {
          section: "VPS",
          date: "",
          reference: "",
          montant: "",
          debit: "",
          credit: "",
          dc: "",
        },
      ]))
      return
    }
    setEditableRows((prev) => ([
      ...prev,
      {
        section: "Remise",
        date: "",
        reference: "",
        montant: "",
        debit: "",
        credit: "",
        dc: "",
      },
    ]))
  }

  const normalizeRowsForSave = (): CentreMonetiqueExtractionRow[] => {
    const nextRows = editableRows.map((row) => ({ ...row }))
    if (selected?.structure !== "BARID_BANK") {
      return nextRows
    }

    const metaByReglement = new Map<string, number>()
    nextRows.forEach((row, idx) => {
      if ((row.section || "").trim() !== "REGLEMENT META") return
      const regMatch = (row.credit || "").match(/REGLEMENT\s+([A-Z0-9]+)/i)
      if (!regMatch) return
      metaByReglement.set(regMatch[1], idx)
    })

    Object.entries(baridAccountSelections).forEach(([reglement, accountCode]) => {
      if (!reglement || !accountCode) return
      const existing = metaByReglement.get(reglement)
      if (existing !== undefined) {
        nextRows[existing] = {
          ...nextRows[existing],
          reference: accountCode,
          credit: `REGLEMENT ${reglement}`,
        }
        return
      }
      nextRows.push({
        section: "REGLEMENT META",
        date: "",
        reference: accountCode,
        montant: "",
        debit: "",
        credit: `REGLEMENT ${reglement}`,
        dc: "",
      })
    })

    return nextRows
  }

  const handleSaveRows = async () => {
    if (!selected) return
    setSavingRows(true)
    try {
      const payload = normalizeRowsForSave()
      const response = await centreApi.saveCentreMonetiqueRows(selected.id, payload)
      setSelected(response.batch)
      setEditableRows(response.batch.rows || [])
      setIsEditing(false)
      toast.success("Modifications enregistrées")
      await loadHistory()
    } catch (error: any) {
      toast.error(error?.message || "Erreur enregistrement")
    } finally {
      setSavingRows(false)
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const dropped = Array.from(e.dataTransfer.files || [])
    if (dropped.length === 0) return
    setFiles((prev) => [...prev, ...dropped])
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const renderStatus = (status: string) => {
    const normalized = (status || "").toUpperCase()
    if (normalized === "PROCESSED") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Traité</Badge>
    if (normalized === "ERROR") return <Badge variant="destructive">Erreur</Badge>
    if (normalized === "PROCESSING" || normalized === "PENDING") {
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">En cours</Badge>
    }
    return <Badge variant="outline">{status || "-"}</Badge>
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6 text-slate-900">
      <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CloudUpload className="h-5 w-5 text-primary" />
            </div>
            Uploader des fichiers Centre Monétique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-sky-50 p-4 rounded-xl border border-sky-200">
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Structure Centre Monétique</p>
                <p className="text-muted-foreground text-xs">Forcer un modèle spécifique</p>
              </div>
            </div>
            <Select value={selectedStructure} onValueChange={(value) => setSelectedStructure(value as "AUTO" | "CMI" | "BARID_BANK" | "AMEX" | "VPS")}>
              <SelectTrigger className="w-full sm:w-[280px] bg-background">
                <SelectValue placeholder="Choisir une structure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Détection automatique</SelectItem>
                <SelectItem value="CMI">CMI</SelectItem>
                <SelectItem value="BARID_BANK">Barid Bank</SelectItem>
                <SelectItem value="AMEX">American Express (AMEX)</SelectItem>
                <SelectItem value="VPS">VPS (Excel)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Champ RIB pour la liaison avec les relevés bancaires */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-sky-50 p-4 rounded-xl border border-sky-200">
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">RIB du compte bancaire <span className="font-normal text-muted-foreground">(optionnel)</span></p>
                <p className="text-muted-foreground text-xs">Extrait automatiquement du PDF — saisir ici pour forcer une valeur</p>
              </div>
            </div>
            <Input
              className="w-full sm:w-[320px] bg-background font-mono"
              placeholder="Ex : 011810000012345678901234"
              maxLength={30}
              value={uploadRib}
              onChange={(e) => setUploadRib(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div
            className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
              isDragOver
                ? "border-sky-500 bg-sky-100/60"
                : "border-sky-200 hover:border-sky-400 hover:bg-sky-50"
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => document.getElementById("cm-file-input")?.click()}
          >
            <input
              id="cm-file-input"
              type="file"
              className="hidden"
              accept={acceptedExtensions}
              multiple
              onChange={(e) => {
                const picked = Array.from(e.target.files || [])
                if (picked.length === 0) return
                setFiles((prev) => [...prev, ...picked])
                e.currentTarget.value = ""
              }}
            />

            <div className="flex flex-col items-center text-center gap-3 px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                <Upload className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="px-3 py-1 rounded-full bg-muted/50">PDF, PNG, JPG, WEBP, BMP, TIFF, XLSX, XLS</span>
                <span className="px-3 py-1 rounded-full bg-muted/50">Max 50 Mo</span>
              </div>
              {files.length > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="max-w-[500px] truncate">{files.length} fichier(s) sélectionné(s)</span>
                </div>
              )}
            </div>
          </div>

          {files.length > 0 && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
              <Button variant="outline" onClick={() => setFiles([])} disabled={uploading}>
                Annuler
              </Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Uploader ({files.length})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-200 bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardDescription>{filteredBatches.length} batch(s) affiché(s)</CardDescription>
            <div className="flex items-center gap-2">
              <div className="w-[170px]">
                <Select value={rowsPerPage} onValueChange={setRowsPerPage}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Lignes / page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="25">25 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => { void refreshHistoryAndSelection() }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rafraîchir
              </Button>
              {!isClient && (
                <Button variant="destructive" onClick={handleDeleteAll} disabled={batches.length === 0}>
                  Tout supprimer
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>Tous</Button>
        <Button variant={statusFilter === "processing" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("processing")}>À traiter</Button>
        <Button variant={statusFilter === "processed" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("processed")}>Traités</Button>
        <Button variant={statusFilter === "error" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("error")}>Erreurs</Button>
      </div>

      <Card className="border-sky-200 bg-white shadow-sm">
        <CardContent className="p-0">
          {isClient ? (
            <div className="space-y-3 p-4">
              {paginatedBatches.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Aucun batch Centre Monétique</div>
              ) : (
                paginatedBatches.map((batch) => (
                  <div key={batch.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <p className="truncate font-medium text-foreground" title={batch.originalName}>{batch.originalName}</p>
                        {renderStatus(batch.status)}
                        {batch.clientValidated ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                            Validé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
                            En attente
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {batch.structure || "-"}
                        {batch.statementPeriod ? ` · ${batch.statementPeriod}` : ""}
                        {batch.rib ? ` · ${batch.rib}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Button size="icon" variant="outline" onClick={() => openDetail(batch.id)} title="Voir détail">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!batch.clientValidated && (
                        <Button size="sm" className="gap-2" onClick={() => handleClientValidate(batch.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                          Valider
                        </Button>
                      )}
                      {!batch.clientValidated && (
                        <Button variant="outline" size="sm" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => handleDelete(batch.id)}>
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 text-left">Fichier</th>
                  <th className="p-3 text-left">RIB</th>
                  <th className="p-3 text-left">Structure</th>
                  <th className="p-3 text-left">Période</th>
                  <th className="p-3 text-left">Transactions</th>
                  <th className="p-3 text-left">Statut</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBatches.map((batch) => (
                  <tr key={batch.id} className="border-b hover:bg-muted/10">
                    <td className="p-3 max-w-[300px] truncate" title={batch.originalName}>{batch.originalName}</td>
                    <td className="p-3">
                      {isClient ? (
                        batch.rib ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5">
                              <CreditCard className="h-3 w-3 text-sky-500 shrink-0" />
                              <span className="font-mono text-xs text-sky-800">{batch.rib}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground/50">Non extrait</span>
                        )
                      ) : editRibBatchId === batch.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-7 w-[200px] font-mono text-xs"
                            value={editRibValue}
                            maxLength={30}
                            onChange={(e) => setEditRibValue(e.target.value.replace(/\D/g, ""))}
                            placeholder="24 chiffres"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={savingRib}
                            onClick={() => handleSaveRib(batch.id)}>
                            {savingRib ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditRibBatchId(null); setEditRibValue("") }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : batch.rib ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5">
                            <CreditCard className="h-3 w-3 text-sky-500 shrink-0" />
                            <span className="font-mono text-xs text-sky-800">{batch.rib}</span>
                          </div>
                          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-50 hover:opacity-100"
                            onClick={() => { setEditRibBatchId(batch.id); setEditRibValue(batch.rib || "") }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs italic text-muted-foreground/50">Non extrait</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-50 hover:opacity-100"
                            onClick={() => { setEditRibBatchId(batch.id); setEditRibValue("") }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="p-3">{batch.structure || "-"}</td>
                    <td className="p-3">{batch.statementPeriod || "-"}</td>
                    <td className="p-3">{batch.totalTransactions || String(batch.transactionCount || 0)}</td>
                    <td className="p-3">{renderStatus(batch.status)}</td>
                    {isClient ? (
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDetail(batch.id)} title="Voir détail">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!batch.clientValidated && (
                            <Button size="sm" onClick={() => handleClientValidate(batch.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Valider
                            </Button>
                          )}
                          {!batch.clientValidated && (
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => handleDelete(batch.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </td>
                    ) : (
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" onClick={() => openDetail(batch.id)} title="Voir détail">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {batch.isLinkedToStatement && (
                            <Button size="icon" variant="outline" onClick={() => handleRapprochement(batch.id)}
                              title="Voir le rapprochement avec les relevés bancaires"
                              className="text-sky-600 border-sky-300 hover:bg-sky-50">
                              <Link2 className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" title="Autres actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenFile(batch.id)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Fichier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReprocess(batch)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reprocess
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(batch.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {paginatedBatches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Aucun batch Centre Monétique
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border/50 px-4 py-3 text-sm text-muted-foreground">
            <span>Page {page} / {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Précédent
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Suivant
              </Button>
            </div>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-6xl w-full h-[90vh] min-h-0 flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b bg-card z-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">Détail Centre Monétique</DialogTitle>
                <DialogDescription>{selected?.originalName || ""}</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-[150px]">
                  <Select value={modalGlobalRowsPerPage} onValueChange={setModalGlobalRowsPerPage}>
                    <SelectTrigger className="h-8 bg-background text-xs">
                      <SelectValue placeholder="Modal / page" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / modal</SelectItem>
                      <SelectItem value="25">25 / modal</SelectItem>
                      <SelectItem value="50">50 / modal</SelectItem>
                      <SelectItem value="100">100 / modal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!isClient && !isEditing && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2" onClick={() => setIsEditing(true)}>
                    <Pencil className="h-3 w-3" />
                    Modifier
                  </Button>
                )}
                {!isClient && isEditing && (
                  <>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2" onClick={addTransactionRow}>
                      <Plus className="h-3 w-3" />
                      Ajouter
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2" onClick={() => { setEditableRows(selected?.rows || []); setIsEditing(false) }}>
                      <X className="h-3 w-3" />
                      Annuler
                    </Button>
                    <Button size="sm" className="h-8 text-xs gap-1 px-2" onClick={handleSaveRows} disabled={savingRows}>
                      {savingRows ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Enregistrer
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 px-2 border-primary/20 hover:bg-primary/5"
                  onClick={() => setOcrOpen(true)}
                >
                  <Eye className="h-3 w-3" />
                  Inspecter OCR
                </Button>
              </div>
            </div>
          </DialogHeader>

          {selected && (
            <div className="flex-1 min-h-0 overflow-y-auto bg-muted/10 p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="font-medium">Statut:</span> {selected.status}</div>
                <div><span className="font-medium">Structure:</span> {selected.structure || "-"}</div>
                <div><span className="font-medium">Tx:</span> {selected.transactionCount}</div>
                <div><span className="font-medium">Période:</span> {selected.statementPeriod || "-"}</div>
              </div>

              {selected.rib && (
                <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
                  <CreditCard className="h-4 w-4 text-sky-600 shrink-0" />
                  <span className="font-medium text-sky-700">RIB :</span>
                  <span className="font-mono text-xs bg-white border border-sky-200 px-2 py-0.5 rounded text-sky-900">{selected.rib}</span>
                </div>
              )}

              <div className="flex items-center justify-between rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs">
                <span className="text-slate-600">Pagination globale du modal</span>
                <div className="w-[170px]">
                  <Select value={modalGlobalRowsPerPage} onValueChange={setModalGlobalRowsPerPage}>
                    <SelectTrigger className="h-8 bg-background text-xs">
                      <SelectValue placeholder="Lignes / modal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / modal</SelectItem>
                      <SelectItem value="25">25 / modal</SelectItem>
                      <SelectItem value="50">50 / modal</SelectItem>
                      <SelectItem value="100">100 / modal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border/60 bg-card/70">
                <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 text-xs text-muted-foreground">
                  <div className="w-[170px]">
                    <Select value={modalRowsPerPage} onValueChange={setModalRowsPerPage}>
                      <SelectTrigger className="h-8 bg-background">
                        <SelectValue placeholder="Tableau / page" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / page</SelectItem>
                        <SelectItem value="25">25 / page</SelectItem>
                        <SelectItem value="50">50 / page</SelectItem>
                        <SelectItem value="100">100 / page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span>Page {modalPage} / {totalModalPages}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {selected.structure === "BARID_BANK" ? (
                        <>
                          <th className="p-2 text-left">Règlement</th>
                          <th className="p-2 text-left">Compte comptable</th>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Numéro de carte</th>
                          <th className="p-2 text-left">Montant transaction (DH)</th>
                          <th className="p-2 text-left">Débit / Crédit</th>
                          <th className="p-2 text-left">Comm H.T</th>
                          <th className="p-2 text-left">TVA</th>
                          <th className="p-2 text-left">Montant règlement</th>
                          <th className="p-2 text-left">C/D règlement</th>
                          <th className="p-2 text-left">Comm H.T règlement</th>
                          <th className="p-2 text-left">Comm TVA règlement</th>
                        </>
                      ) : selected.structure === "AMEX" ? (
                        <>
                          <th className="p-2 text-left">Date soumission</th>
                          <th className="p-2 text-left">Date transaction</th>
                          <th className="p-2 text-left">Terminal ID</th>
                          <th className="p-2 text-left">Numéro de carte</th>
                          <th className="p-2 text-right">Montant soumission (DH)</th>
                          <th className="p-2 text-right">Remise (DH)</th>
                          <th className="p-2 text-right">Montant net (DH)</th>
                        </>
                      ) : selected.structure === "VPS" ? (
                        <>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-right">Montant Total Tranx (DH)</th>
                          <th className="p-2 text-right">Total Com HT (DH)</th>
                          <th className="p-2 text-right">TVA 10% (DH)</th>
                          <th className="p-2 text-right">Crédit/Débit Marchand (DH)</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2 text-left">Section</th>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Référence</th>
                          <th className="p-2 text-left">Montant</th>
                          <th className="p-2 text-left">Débit</th>
                          <th className="p-2 text-left">Crédit</th>
                          <th className="p-2 text-left">Total remise (DH)</th>
                          <th className="p-2 text-left">Total commissions HT</th>
                          <th className="p-2 text-left">Total TVA commissions</th>
                          <th className="p-2 text-left">Solde net remise</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.structure === "VPS" ? (
                      (paginatedDetailRows as VpsDisplayRow[]).map((row) => (
                        <tr key={row.key} className="border-b hover:bg-muted/10">
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.date} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "date", e.target.value)} />
                            ) : row.date}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {isEditing ? (
                              <Input value={row.montantTotalTranx} className="h-8 text-right" onChange={(e) => updateRowField(row.rowIndex, "montant", e.target.value)} />
                            ) : row.montantTotalTranx}
                          </td>
                          <td className="p-2 text-right font-mono text-amber-700">
                            {isEditing ? (
                              <Input value={row.totalComHt} className="h-8 text-right" onChange={(e) => updateRowField(row.rowIndex, "debit", e.target.value)} />
                            ) : row.totalComHt}
                          </td>
                          <td className="p-2 text-right font-mono text-amber-600">
                            {isEditing ? (
                              <Input value={row.tva10} className="h-8 text-right" onChange={(e) => updateRowField(row.rowIndex, "dc", e.target.value)} />
                            ) : row.tva10}
                          </td>
                          <td className="p-2 text-right font-mono font-medium text-emerald-700">
                            {isEditing ? (
                              <Input value={row.creditDebitMarchand} className="h-8 text-right" onChange={(e) => updateRowField(row.rowIndex, "credit", e.target.value)} />
                            ) : row.creditDebitMarchand}
                          </td>
                        </tr>
                      ))
                    ) : selected.structure === "AMEX" ? (
                      (paginatedDetailRows as AmexDisplayRow[]).map((row) => (
                        <tr key={row.key} className={`border-b ${row.isTotal ? "bg-muted/40 font-semibold" : "hover:bg-muted/10"}`}>
                          {/* Date soumission */}
                          <td className="p-2">
                            {row.isTotal ? (
                              <span className="text-xs text-muted-foreground italic">{row.totalLabel}</span>
                            ) : isEditing ? (
                              <Input value={row.date} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "date", e.target.value)} />
                            ) : (
                              row.date
                            )}
                          </td>
                          {/* Date transaction */}
                          <td className="p-2 text-xs text-muted-foreground">
                            {row.isTotal ? "" : isEditing ? (
                              <Input value={row.transactionDate} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "dc", e.target.value)} />
                            ) : (
                              row.transactionDate
                            )}
                          </td>
                          {/* Terminal ID */}
                          <td className="p-2 font-mono text-xs">
                            {row.isTotal ? "" : isEditing ? (
                              <Input value={row.terminalId} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "section", `AMEX ${e.target.value}`)} />
                            ) : (
                              row.terminalId
                            )}
                          </td>
                          {/* Numéro de carte */}
                          <td className="p-2 font-mono text-xs">
                            {row.isTotal ? "" : isEditing ? (
                              <Input value={row.cardNumber} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "reference", e.target.value)} />
                            ) : (
                              row.cardNumber
                            )}
                          </td>
                          {/* Montant soumission */}
                          <td className="p-2 text-right font-mono">
                            {isEditing ? (
                              <Input value={row.submissionAmount} className="h-8 text-right" onChange={(e) => updateRowField(row.rowIndex, "montant", e.target.value)} />
                            ) : (
                              row.submissionAmount
                            )}
                          </td>
                          {/* Remise */}
                          <td className="p-2 text-right font-mono text-amber-700">
                            {isEditing ? (
                              <Input value={row.discountAmount} className="h-8 text-right" onChange={(e) => updateRowField(row.rowIndex, "debit", e.target.value)} />
                            ) : (
                              row.discountAmount
                            )}
                          </td>
                          {/* Montant net */}
                          <td className="p-2 text-right font-mono font-medium text-emerald-700">
                            {isEditing ? (
                              <Input value={row.netAmount} className="h-8 text-right" onChange={(e) => updateRowField(row.rowIndex, "credit", e.target.value)} />
                            ) : (
                              row.netAmount
                            )}
                          </td>
                        </tr>
                      ))
                    ) : selected.structure === "BARID_BANK" ? (
                      (paginatedDetailRows as BaridDisplayRow[]).map((row) => (
                        <tr key={row.key} className="border-b">
                          <td className="p-2 font-mono">
                            {isEditing ? (
                              <Input
                                value={row.reglement}
                                className="h-8"
                                onChange={(e) => updateRowField(row.rowIndex, "section", `REGLEMENT ${e.target.value}`)}
                              />
                            ) : (
                              row.reglement
                            )}
                          </td>
                          <td className="p-2 min-w-[220px]">
                            <Select
                              value={baridAccountSelections[row.reglement] || row.sourceCompte || ""}
                              onValueChange={(value) =>
                                setBaridAccountSelections((prev) => ({ ...prev, [row.reglement]: value }))
                              }
                            >
                              <SelectTrigger className="h-8 bg-background">
                                <SelectValue placeholder="Code 9 chiffres" />
                              </SelectTrigger>
                              <SelectContent>
                                {accountOptions.map((account) => (
                                  <SelectItem key={account.id} value={account.code}>
                                    {account.code} - {account.libelle}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.date} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "date", e.target.value)} />
                            ) : (
                              row.date
                            )}
                          </td>
                          <td className="p-2 font-mono">
                            {isEditing ? (
                              <Input value={row.cardNumber} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "reference", e.target.value)} />
                            ) : (
                              row.cardNumber
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.montantTransaction} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "montant", e.target.value)} />
                            ) : (
                              row.montantTransaction
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Select value={row.dc || "C"} onValueChange={(value) => updateRowField(row.rowIndex, "dc", value)}>
                                <SelectTrigger className="h-8 bg-background w-[90px]">
                                  <SelectValue placeholder="D/C" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="C">C</SelectItem>
                                  <SelectItem value="D">D</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              row.dc
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.commissionHt} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "debit", e.target.value)} />
                            ) : (
                              row.commissionHt
                            )}
                          </td>
                          <td className="p-2">{row.tva}</td>
                          <td className="p-2 font-medium">{row.reglementAmount}</td>
                          <td className="p-2 font-medium">{row.reglementDc}</td>
                          <td className="p-2">{row.reglementCommHt}</td>
                          <td className="p-2">{row.reglementCommTva}</td>
                        </tr>
                      ))
                    ) : (
                      (paginatedDetailRows as CmiDisplayRow[]).map((row) => (
                        <tr key={row.key} className="border-b">
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.section} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "section", e.target.value)} />
                            ) : (
                              row.section
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.date} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "date", e.target.value)} />
                            ) : (
                              row.date
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.reference} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "reference", e.target.value)} />
                            ) : (
                              row.reference
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.montant} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "montant", e.target.value)} />
                            ) : (
                              row.montant
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.debit} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "debit", e.target.value)} />
                            ) : (
                              row.debit
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input value={row.credit} className="h-8" onChange={(e) => updateRowField(row.rowIndex, "credit", e.target.value)} />
                            ) : (
                              row.credit
                            )}
                          </td>
                          <td className="p-2 font-medium">{row.totalRemise}</td>
                          <td className="p-2">{row.totalCommissionsHt}</td>
                          <td className="p-2">{row.totalTvaSurCommissions}</td>
                          <td className="p-2 font-medium">{row.soldeNetRemise}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="flex items-center justify-end gap-2 border-t border-border/50 px-3 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                    disabled={modalPage <= 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalPage((p) => Math.min(totalModalPages, p + 1))}
                    disabled={modalPage >= totalModalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
        <DialogContent className="max-w-[50vw] sm:max-w-[50vw] w-full max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle>Inspection du Texte Extrait (OCR)</DialogTitle>
            <DialogDescription>
              Visualisez le texte OCR brut et nettoyé pour diagnostiquer les erreurs d'extraction.
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
                  {cleanedOcrText || "Aucun texte nettoyé disponible."}
                </pre>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="raw" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] w-full rounded-md border p-4 bg-muted/20">
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                  {selected?.rawOcrText || "Aucun texte brut disponible."}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteBatchId !== null} onOpenChange={(open) => { if (!open) setDeleteBatchId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de supprimer ce fichier ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmDelete() }}>
              Oui
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de supprimer ces fichiers ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmDeleteAll() }}>
              Oui
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Rapprochement */}
      <Dialog open={rapprochementOpen} onOpenChange={setRapprochementOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* En-tête */}
          <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-sky-50 to-white">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 shrink-0">
                <Link2 className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Rapprochement avec les relevés bancaires</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Correspondances entre les transactions Centre Monétique et les relevés bancaires enregistrés
                </p>
                {rapprochementResult?.batchRib && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-sky-100 border border-sky-200 px-2.5 py-1">
                    <CreditCard className="h-3.5 w-3.5 text-sky-600" />
                    <span className="font-mono text-xs font-medium text-sky-800">RIB : {rapprochementResult.batchRib}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {rapprochementLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
                <p className="text-sm text-muted-foreground">Recherche des correspondances en cours…</p>
              </div>
            ) : rapprochementResult ? (
              <div className="space-y-5">
                {/* Résumé compact */}
                <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 rounded-lg border text-sm">
                  <div>
                    <span className="text-muted-foreground">Transactions CM : </span>
                    <span className="font-bold text-slate-800">{rapprochementResult.totalCmTransactions}</span>
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div>
                    <span className="text-muted-foreground">Avec correspondance bancaire : </span>
                    <Badge className={rapprochementResult.matchedCount > 0
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                      : "bg-slate-100 text-slate-600"}>
                      {rapprochementResult.matchedCount}
                    </Badge>
                  </div>
                </div>

                {/* Tableau des correspondances */}
                {rapprochementResult.matchedCount === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground gap-3 rounded-xl border border-dashed bg-muted/20">
                    <AlertCircle className="h-12 w-12 opacity-30" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium">Aucune correspondance trouvée</p>
                      <p className="text-xs max-w-sm">
                        Vérifiez que le RIB du batch correspond exactement au RIB d'un relevé bancaire enregistré,
                        et que les dates d'opération coïncident.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-800">
                        {rapprochementResult.matchedCount > 0
                          ? `${rapprochementResult.matchedCount} transaction${rapprochementResult.matchedCount > 1 ? "s" : ""} CM avec correspondance bancaire`
                          : `${rapprochementResult.totalCmTransactions} transaction${rapprochementResult.totalCmTransactions > 1 ? "s" : ""} CM (aucune correspondance bancaire)`}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/20">
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600 border-r border-slate-200" colSpan={3}>Centre Monétique</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600 border-r border-slate-200" colSpan={3}>Détail transaction CM</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600" colSpan={3}>Relevé bancaire correspondant</th>
                          </tr>
                          <tr className="border-b bg-muted/30">
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600">Date</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600">Réf. CM</th>
                            <th className="p-2.5 text-right text-xs font-semibold text-slate-600 border-r border-slate-200">Montant CM (DH)</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600">STAN / Réf.</th>
                            <th className="p-2.5 text-center text-xs font-semibold text-slate-600">Type</th>
                            <th className="p-2.5 text-right text-xs font-semibold text-slate-600 border-r border-slate-200">Montant (DH)</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600">Relevé bancaire</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-slate-600">Libellé</th>
                            <th className="p-2.5 text-right text-xs font-semibold text-slate-600">Montant bancaire (DH)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const rows = rapprochementResult.matches
                            const rowspans: number[] = new Array(rows.length).fill(0)
                            const groupIndices: number[] = new Array(rows.length).fill(0)
                            let i = 0
                            let gIdx = 0
                            while (i < rows.length) {
                              const key = `${rows[i].date}|${rows[i].cmReference}|${rows[i].cmMontant}`
                              let j = i + 1
                              while (j < rows.length) {
                                const nextKey = `${rows[j].date}|${rows[j].cmReference}|${rows[j].cmMontant}`
                                if (nextKey !== key) break
                                groupIndices[j] = gIdx
                                j++
                              }
                              groupIndices[i] = gIdx
                              rowspans[i] = j - i
                              gIdx++
                              i = j
                            }
                            return rows.map((match, idx) => (
                              <tr key={idx} className={`border-b transition-colors hover:bg-emerald-50/60 ${groupIndices[idx] % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                                {rowspans[idx] > 0 && (
                                  <>
                                    <td rowSpan={rowspans[idx]} className="p-2.5 font-mono text-xs whitespace-nowrap text-slate-700 align-top border-r">{match.date}</td>
                                    <td rowSpan={rowspans[idx]} className="p-2.5 font-mono text-xs text-slate-700 align-top border-r">{match.cmReference || "—"}</td>
                                    <td rowSpan={rowspans[idx]} className="p-2.5 text-right font-mono text-xs font-medium text-slate-800 align-top border-r border-slate-200">{match.cmMontant || "—"}</td>
                                  </>
                                )}
                                <td className="p-2.5 font-mono text-xs text-slate-700">
                                  {match.cmStan || "—"}
                                </td>
                                <td className="p-2.5 text-center text-xs font-medium text-slate-600">
                                  {match.cmType || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="p-2.5 text-right font-mono text-xs font-medium text-emerald-700 border-r border-slate-200">
                                  {match.cmMontantTransaction || <span className="text-slate-300">—</span>}
                                </td>
                                {rowspans[idx] > 0 && (
                                  <>
                                    <td rowSpan={rowspans[idx]} className="p-2.5 text-xs text-slate-600 align-top max-w-[160px]">
                                      {match.bankStatementName
                                        ? <span className="text-sky-700 font-medium break-words">{match.bankStatementName}</span>
                                        : <span className="text-slate-300 italic">Aucun relevé</span>}
                                    </td>
                                    <td rowSpan={rowspans[idx]} className="p-2.5 text-xs text-slate-600 align-top max-w-[180px]">
                                      {match.bankLibelle || <span className="text-slate-300">—</span>}
                                    </td>
                                    <td rowSpan={rowspans[idx]} className="p-2.5 text-right font-mono text-xs font-medium align-top">
                                      {match.bankMontant
                                        ? <span className="text-blue-700">{match.bankMontant}</span>
                                        : <span className="text-slate-300">—</span>}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
