import { api } from "@/lib/api";
import { salesInvoiceDtoToLocal } from "@/lib/utils";
import type { DynamicInvoice } from "@/lib/types";

export async function fetchSalesInvoiceById(id: number): Promise<DynamicInvoice> {
  const dto = await api.getSalesInvoiceById(id);
  return salesInvoiceDtoToLocal(dto);
}

export async function fetchSalesInvoicesByDossier(
  dossierId: number,
  status?: string,
): Promise<DynamicInvoice[]> {
  const dtos = await api.getSalesInvoicesByDossier(dossierId, status);
  return dtos.map(salesInvoiceDtoToLocal);
}
