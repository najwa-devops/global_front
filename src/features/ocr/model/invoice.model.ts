import { api } from "@/lib/api";
import { dynamicInvoiceDtoToLocal } from "@/lib/utils";
import type { DynamicInvoice, LocalTemplate } from "@/lib/types";

export async function fetchInvoiceById(id: number): Promise<DynamicInvoice> {
  const dto = await api.getInvoiceById(id);
  return dynamicInvoiceDtoToLocal(dto);
}

export async function fetchInvoiceTemplates(): Promise<LocalTemplate[]> {
  const templateDtos = await api.getAllTemplates();
  return templateDtos as unknown as LocalTemplate[];
}
