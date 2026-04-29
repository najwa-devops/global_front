import type { DynamicInvoice } from "./types";

const normalizeText = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const normalizeInvoiceFileName = (value: unknown): string =>
  normalizeText(value);

export const getInvoiceNumberValue = (invoice: DynamicInvoice): string =>
  normalizeText(
    invoice.fields.find((field) => field.key === "invoiceNumber")?.value || "",
  );

export const hasDuplicateInvoiceName = (
  invoices: DynamicInvoice[],
  fileName: string,
  excludedInvoiceId?: number,
): boolean => {
  const normalizedFileName = normalizeInvoiceFileName(fileName);
  if (!normalizedFileName) return false;

  return invoices.some((invoice) => {
    if (excludedInvoiceId && invoice.id === excludedInvoiceId) return false;

    const candidates = [
      invoice.filename,
      invoice.originalName,
      invoice.filePath,
    ].map(normalizeInvoiceFileName);

    return candidates.includes(normalizedFileName);
  });
};

export const hasDuplicateInvoiceNumber = (
  invoices: DynamicInvoice[],
  invoice: DynamicInvoice,
): boolean => {
  const currentNumber = getInvoiceNumberValue(invoice);
  if (!currentNumber) return false;

  return invoices.some((candidate) => {
    if (candidate.id === invoice.id) return false;
    return getInvoiceNumberValue(candidate) === currentNumber;
  });
};

