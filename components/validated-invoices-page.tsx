"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"
import { InvoiceTable } from "@/components/invoice-table"
import { InvoiceFilters, type FilterValues } from "@/components/invoice-filters"
import { StatsCards } from "@/components/stats-cards"
import type { DynamicInvoice } from "@/lib/types"

interface ValidatedInvoicesPageProps {
  invoices: DynamicInvoice[] // ← Déjà filtrées (uniquement validées)
  filters: FilterValues
  onFiltersChange: (filters: FilterValues) => void
  suppliers: string[]
  onView: (invoice: DynamicInvoice) => void
  onDelete: (invoiceId: number) => void
  onAccount: (invoice: DynamicInvoice) => void | Promise<void>
  onExport: (format: "csv" | "excel" | "pdf") => void
}

export function ValidatedInvoicesPage({
  invoices,
  filters,
  onFiltersChange,
  suppliers,
  onView,
  onDelete,
  onAccount,
  onExport,
}: ValidatedInvoicesPageProps) {
  //Appliquer les filtres de recherche
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesFilename = invoice.filename.toLowerCase().includes(searchLower)
        const matchesNumber = String(invoice.fields.find(f => f.key === "invoiceNumber")?.value || "")
          .toLowerCase()
          .includes(searchLower)
        const matchesSupplier = String(invoice.fields.find(f => f.key === "supplier")?.value || "")
          .toLowerCase()
          .includes(searchLower)
        if (!matchesFilename && !matchesNumber && !matchesSupplier) return false
      }

      if (filters.supplier && filters.supplier !== "all") {
        const supplier = invoice.fields.find(f => f.key === "supplier")?.value
        if (supplier !== filters.supplier) return false
      }

      if (filters.dateFrom && invoice.createdAt < filters.dateFrom) return false
      if (filters.dateTo && invoice.createdAt > filters.dateTo) return false

      if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
        const ttc = Number.parseFloat(String(invoice.fields.find(f => f.key === "amountTTC")?.value || "0"))
        if (filters.amountMin !== undefined && ttc < filters.amountMin) return false
        if (filters.amountMax !== undefined && ttc > filters.amountMax) return false
      }

      return true
    })
  }, [invoices, filters])

  return (
    <div className="space-y-6">
      {/*En-tête avec badge validé */}
      <Card className="border-emerald-500/50 bg-emerald-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Factures Validées</CardTitle>
              <CardDescription>
                {invoices.length} facture{invoices.length > 1 ? "s" : ""} validée{invoices.length > 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/*Statistiques des factures validées uniquement */}
      <StatsCards invoices={invoices} />

      {/*Filtres */}
      <InvoiceFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        suppliers={suppliers}
        onExport={onExport}
      />

      {/*Tableau des factures validées */}
      {filteredInvoices.length > 0 ? (
        <InvoiceTable
          invoices={filteredInvoices}
          onView={onView}
          onProcessOcr={() => { }} // Pas de traitement OCR pour les validées
          onProcessInline={() => { }} // Pas de traitement inline
          onDelete={onDelete}
          onAccount={onAccount}
          itemsPerPage={10}
        />
      ) : (
        <Card className="border-border/50">
          <CardContent className="pt-16 pb-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="mt-6 text-lg font-medium">Aucune facture validée</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {invoices.length === 0
                ? "Commencez par uploader et valider des factures"
                : "Aucune facture ne correspond à vos critères de recherche"
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
