"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { exportInvoicesToCsv, invoiceDtoToLocal } from "@/lib/utils"
import { type LocalInvoice, type UserRole } from "@/lib/types"
import { AccountedInvoicesPage } from "@/components/accounted-invoices-page"
import type { BulkAction } from "@/components/invoice-table"
import { Clock, FileDown, Trash2, RefreshCw } from "lucide-react"

export default function Page() {
  const [invoices, setInvoices] = useState<LocalInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
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
      setInvoices(localInvoices.filter(inv => inv.accounted))
    } catch (err) {
      console.error("Error loading accounted invoices:", err)
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

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await api.deleteInvoice(invoiceId)
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId))
      toast.success("Invoice deleted")
    } catch (err) {
      toast.error("Delete failed")
    }
  }

  const handleBulkDelete = async (selected: LocalInvoice[]) => {
    try {
      const ids = selected.map((inv) => inv.id)
      const result = await api.bulkDeleteInvoices(ids)
      toast.success(`${result.successCount} invoice(s) deleted`)
      if (result.errorCount) {
        toast.error(`${result.errorCount} error(s)`)
      }
      await loadInvoices()
    } catch (err) {
      toast.error("Bulk delete failed")
    }
  }

  const handleBulkExport = (selected: LocalInvoice[]) => {
    exportInvoicesToCsv(selected, "accounted-invoices.csv")
    toast.success("CSV export completed")
  }

  const handleBulkRebuild = async (selected: LocalInvoice[]) => {
    if (selected.length === 0) return
    const results = await Promise.allSettled(
      selected.map((inv) => api.rebuildAccountingEntries(inv.id)),
    )
    const successCount = results.filter((r) => r.status === "fulfilled").length
    const errorCount = results.length - successCount
    if (successCount > 0) {
      toast.success(`${successCount} ecriture(s) reconstruite(s)`)
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) de reconstruction`)
    }
  }

  const handleRebuildSingle = async (invoice: LocalInvoice) => {
    try {
      const result = await api.rebuildAccountingEntries(invoice.id)
      toast.success(result.message || "Ecritures reconstruites")
    } catch (err: any) {
      toast.error(err?.message || "Erreur reconstruction ecritures")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const bulkActions: BulkAction[] = [
    {
      id: "bulk-rebuild",
      label: "Rebuild ecritures",
      icon: RefreshCw,
      onAction: handleBulkRebuild,
    },
    {
      id: "bulk-export",
      label: "Export CSV",
      icon: FileDown,
      onAction: handleBulkExport,
    },
  ]

  if (userRole !== "CLIENT") {
    bulkActions.push({
      id: "bulk-delete",
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      confirmMessage: (count) => `Delete ${count} invoice(s)?`,
      onAction: handleBulkDelete,
    })
  }

  return (
    <AccountedInvoicesPage
      invoices={invoices}
      filters={{ search: "", supplier: "", status: "all" }}
      onFiltersChange={() => {}}
      suppliers={suppliers}
      onView={(inv) => router.push(inv.dossierId ? `/ocr/${inv.id}?dossierId=${inv.dossierId}` : `/ocr/${inv.id}`)}
      onDelete={handleDeleteInvoice}
      onExport={(format) => toast.info(`${format.toUpperCase()} export coming soon`)}
      userRole={userRole || undefined}
      bulkActions={bulkActions}
      onRebuildAccounting={handleRebuildSingle}
    />
  )
}
