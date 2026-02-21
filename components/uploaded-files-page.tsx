"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatFileSize, formatDate, formatAmount } from "@/lib/utils"
import { Eye, Scan, Loader2, CheckCircle2, Zap, FileText, Sparkles } from "lucide-react"
import type { DynamicInvoice, DynamicInvoiceField } from "@/lib/types"
import { toast } from "sonner"

interface UploadedFilesPageProps {
  invoices: DynamicInvoice[]
  onProcessAll: () => Promise<void>
  onProcessSingle: (invoice: DynamicInvoice) => Promise<void>
  onView: (invoice: DynamicInvoice) => void
  onNavigateToDashboard: () => void
}

export function UploadedFilesPage({
  invoices,
  onProcessAll,
  onProcessSingle,
  onView,
  onNavigateToDashboard,
}: UploadedFilesPageProps) {
  const [isProcessingAll, setIsProcessingAll] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())

  // --- HELPERS (Copied from InvoiceTable for consistency) ---
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30">En attente</Badge>
      case "processing":
        return <Badge className="bg-sky-400/10 text-sky-400 border-sky-400/30">En cours</Badge>
      case "treated":
        return <Badge className="bg-purple-400/10 text-purple-400 border-purple-400/30">OCR terminé</Badge>
      case "ready_to_validate":
        return <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/30">Prêt à valider</Badge>
      case "validated":
        return <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30">Validé</Badge>
      default:
        return <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30">En attente</Badge>
    }
  }

  const getTemplateBadge = (invoice: DynamicInvoice) => {
    if (invoice.templateId) {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 w-fit">
            <Zap className="h-3 w-3" />
            Template
          </Badge>
        </div>
      )
    }
    return (
      <Badge variant="outline" className="gap-1 w-fit">
        <Sparkles className="h-3 w-3" />
        Nouveau
      </Badge>
    )
  }

  const getInvoiceNumber = (invoice: DynamicInvoice): string => {
    const numField = invoice.fields.find((f: DynamicInvoiceField) => f.key === "invoiceNumber")
    return numField?.value ? String(numField.value) : "-"
  }

  const getSupplier = (invoice: DynamicInvoice): string => {
    const supplierField = invoice.fields.find((f: DynamicInvoiceField) => f.key === "supplier")
    return supplierField?.value ? String(supplierField.value) : "-"
  }

  const getInvoiceDate = (invoice: DynamicInvoice): string => {
    const dateField = invoice.fields.find((f: DynamicInvoiceField) => f.key === "invoiceDate")
    if (dateField?.value) return String(dateField.value)
    return formatDate(invoice.createdAt)
  }

  const getHT = (invoice: DynamicInvoice): string => {
    const htField = invoice.fields.find((f: DynamicInvoiceField) => f.key === "amountHT")
    return htField?.value ? formatAmount(htField.value) : "-"
  }

  const getTVA = (invoice: DynamicInvoice): string => {
    const tvaField = invoice.fields.find((f: DynamicInvoiceField) => f.key === "tva")
    return tvaField?.value ? formatAmount(tvaField.value) : "-"
  }

  const getTTC = (invoice: DynamicInvoice): string => {
    const ttcField = invoice.fields.find((f: DynamicInvoiceField) => f.key === "amountTTC")
    return ttcField?.value ? formatAmount(ttcField.value) : "-"
  }

  const getTierAccount = (invoice: DynamicInvoice): string => {
    if (invoice.tier) {
      if (invoice.tier.tierNumber) return invoice.tier.tierNumber
      if (invoice.tier.collectifAccount) return invoice.tier.collectifAccount
    }
    const field = invoice.fields.find(f => f.key === "tierNumber" || f.key === "collectifAccount")
    return field?.value ? String(field.value) : "-"
  }

  const getChargeAccount = (invoice: DynamicInvoice): string => {
    if (invoice.tier?.defaultChargeAccount) return invoice.tier.defaultChargeAccount
    const field = invoice.fields.find(f => f.key === "chargeAccount")
    return field?.value ? String(field.value) : "-"
  }

  const getTvaAccount = (invoice: DynamicInvoice): string => {
    if (invoice.tier?.tvaAccount) return invoice.tier.tvaAccount
    const field = invoice.fields.find(f => f.key === "tvaAccount")
    return field?.value ? String(field.value) : "-"
  }
  // -------------------------------------------------------------


  const handleProcessAll = async () => {
    setIsProcessingAll(true)
    try {
      await onProcessAll()
      toast.success(`${invoices.length} facture(s) traitée(s) avec succès`)
    } catch (error) {
      toast.error("Erreur lors du traitement")
    } finally {
      setIsProcessingAll(false)
    }
  }

  const handleProcessSingle = async (invoice: DynamicInvoice) => {
    setProcessingIds(prev => new Set(prev).add(invoice.id))
    try {
      await onProcessSingle(invoice)
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(invoice.id)
        return newSet
      })
    }
  }

  const allProcessed = invoices.every(inv => inv.status !== "pending")

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Fichiers Uploadés</CardTitle>
                <CardDescription>
                  {invoices.length} fichier{invoices.length > 1 ? "s" : ""} prêt{invoices.length > 1 ? "s" : ""} à être traité{invoices.length > 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {allProcessed ? (
                <Button className="gap-2" onClick={onNavigateToDashboard}>
                  <CheckCircle2 className="h-5 w-5" />
                  Voir le Tableau de Bord
                </Button>
              ) : (
                <Button
                  className="gap-2"
                  onClick={handleProcessAll}
                  disabled={isProcessingAll || invoices.length === 0}
                >
                  {isProcessingAll ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      Traiter Tout ({invoices.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tableau des fichiers */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-16">Aperçu</TableHead>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Date Facture</TableHead>
                  <TableHead>HT</TableHead>
                  <TableHead>TVA</TableHead>
                  <TableHead>TTC</TableHead>
                  <TableHead>Compte Tier</TableHead>
                  <TableHead>Cpt HT</TableHead>
                  <TableHead>Cpt TVA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const isProcessing = processingIds.has(invoice.id) || invoice.isProcessing
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(invoice.filename)

                  return (
                    <TableRow key={invoice.id} className="border-border/50">
                      <TableCell>
                        <div className="h-12 w-12 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center overflow-hidden relative">
                          {isProcessing && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}
                          {invoice.fileUrl && isImage ? (
                            <img
                              src={invoice.fileUrl}
                              alt={invoice.filename}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">{getInvoiceNumber(invoice)}</TableCell>
                      <TableCell>{getSupplier(invoice)}</TableCell>
                      <TableCell className="text-muted-foreground">{getInvoiceDate(invoice)}</TableCell>
                      <TableCell className="font-semibold">{getHT(invoice)}</TableCell>
                      <TableCell className="font-semibold text-muted-foreground">{getTVA(invoice)}</TableCell>
                      <TableCell className="font-bold text-primary">{getTTC(invoice)}</TableCell>
                      <TableCell className="text-xs font-mono">{getTierAccount(invoice)}</TableCell>
                      <TableCell className="text-xs font-mono">{getChargeAccount(invoice)}</TableCell>
                      <TableCell className="text-xs font-mono">{getTvaAccount(invoice)}</TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(invoice)}
                            className="h-8 px-2"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleProcessSingle(invoice)}
                              disabled={isProcessing}
                              className="h-8 px-2"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Scan className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}