import type { DynamicInvoice } from "@/lib/types";

export type DashboardFilters = {
  search: string;
  supplier: string;
  status: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
};

export function buildSupplierList(invoices: DynamicInvoice[]): string[] {
  const supplierSet = new Set<string>();

  invoices.forEach((inv) => {
    const supplier = inv.fields.find((f) => f.key === "supplier")?.value;
    if (supplier) supplierSet.add(String(supplier));
  });

  return Array.from(supplierSet);
}

export function filterDashboardInvoices(
  invoices: DynamicInvoice[],
  filters: DashboardFilters,
  toWorkflowStatus: (status?: string) => string,
): DynamicInvoice[] {
  return invoices.filter((invoice) => {
    if (invoice.accounted || invoice.accountedAt) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesFilename = invoice.filename.toLowerCase().includes(searchLower);
      const matchesNumber = String(
        invoice.fields.find((f) => f.key === "invoiceNumber")?.value || "",
      )
        .toLowerCase()
        .includes(searchLower);
      const matchesSupplier = String(
        invoice.fields.find((f) => f.key === "supplier")?.value || "",
      )
        .toLowerCase()
        .includes(searchLower);

      if (!matchesFilename && !matchesNumber && !matchesSupplier) return false;
    }

    if (filters.supplier && filters.supplier !== "all") {
      const supplier = invoice.fields.find((f) => f.key === "supplier")?.value;
      if (supplier !== filters.supplier) return false;
    }

    if (filters.status && filters.status !== "all") {
      if (toWorkflowStatus(invoice.status) !== String(filters.status).toUpperCase()) {
        return false;
      }
    }

    if (filters.dateFrom && invoice.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && invoice.createdAt > filters.dateTo) return false;

    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      const ttc = Number.parseFloat(
        String(invoice.fields.find((f) => f.key === "amountTTC")?.value || "0"),
      );
      if (filters.amountMin !== undefined && ttc < filters.amountMin) return false;
      if (filters.amountMax !== undefined && ttc > filters.amountMax) return false;
    }

    return true;
  });
}

export function countPendingInvoices(
  invoices: DynamicInvoice[],
  toWorkflowStatus: (status?: string) => string,
): number {
  return invoices.filter((inv) =>
    ["VERIFY", "READY_TO_TREAT", "READY_TO_VALIDATE", "REJECTED"].includes(
      toWorkflowStatus(inv.status),
    ),
  ).length;
}
