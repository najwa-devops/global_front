"use client";

import { AlertCircle, Clock } from "lucide-react";
import { StatsCards } from "@/components/stats-cards";
import { InvoiceFilters } from "@/components/invoice-filters";
import { InvoiceTable } from "@/components/invoice-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardViewModel } from "@/src/features/dashboard/viewmodel/useDashboardViewModel";

export default function DashboardPageView() {
  const {
    invoices,
    visibleInvoices,
    isLoading,
    filters,
    suppliers,
    pendingCount,
    setFilters,
    openInvoiceOcr,
    handleProcessInline,
    handleDeleteInvoice,
    goInvoices,
  } = useDashboardViewModel();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsCards invoices={invoices} />

      {pendingCount > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  {pendingCount} facture{pendingCount > 1 ? "s" : ""} en attente
                </p>
                <Button
                  variant="link"
                  className="h-auto p-0 text-amber-700 dark:text-amber-300"
                  onClick={goInvoices}
                >
                  Voir les factures -&gt;
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <InvoiceFilters
        filters={filters as any}
        onFiltersChange={setFilters as any}
        suppliers={suppliers}
        onExport={() => {}}
      />

      <InvoiceTable
        invoices={visibleInvoices}
        onView={openInvoiceOcr}
        onProcessOcr={openInvoiceOcr}
        onProcessInline={handleProcessInline}
        onDelete={handleDeleteInvoice}
      />
    </div>
  );
}
