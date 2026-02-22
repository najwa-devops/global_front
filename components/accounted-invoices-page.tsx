"use client"

import { useMemo } from "react"
import type { ComponentProps } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpenCheck } from "lucide-react"
import { InvoiceTable } from "@/components/invoice-table"
import { InvoiceFilters, type FilterValues } from "@/components/invoice-filters"
import { StatsCards } from "@/components/stats-cards"
import type { LocalInvoice, UserRole } from "@/lib/types"

interface AccountedInvoicesPageProps {
  invoices: LocalInvoice[]
  filters: FilterValues
  onFiltersChange: (filters: FilterValues) => void
  suppliers: string[]
  onView: (invoice: LocalInvoice) => void
  onDelete: (invoiceId: number) => void
  onExport: (format: "csv" | "excel" | "pdf") => void
  bulkActions?: ComponentProps<typeof InvoiceTable>["bulkActions"]
  userRole?: UserRole
}

export function AccountedInvoicesPage({
  invoices,
  filters,
  onFiltersChange,
  suppliers,
  onView,
  onDelete,
  onExport,
  bulkActions,
  userRole,
}: AccountedInvoicesPageProps) {
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
      <Card className="border-emerald-500/50 bg-emerald-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <BookOpenCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Factures Comptabilisées</CardTitle>
              <CardDescription>
                {invoices.length} facture{invoices.length > 1 ? "s" : ""} comptabilisée{invoices.length > 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <StatsCards invoices={invoices} />

      <InvoiceFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        suppliers={suppliers}
        onExport={onExport}
      />

      {filteredInvoices.length > 0 ? (
        <InvoiceTable
          invoices={filteredInvoices}
          onView={onView}
          onProcessOcr={() => {}}
          onProcessInline={() => {}}
          onDelete={onDelete}
          userRole={userRole}
          itemsPerPage={10}
          bulkActions={bulkActions}
        />
      ) : (
        <Card className="border-border/50">
          <CardContent className="pt-16 pb-16 text-center">
            <BookOpenCheck className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="mt-6 text-lg font-medium">Aucune facture comptabilisée</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {invoices.length === 0
                ? "Aucune facture comptabilisée pour le moment"
                : "Aucune facture ne correspond à vos critères de recherche"
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
