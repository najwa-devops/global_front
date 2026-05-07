"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Loader2, Printer, Download, RefreshCw, BookOpen } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import type { JournalAllEntriesResponse, JournalEntryRow } from "@/releve-bancaire/types"
import { toast } from "sonner"

const ALL_YEARS = "all"
const ALL_JOURNALS = "all"

function formatNum(value: number | string | null | undefined): string {
  if (value == null) return "-"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return "-"
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

function formatCurrentDateTime(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date())
}

function getStoredDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined
  const stored = Number(localStorage.getItem("currentDossierId"))
  return Number.isFinite(stored) && stored > 0 ? stored : undefined
}

function extractFilename(disposition?: string | null): string | null {
  if (!disposition) return null
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return match?.[1] || null
}

export function JournalListPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<JournalAllEntriesResponse | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>(ALL_YEARS)
  const [selectedJournal, setSelectedJournal] = useState<string>(ALL_JOURNALS)
  const [printDate, setPrintDate] = useState<string>("")
  const [exporting, setExporting] = useState(false)
  const [printing, setPrinting] = useState(false)

  const dossierId = useMemo(() => getStoredDossierId(), [])

  const loadEntries = useCallback(async (year?: number) => {
    try {
      setLoading(true)
      const result = await api.getAllJournalEntries(dossierId, year)
      setData(result)
      setPrintDate(formatCurrentDateTime())
    } catch (error) {
      console.error("Error loading journal entries:", error)
      toast.error("Impossible de charger le journal comptable")
    } finally {
      setLoading(false)
    }
  }, [dossierId])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleYearChange = (value: string) => {
    setSelectedJournal(ALL_JOURNALS)
    setSelectedYear(value)
    const year = value !== ALL_YEARS ? parseInt(value) : undefined
    loadEntries(year)
  }

  const handleRefresh = () => {
    const year = selectedYear !== ALL_YEARS ? parseInt(selectedYear) : undefined
    loadEntries(year)
  }

  const filteredEntries: JournalEntryRow[] = useMemo(() => {
    if (!data?.entries) return []
    if (selectedJournal === ALL_JOURNALS) return data.entries
    return data.entries.filter((e) => e.journal === selectedJournal)
  }, [data, selectedJournal])

  const currentYearLabel = useMemo(() => {
    if (selectedYear !== ALL_YEARS) return selectedYear
    if (data?.availableYears?.length) return String(data.availableYears[0])
    return String(new Date().getFullYear())
  }, [selectedYear, data])

  const handleExport = async () => {
    setExporting(true)
    try {
      const year = selectedYear !== ALL_YEARS ? parseInt(selectedYear) : undefined
      const response = await api.exportAllJournal(dossierId, year)
      const blob = await response.blob()
      const filename =
        extractFilename(response.headers.get("content-disposition")) ||
        `journal_comptable_banque_${currentYearLabel}.csv`
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
      toast.success("Export du journal terminé")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erreur lors de l'export du journal")
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const year = selectedYear !== ALL_YEARS ? parseInt(selectedYear) : undefined
      const response = await api.printAllJournal(dossierId, year)
      const html = await response.text()
      // Use hidden iframe to avoid popup-blocker issues
      const iframe = document.createElement("iframe")
      iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0"
      document.body.appendChild(iframe)
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(html)
        doc.close()
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      }
      setTimeout(() => document.body.removeChild(iframe), 3000)
      toast.success("Impression lancée")
    } catch (error) {
      console.error("Print error:", error)
      toast.error("Erreur lors de l'impression du journal")
    } finally {
      setPrinting(false)
    }
  }

  const yearOptions = data?.availableYears ?? []
  const journalOptions = data?.availableJournals ?? []

  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Header card */}
      <Card className="border-border/50">
        <CardHeader className="py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Left: icon + title + count */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Journal Comptable Banque</h2>
                <p className="text-sm text-muted-foreground">
                  {data != null ? `${filteredEntries.length} écritures` : "Chargement…"}
                </p>
              </div>
            </div>

            {/* Middle: period badge + print date */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                className="border-primary/50 text-primary bg-primary/10 font-medium px-3 py-1"
              >
                Exercice {currentYearLabel}
              </Badge>
              {printDate && <span>Imprimé le {printDate}</span>}
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={printing || loading}
                className="gap-2"
              >
                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Imprimer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting || loading}
                className="gap-2"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exporter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters + Stats bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-lg border border-border/50 bg-card/50 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Résumé du journal
          </span>
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="h-8 w-28 bg-background text-sm">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_YEARS}>Toutes</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedJournal} onValueChange={setSelectedJournal}>
            <SelectTrigger className="h-8 w-28 bg-background text-sm">
              <SelectValue placeholder="Journal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_JOURNALS}>Tous</SelectItem>
              {journalOptions.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data && (
          <div className="flex items-center gap-5 text-sm flex-wrap">
            <span>
              <span className="text-muted-foreground">Débit: </span>
              <span className="font-semibold text-red-600">{data.totalDebit}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Crédit: </span>
              <span className="font-semibold text-green-700">{data.totalCredit}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Solde: </span>
              <span className={`font-semibold ${data.balanced ? "text-green-700" : "text-orange-600"}`}>
                {data.solde}
                {data.balanced && (
                  <span className="ml-1 text-xs font-normal text-green-600">(Equilibre)</span>
                )}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Entries table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Aucune écriture comptable disponible.
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-16 text-xs font-semibold uppercase tracking-wide">
                      Numéro
                    </TableHead>
                    <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide">
                      Date
                    </TableHead>
                    <TableHead className="w-20 text-xs font-semibold uppercase tracking-wide">
                      Journal
                    </TableHead>
                    <TableHead className="w-36 text-xs font-semibold uppercase tracking-wide">
                      N° Compte
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Libellé
                    </TableHead>
                    <TableHead className="w-32 text-right text-xs font-semibold uppercase tracking-wide">
                      Débit
                    </TableHead>
                    <TableHead className="w-32 text-right text-xs font-semibold uppercase tracking-wide">
                      Crédit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry, index) => {
                    const debit =
                      typeof entry.debit === "number" ? entry.debit : parseFloat(String(entry.debit))
                    const credit =
                      typeof entry.credit === "number" ? entry.credit : parseFloat(String(entry.credit))
                    const hasDebit = !isNaN(debit) && debit > 0
                    const hasCredit = !isNaN(credit) && credit > 0
                    const isEvenGroup = entry.numero % 2 === 0
                    return (
                      <TableRow
                        key={`${entry.numero}-${index}`}
                        className={`text-sm ${isEvenGroup ? "bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/60" : "hover:bg-muted/30"}`}
                      >
                        <TableCell className="text-muted-foreground font-medium">
                          {entry.numero}
                        </TableCell>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.journal}</TableCell>
                        <TableCell className="font-mono text-xs">{entry.compte}</TableCell>
                        <TableCell
                          className="max-w-[280px] truncate"
                          title={entry.libelle}
                        >
                          {entry.libelle}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            hasDebit ? "font-semibold text-red-600" : "text-muted-foreground"
                          }`}
                        >
                          {hasDebit ? formatNum(debit) : "-"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            hasCredit ? "font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          {hasCredit ? formatNum(credit) : "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
