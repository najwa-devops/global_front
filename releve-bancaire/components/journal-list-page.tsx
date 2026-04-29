"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Printer, Download, Eye } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import type { JournalEntryRow, JournalItem, JournalPeriod } from "@/releve-bancaire/types"
import { toast } from "sonner"

const ALL_PERIODS = "all"

function formatPeriodLabel(year: number, month: number) {
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date)
}

function fallbackFileName(statement: JournalItem) {
  const period = `${String(statement.year).padStart(4, "0")}-${String(statement.month).padStart(2, "0")}`
  return `journal_${period}_${statement.originalName || statement.filename}.csv`
}

function extractFilename(disposition?: string | null) {
  if (!disposition) return null
  const match = /filename=\"?([^\";]+)\"?/i.exec(disposition)
  return match?.[1] || null
}

export function JournalListPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<JournalItem[]>([])
  const [periods, setPeriods] = useState<JournalPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>(ALL_PERIODS)
  const [busy, setBusy] = useState<Record<number, "export" | "print" | null>>({})
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<JournalItem | null>(null)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entries, setEntries] = useState<JournalEntryRow[]>([])

  const periodOptions = useMemo(() => {
    return periods.map((p) => ({
      key: p.key,
      label: formatPeriodLabel(p.year, p.month),
    }))
  }, [periods])

  const loadPeriods = async () => {
    try {
      const data = await api.getJournalPeriods()
      setPeriods(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error loading journal periods:", error)
      toast.error("Impossible de charger les périodes")
    }
  }

  const loadJournals = async (period?: string) => {
    try {
      setLoading(true)
      const list = await api.getJournalList(period && period !== ALL_PERIODS ? period : undefined)
      setItems(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error("Error loading journal list:", error)
      toast.error("Impossible de charger la liste des journaux")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPeriods()
    loadJournals()
  }, [])

  useEffect(() => {
    loadJournals(selectedPeriod)
  }, [selectedPeriod])

  const handleExport = async (item: JournalItem) => {
    setBusy((prev) => ({ ...prev, [item.statementId]: "export" }))
    try {
      const response = await api.exportJournal(item.statementId)
      const blob = await response.blob()
      const filename = extractFilename(response.headers.get("content-disposition")) || fallbackFileName(item)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Export du journal terminé")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erreur lors de l'export du journal")
    } finally {
      setBusy((prev) => ({ ...prev, [item.statementId]: null }))
    }
  }

  const handlePrint = async (item: JournalItem) => {
    setBusy((prev) => ({ ...prev, [item.statementId]: "print" }))
    try {
      const response = await api.printJournal(item.statementId)
      const html = await response.text()
      const printWindow = window.open("", "_blank", "noopener,noreferrer")
      if (!printWindow) {
        toast.error("Impossible d'ouvrir la fenêtre d'impression")
        return
      }
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      toast.success("Impression lancée")
    } catch (error) {
      console.error("Print error:", error)
      toast.error("Erreur lors de l'impression du journal")
    } finally {
      setBusy((prev) => ({ ...prev, [item.statementId]: null }))
    }
  }

  const handleView = async (item: JournalItem) => {
    setSelectedItem(item)
    setDetailsOpen(true)
    setEntriesLoading(true)
    try {
      const data = await api.getJournalEntries(item.statementId)
      setEntries(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Load entries error:", error)
      toast.error("Impossible de charger le journal")
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Journal</CardTitle>
            <CardDescription>Simulation de Comptabilisation</CardDescription>
          </div>
          <div className="w-full md:w-64">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Toutes les périodes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PERIODS}>Toutes les périodes</SelectItem>
                {periodOptions.map((period) => (
                  <SelectItem key={period.key} value={period.key}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun journal disponible pour cette période.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Relevé</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Contenu</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const label = formatPeriodLabel(item.year, item.month)
                  const name = item.originalName || item.filename
                  const isExporting = busy[item.statementId] === "export"
                  const isPrinting = busy[item.statementId] === "print"
                  return (
                    <TableRow key={item.statementId}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>{label}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(item)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Voir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(item)}
                          disabled={isExporting || isPrinting}
                          className="gap-2"
                        >
                          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          Exporter
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrint(item)}
                          disabled={isExporting || isPrinting}
                          className="gap-2"
                        >
                          {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                          Imprimer
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Simulation de Comptabilisation</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="text-sm text-muted-foreground mb-4">
              {selectedItem.originalName || selectedItem.filename} • {formatPeriodLabel(selectedItem.year, selectedItem.month)}
            </div>
          )}
          {entriesLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune écriture comptable disponible.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Mois</TableHead>
                  <TableHead>Nmois</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Journal</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Débit</TableHead>
                  <TableHead>Crédit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow key={`${entry.numero}-${index}`}>
                    <TableCell>{entry.numero}</TableCell>
                    <TableCell>{entry.mois}</TableCell>
                    <TableCell>{entry.nmois}</TableCell>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{entry.journal}</TableCell>
                    <TableCell>{entry.compte}</TableCell>
                    <TableCell className="max-w-[320px] truncate" title={entry.libelle}>{entry.libelle}</TableCell>
                    <TableCell>{entry.debit?.toFixed ? entry.debit.toFixed(2) : entry.debit}</TableCell>
                    <TableCell>{entry.credit?.toFixed ? entry.credit.toFixed(2) : entry.credit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
