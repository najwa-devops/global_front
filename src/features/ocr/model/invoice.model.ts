import { api } from "@/lib/api";
import { dynamicInvoiceDtoToLocal } from "@/lib/utils";
import type { DynamicInvoice, LocalTemplate } from "@/lib/types";

export async function fetchInvoiceById(id: number): Promise<DynamicInvoice> {
  const dto = await api.getInvoiceById(id);
  return dynamicInvoiceDtoToLocal(dto);
}

export async function fetchInvoiceTemplates(): Promise<LocalTemplate[]> {
  try {
    const templateDtos = await api.getAllTemplates();
    return templateDtos as unknown as LocalTemplate[];
  } catch (error: any) {
    const status = Number(error?.status);
    if (status === 401 || status === 403) {
      // Some roles cannot access templates; OCR page should still load invoice data.
      return [];
    }
    throw error;
  }
}
