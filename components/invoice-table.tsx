"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileText, Eye, Scan, Trash2, ChevronLeft, ChevronRight, MoreHorizontal, Sparkles, Zap, CheckCircle, BookOpenCheck, RefreshCw } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import type { LocalInvoice, UserRole } from "@/lib/types"
import { formatAmount, formatDate } from "@/lib/utils"

export type BulkAction = {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
  onAction: (selected: LocalInvoice[]) => void | Promise<void>
  confirmMessage?: (count: number) => string
  disabled?: (selected: LocalInvoice[]) => boolean
}

interface InvoiceTableProps {
  invoices: LocalInvoice[]
  onView: (invoice: LocalInvoice) => void
  onProcessOcr: (invoice: LocalInvoice) => void
  onProcessInline: (invoice: LocalInvoice) => void
  onDelete: (invoiceId: number) => void
  onClientValidate?: (invoice: LocalInvoice) => void | Promise<void>
  onAccount?: (invoice: LocalInvoice) => void | Promise<void>
  onRebuildAccounting?: (invoice: LocalInvoice) => void | Promise<void>
  userRole?: UserRole
  itemsPerPage?: number
  bulkActions?: BulkAction[]
  columnPreset?: "default" | "client-pending"
}

export function InvoiceTable({
  invoices,
  onView,
  onProcessOcr,
  onDelete,
  onProcessInline,
  onClientValidate,
  onAccount,
  onRebuildAccounting,
  userRole,
  itemsPerPage = 10,
  bulkActions = [],
  columnPreset = "default"
}: InvoiceTableProps) {
  const isClient = userRole === "CLIENT"
  const isClientPendingView = columnPreset === "client-pending"
  const showSelection = !isClientPendingView
  const showBulkActions = !isClientPendingView && bulkActions.length > 0
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const totalPages = Math.ceil(invoices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedInvoices = invoices.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(invoices.map((inv) => inv.id))
      const next = new Set<number>()
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id)
        }
      })
      return next
    })
  }, [invoices])

  const selectedInvoices = useMemo(
    () => invoices.filter((inv) => selectedIds.has(inv.id)),
    [invoices, selectedIds],
  )

  const allSelected = invoices.length > 0 && selectedIds.size === invoices.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () => {
    setSelectedIds(() => {
      if (allSelected) {
        return new Set()
      }
      return new Set(invoices.map((inv) => inv.id))
    })
  }

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleBulkAction = async (action: BulkAction) => {
    if (selectedInvoices.length === 0) return
    if (action.confirmMessage) {
      const confirmed = confirm(action.confirmMessage(selectedInvoices.length))
      if (!confirmed) return
    }
    await action.onAction(selectedInvoices)
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20">
            En attente
          </Badge>
        )
      case "processing":
        return (
          <Badge className="bg-sky-400/10 text-sky-400 border-sky-400/30 hover:bg-sky-400/20">
            En cours
          </Badge>
        )
      case "treated":
        return (
          <Badge className="bg-purple-400/10 text-purple-400 border-purple-400/30 hover:bg-purple-400/20">
            Scanne terminé
          </Badge>
        )
      case "ready_to_validate":
        return (
          <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/30 hover:bg-blue-400/20">
            Prêt à valider
          </Badge>
        )
      case "validated":
        return (
          <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/20">
            Validé
          </Badge>
        )
      case "error":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">
            Erreur
          </Badge>
        )
      default:
        return (
          <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20">
            En attente
          </Badge>
        )
    }
  }

  const getStatusBadgeSingle = (invoice: LocalInvoice) => {
    if (invoice.accounted) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">
          Comptabilisee
        </Badge>
      )
    }
    if (invoice.status === "validated") {
      return (
        <Badge className="bg-purple-400/10 text-purple-500 border-purple-400/30 hover:bg-purple-400/20">
          Validee comptable
        </Badge>
      )
    }
    if (invoice.clientValidated) {
      return (
        <Badge className="bg-emerald-400/10 text-emerald-500 border-emerald-400/30 hover:bg-emerald-400/20">
          Validee client
        </Badge>
      )
    }
    return getStatusBadge(invoice.status)
  }

  const getTemplateBadge = (invoice: LocalInvoice) => {
    if (invoice.templateId) {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 gap-1 w-fit">
            <Zap className="h-3 w-3" />
            Template
          </Badge>
          {invoice.fields.find(f => f.key === "supplier")?.value && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {String(invoice.fields.find(f => f.key === "supplier")?.value)}
            </span>
          )}
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

  const getAvoirBadge = (invoice: LocalInvoice) => {
    if (!invoice.isAvoir) return null
    return (
      <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20">
        Avoir
      </Badge>
    )
  }

  const getInvoiceDate = (invoice: LocalInvoice): string => {
    const dateField = invoice.fields.find((f) => f.key === "invoiceDate")
    if (dateField?.value !== null && dateField?.value !== undefined) {
      const rawValue = String(dateField.value).trim()
      if (!rawValue) return formatDate(invoice.createdAt)

      // Keep OCR-friendly day/month formats as-is (e.g. 08/01/2026, 08-01-2026).
      if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(rawValue)) {
        return rawValue
      }

      const parsedDate = new Date(rawValue)
      if (!Number.isNaN(parsedDate.getTime())) {
        return formatDate(parsedDate)
      }

      // If extraction returned a non-ISO text date, show it instead of upload date.
      return rawValue
    }
    return formatDate(invoice.createdAt)
  }

  const getSupplier = (invoice: LocalInvoice): string => {
    const supplierField = invoice.fields.find((f) => f.key === "supplier")
    return supplierField?.value ? String(supplierField.value) : "-"
  }

  const getHT = (invoice: LocalInvoice): string => {
    const htField = invoice.fields.find((f) => f.key === "amountHT")
    return htField?.value ? formatAmount(htField.value) : "-"
  }

  const getTVA = (invoice: LocalInvoice): string => {
    const tvaField = invoice.fields.find((f) => f.key === "tva")
    return tvaField?.value ? formatAmount(tvaField.value) : "-"
  }

  const getTTC = (invoice: LocalInvoice): string => {
    const ttcField = invoice.fields.find((f) => f.key === "amountTTC")
    return ttcField?.value ? formatAmount(ttcField.value) : "-"
  }

  const getInvoiceNumber = (invoice: LocalInvoice): string => {
    const numField = invoice.fields.find((f) => f.key === "invoiceNumber")
    return numField?.value ? String(numField.value) : "-"
  }

  const getTierAccount = (invoice: LocalInvoice): string => {
    // Priorité au compte défini sur le Tier associé
    if (invoice.tier) {
      if (invoice.tier.tierNumber) {
        return invoice.tier.tierNumber
      }
      if (invoice.tier.collectifAccount) {
        return invoice.tier.collectifAccount
      }
    }
    // Sinon on cherche dans les champs extraits
    const field = invoice.fields.find(f => f.key === "tierNumber" || f.key === "collectifAccount")
    return field?.value ? String(field.value) : "-"
  }

  const getChargeAccount = (invoice: LocalInvoice): string => {
    if (invoice.tier?.defaultChargeAccount) return invoice.tier.defaultChargeAccount
    const field = invoice.fields.find(f => f.key === "chargeAccount")
    return field?.value ? String(field.value) : "-"
  }

  const getTvaAccount = (invoice: LocalInvoice): string => {
    if (invoice.tier?.tvaAccount) return invoice.tier.tvaAccount
    const field = invoice.fields.find(f => f.key === "tvaAccount")
    return field?.value ? String(field.value) : "-"
  }

  const isComptableScannedOrValidated = (invoice: LocalInvoice) =>
    invoice.status === "treated" ||
    invoice.status === "ready_to_validate" ||
    invoice.status === "validated"

  const handleDelete = (invoice: LocalInvoice) => {
    if (isClient && (invoice.clientValidated || isComptableScannedOrValidated(invoice))) {
      return
    }
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${invoice.filename}" ?`)) {
      return
    }
    onDelete(invoice.id)
  }

  const isImage = (filename: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              Factures
            </CardTitle>
            <CardDescription className="mt-1">
              {invoices.length} facture{invoices.length !== 1 ? "s" : ""} enregistrée{invoices.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {showBulkActions && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm text-muted-foreground">
                {selectedInvoices.length} sélectionnée{selectedInvoices.length !== 1 ? "s" : ""}
              </div>
              {bulkActions.map((action) => {
                const Icon = action.icon
                const disabled = action.disabled ? action.disabled(selectedInvoices) : selectedInvoices.length === 0
                return (
                  <Button
                    key={action.id}
                    variant={action.variant || "outline"}
                    size="sm"
                    onClick={() => handleBulkAction(action)}
                    disabled={disabled}
                    className="gap-2"
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {action.label}
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-foreground">Aucune facture</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              Commencez par uploader vos premières factures pour les traiter avec l'OCR.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    {showSelection && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={() => toggleAll()}
                          aria-label="Sélectionner toutes les factures"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-16 text-muted-foreground">Aperçu</TableHead>
                    {isClientPendingView ? (
                      <>
                        <TableHead className="text-muted-foreground">Date Facture</TableHead>
                        <TableHead className="text-muted-foreground">Statut</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-muted-foreground">N° Facture</TableHead>
                        <TableHead className="text-muted-foreground">Fournisseur</TableHead>
                        <TableHead className="text-muted-foreground">Date Facture</TableHead>
                        <TableHead className="text-muted-foreground">Montant HT</TableHead>
                        <TableHead className="text-muted-foreground">TVA</TableHead>
                        <TableHead className="text-muted-foreground">Montant TTC</TableHead>
                        <TableHead className="text-muted-foreground">Compte Tier</TableHead>
                        <TableHead className="text-muted-foreground">Cpt HT</TableHead>
                        <TableHead className="text-muted-foreground">Cpt TVA</TableHead>
                        <TableHead className="text-muted-foreground">Statut</TableHead>
                      </>
                    )}
                    <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice, index) => (
                    <TableRow
                      key={invoice.id}
                      className="border-border/50 cursor-pointer transition-colors hover:bg-accent/50 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => onView(invoice)}
                    >
                      {showSelection && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onCheckedChange={() => toggleRow(invoice.id)}
                            aria-label={`Sélectionner la facture ${invoice.id}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="h-12 w-12 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center overflow-hidden relative">
                          {invoice.isProcessing && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                          {invoice.fileUrl && isImage(invoice.filename) ? (
                            <img
                              src={invoice.fileUrl || "/placeholder.svg"}
                              alt={invoice.filename}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      {isClientPendingView ? (
                        <>
                          <TableCell className="text-muted-foreground">{getInvoiceDate(invoice)}</TableCell>
                          <TableCell>{getStatusBadgeSingle(invoice)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <span>{getInvoiceNumber(invoice)}</span>
                              {getAvoirBadge(invoice)}
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">{getSupplier(invoice)}</TableCell>
                          <TableCell className="text-muted-foreground">{getInvoiceDate(invoice)}</TableCell>
                          <TableCell className="font-semibold text-foreground">{getHT(invoice)}</TableCell>
                          <TableCell className="font-semibold text-muted-foreground">{getTVA(invoice)}</TableCell>
                          <TableCell className="font-semibold text-primary">{getTTC(invoice)}</TableCell>
                          <TableCell className="text-xs font-mono">{getTierAccount(invoice)}</TableCell>
                          <TableCell className="text-xs font-mono">{getChargeAccount(invoice)}</TableCell>
                          <TableCell className="text-xs font-mono">{getTvaAccount(invoice)}</TableCell>
                          <TableCell>{getStatusBadgeSingle(invoice)}</TableCell>
                        </>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => onView(invoice)} className="gap-2">
                                <Eye className="h-4 w-4" />
                                Voir détails
                              </DropdownMenuItem>
                              {!isClient && (
                                <DropdownMenuItem
                                  onClick={() => onProcessInline(invoice)}
                                  className="gap-2"
                                  disabled={invoice.isProcessing || invoice.status === "processing"}
                                >
                                  <Scan className="h-4 w-4" />
                                  {invoice.isProcessing ? "Traitement..." : "Traiter OCR"}
                                </DropdownMenuItem>
                              )}
                              {isClient && onClientValidate && (
                                <DropdownMenuItem
                                  onClick={() => onClientValidate(invoice)}
                                  className="gap-2"
                                  disabled={invoice.clientValidated}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  {invoice.clientValidated ? "Déjà validée" : "Valider"}
                                </DropdownMenuItem>
                              )}
                              {!isClient && onAccount && invoice.status === "validated" && !invoice.accounted && (
                                <DropdownMenuItem
                                  onClick={() => onAccount(invoice)}
                                  className="gap-2"
                                >
                                  <BookOpenCheck className="h-4 w-4" />
                                  Comptabiliser
                                </DropdownMenuItem>
                              )}
                              {!isClient && onRebuildAccounting && invoice.accounted && (
                                <DropdownMenuItem
                                  onClick={() => onRebuildAccounting(invoice)}
                                  className="gap-2"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Rebuild ecritures
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(invoice)}
                                className="gap-2 text-destructive focus:text-destructive"
                                disabled={isClient && (invoice.clientValidated || isComptableScannedOrValidated(invoice))}
                              >
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Affichage <span className="font-medium text-foreground">{startIndex + 1}</span>-<span className="font-medium text-foreground">{Math.min(startIndex + itemsPerPage, invoices.length)}</span> sur <span className="font-medium text-foreground">{invoices.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="bg-transparent border-border/50 hover:bg-accent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={currentPage === pageNum ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-transparent border-border/50 hover:bg-accent"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
