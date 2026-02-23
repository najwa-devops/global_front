"use client"

import { useState, useEffect, useMemo } from "react"
import { api } from "@/lib/api"
import { invoiceDtoToLocal } from "@/lib/utils"
import { type LocalInvoice, type UserRole } from "@/lib/types"
import { InvoiceFilters, type FilterValues } from "@/components/invoice-filters"
import { InvoiceTable } from "@/components/invoice-table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Clock, CheckCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function ClientPendingPage() {
  const [invoices, setInvoices] = useState<LocalInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    supplier: "",
    status: "",
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: undefined,
    amountMax: undefined,
  })
  const router = useRouter()

  useEffect(() => {
    loadInvoices()
  }, [])

  useEffect(() => {
    api.getCurrentUser()
      .then((u) => setUserRole(u.role))
      .catch(() => setUserRole(null))
  }, [])

  const loadInvoices = async () => {
    try {
      setIsLoading(true)
      const dtos = await api.getAllInvoices()
      const localInvoices = dtos.map(invoiceDtoToLocal)
      const pending = localInvoices.filter(inv => inv.status === "pending" && !inv.clientValidated)
      setInvoices(pending)
    } catch (err) {
      console.error("Error loading client pending invoices:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const suppliers = useMemo(() => {
    const supplierSet = new Set<string>()
    invoices.forEach((inv) => {
      const supplier = inv.fields.find((f) => f.key === "supplier")?.value
      if (supplier) supplierSet.add(String(supplier))
    })
    return Array.from(supplierSet)
  }, [invoices])

  const applyFilters = (invoicesList: LocalInvoice[]) => {
    return invoicesList.filter((invoice) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesFilename = invoice.filename.toLowerCase().includes(searchLower)
        const matchesNumber = String(invoice.fields.find((f) => f.key === "invoiceNumber")?.value || "")
          .toLowerCase()
          .includes(searchLower)
        const matchesSupplier = String(invoice.fields.find((f) => f.key === "supplier")?.value || "")
          .toLowerCase()
          .includes(searchLower)
        if (!matchesFilename && !matchesNumber && !matchesSupplier) return false
      }

      if (filters.supplier && filters.supplier !== "all") {
        const supplier = invoice.fields.find((f) => f.key === "supplier")?.value
        if (supplier !== filters.supplier) return false
      }

      if (filters.status && filters.status !== "all") {
        if (invoice.status !== filters.status) return false
      }

      if (filters.dateFrom && invoice.createdAt < filters.dateFrom) return false
      if (filters.dateTo && invoice.createdAt > filters.dateTo) return false

      if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
        const ttc = Number.parseFloat(String(invoice.fields.find((f) => f.key === "amountTTC")?.value || "0"))
        if (filters.amountMin !== undefined && ttc < filters.amountMin) return false
        if (filters.amountMax !== undefined && ttc > filters.amountMax) return false
      }
      return true
    })
  }

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteInvoice(invoiceId)
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId))
      toast.success("Facture supprimer")
    } catch (err) {
      toast.error("Erreur suppression")
    }
  }

  const handleClientValidate = async (invoice: LocalInvoice) => {
    try {
      toast.loading("Validation client en cours...", { id: `client-validate-${invoice.id}` })
      await api.clientValidateInvoice(invoice.id)
      await loadInvoices()
      toast.success("Facture validée par le client", { id: `client-validate-${invoice.id}` })
    } catch (err) {
      toast.error("Erreur validation client", { id: `client-validate-${invoice.id}` })
    }
  }

  const handleBulkClientValidate = async (selected: LocalInvoice[]) => {
    const toValidate = selected.filter((inv) => !inv.clientValidated)
    if (toValidate.length === 0) {
      toast.info("Toutes les factures sélectionnées sont déjà validées")
      return
    }
    try {
      const results = await Promise.allSettled(
        toValidate.map((inv) => api.clientValidateInvoice(inv.id))
      )
      const successCount = results.filter((r) => r.status === "fulfilled").length
      const errorCount = results.length - successCount
      if (successCount) {
        toast.success(`${successCount} facture(s) validée(s) par le client`)
      }
      if (errorCount) {
        toast.error(`${errorCount} erreur(s) de validation client`)
      }
      await loadInvoices()
    } catch (err) {
      toast.error("Erreur validation client en masse")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Factures En Attente</CardTitle>
              <CardDescription>
                {invoices.length} facture{invoices.length > 1 ? "s" : ""} en attente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <InvoiceFilters
        filters={filters}
        onFiltersChange={setFilters}
        suppliers={suppliers}
        onExport={() => { }}
      />

      <InvoiceTable
        invoices={applyFilters(invoices)}
        onView={(inv) => router.push(inv.dossierId ? `/ocr/${inv.id}?dossierId=${inv.dossierId}` : `/ocr/${inv.id}`)}
        onProcessOcr={(inv) => router.push(inv.dossierId ? `/ocr/${inv.id}?dossierId=${inv.dossierId}` : `/ocr/${inv.id}`)}
        onProcessInline={() => {
          toast.error("Traitement OCR indisponible pour le client")
        }}
        onDelete={handleDeleteInvoice}
        onClientValidate={handleClientValidate}
        userRole={userRole || undefined}
        columnPreset="client-pending"
        bulkActions={[
          {
            id: "bulk-client-validate",
            label: "Valider",
            icon: CheckCircle,
            confirmMessage: (count) => `Valider ${count} facture(s) ?`,
            onAction: handleBulkClientValidate,
            disabled: (selected) => selected.every((inv) => inv.clientValidated),
          },
        ]}
      />

      {invoices.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="pt-16 pb-16 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="mt-6 text-lg font-medium">Aucune facture en attente</h3>
            <Button className="mt-6 gap-2" onClick={() => router.push("/upload")}>
              <Upload className="h-4 w-4" />
              Uploader
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
