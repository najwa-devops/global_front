import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { InvoiceExtractor } = require("../../../../lib/alpha.js");

const BACKEND_URL = (process.env.BACKEND_INTERNAL_URL || "http://localhost:8089").replace(/\/$/, "");

function pickFieldValue(items: Array<{ field: string; value: unknown }>, fieldName: string): string {
  if (!Array.isArray(items)) return "";
  const match = items.find((item) => item?.field === fieldName);
  return match ? String(match.value ?? "") : "";
}

function pickAlphaValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function toAmount(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).replace(",", ".").replace(/[^\d.-]/g, "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeIce(value: unknown): string {
  return String(value || "").replace(/\D/g, "").trim();
}

function collectIceCandidates(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
  const normalized = values
    .map((item) => normalizeIce(item))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function resolveCounterpartyIce(candidates: string[], dossierIce?: string | null): string {
  const normalizedDossierIce = normalizeIce(dossierIce);
  const preferred = candidates.filter((candidate) => candidate && candidate !== normalizedDossierIce);
  if (preferred.length > 0) {
    return preferred[0];
  }
  return candidates[0] || "";
}

async function fetchDossierIce(dossierId: FormDataEntryValue | null, cookieHeader: string): Promise<string> {
  if (!dossierId) return "";
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/settings/general-params?dossierId=${encodeURIComponent(String(dossierId))}`,
      { headers: { cookie: cookieHeader } },
    );
    if (!response.ok) return "";
    const payload = await response.json();
    return normalizeIce(payload?.params?.ice);
  } catch {
    return "";
  }
}

function resolveAmountsWithPriority(input: {
  amountHT?: unknown;
  tva?: unknown;
  amountTTC?: unknown;
}): { amountHT?: number; tva?: number; amountTTC?: number } {
  let ht = toAmount(input.amountHT);
  let tva = toAmount(input.tva);
  let ttc = toAmount(input.amountTTC);

  // Priority 1: TTC - TVA -> HT
  if (ttc != null && tva != null && ht == null) {
    const computed = round2(ttc - tva);
    if (computed > 0) ht = computed;
  }
  // Priority 2: TTC - HT -> TVA
  if (ttc != null && ht != null && tva == null) {
    const computed = round2(ttc - ht);
    if (computed >= 0) tva = computed;
  }
  // Priority 3: HT + TVA -> TTC
  if (ht != null && tva != null && ttc == null) {
    const computed = round2(ht + tva);
    if (computed > 0) ttc = computed;
  }

  return { amountHT: ht, tva, amountTTC: ttc };
}

async function bestEffortRollbackInvoice(
  invoiceId: number | undefined,
  dossierId: FormDataEntryValue | null,
  cookieHeader: string,
): Promise<void> {
  if (!invoiceId) return;
  const dossierQuery = dossierId ? `?dossierId=${encodeURIComponent(String(dossierId))}` : "";
  try {
    await fetch(`${BACKEND_URL}/api/dynamic-invoices/${invoiceId}${dossierQuery}`, {
      method: "DELETE",
      headers: { cookie: cookieHeader },
    });
  } catch {
    // no-op: rollback is best effort
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const dossierId = formData.get("dossierId");
    const cookieHeader = request.headers.get("cookie") || "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File requis" }, { status: 400 });
    }

    // Step 1: Get raw OCR text from Spring Boot /alpha (AdvancedOcrService)
    const alphaForm = new FormData();
    alphaForm.append("file", file, file.name);
    alphaForm.append("ocrMode", "EVOLEO_AI");
    alphaForm.append("useAlphaAgent", "true");

    const alphaResponse = await fetch(`${BACKEND_URL}/alpha`, {
      method: "POST",
      body: alphaForm,
    });

    let rawOcrText = "";
    if (alphaResponse.ok) {
      const contentType = alphaResponse.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await alphaResponse.json();
        if (Array.isArray(payload)) {
          rawOcrText = pickFieldValue(payload, "rawOcrText") || pickFieldValue(payload, "extractedText");
        } else {
          rawOcrText = String(payload?.rawOcrText || payload?.extractedText || "");
        }
      } else {
        rawOcrText = await alphaResponse.text();
      }
    }

    // Step 2: Run JS InvoiceExtractor on raw OCR text
    const extractor = new InvoiceExtractor();
    const alphaResult = extractor.extract(rawOcrText, {
      includeFeatures: true,
      includeDiagnostics: true,
    });

    // Step 3: Upload file to Spring Boot in ALPHA mode (creates DynamicInvoice)
    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);
    if (dossierId) uploadForm.append("dossierId", String(dossierId));
    uploadForm.append("engine", "ALPHA_AGENT");
    uploadForm.append("ocrMode", "EVOLEO_AI");
    uploadForm.append("useAlphaAgent", "true");

    const uploadResponse = await fetch(`${BACKEND_URL}/api/dynamic-invoices/upload`, {
      method: "POST",
      headers: { cookie: cookieHeader },
      body: uploadForm,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      return NextResponse.json(
        { error: `Upload Spring Boot échoué: ${errText}` },
        { status: uploadResponse.status },
      );
    }

    const savedInvoice = await uploadResponse.json();
    const invoiceId = savedInvoice?.id;

    // Step 4: Update invoice with JS-extracted fields via Spring Boot PUT
    if (invoiceId) {
      const fields: Record<string, unknown> = {
        extractionMethod: "ALPHA_AGENT",
        rawOcrText,
      };

      const normalizedAlpha = alphaResult as Record<string, unknown>;
      const backendFields = (savedInvoice?.fieldsData || {}) as Record<string, unknown>;
      const dossierIce = await fetchDossierIce(dossierId, cookieHeader);
      const alphaIceCandidates = collectIceCandidates(normalizedAlpha.ice ?? normalizedAlpha.supplierIce);
      const backendIceCandidates = collectIceCandidates(backendFields.ice);
      const iceCandidates = Array.from(new Set([...backendIceCandidates, ...alphaIceCandidates]));
      const resolvedIce = resolveCounterpartyIce(iceCandidates, dossierIce);

      const invoiceNumber = backendFields.invoiceNumber ?? pickAlphaValue(normalizedAlpha, ["numeroFacture", "invoiceNumber"]);
      const supplier = backendFields.supplier ?? pickAlphaValue(normalizedAlpha, ["fournisseur", "supplier"]);
      const invoiceDate = backendFields.invoiceDate ?? pickAlphaValue(normalizedAlpha, ["dateFacture", "invoiceDate"]);
      const amountHT = backendFields.amountHT ?? pickAlphaValue(normalizedAlpha, ["montantHt", "amountHT"]);
      const tva = backendFields.tva ?? pickAlphaValue(normalizedAlpha, ["tva"]);
      const amountTTC = backendFields.amountTTC ?? pickAlphaValue(normalizedAlpha, ["montantTtc", "amountTTC"]);
      const ice = resolvedIce || backendFields.ice || pickAlphaValue(normalizedAlpha, ["ice", "supplierIce"]);
      const ifNumber = backendFields.ifNumber ?? pickAlphaValue(normalizedAlpha, ["ifNumber", "if"]);
      const rcNumber = backendFields.rcNumber ?? pickAlphaValue(normalizedAlpha, ["rcNumber", "rc"]);
      const designation = backendFields.designation ?? pickAlphaValue(normalizedAlpha, ["designation", "object"]);
      const tvaRate = backendFields.tvaRate ?? pickAlphaValue(normalizedAlpha, ["tvaRate"]);
      const resolvedAmounts = resolveAmountsWithPriority({ amountHT, tva, amountTTC });

      if (invoiceNumber != null) fields.invoiceNumber = invoiceNumber;
      if (supplier != null) fields.supplier = supplier;
      if (invoiceDate != null) fields.invoiceDate = invoiceDate;
      if (resolvedAmounts.amountHT != null) fields.amountHT = resolvedAmounts.amountHT;
      if (resolvedAmounts.tva != null) fields.tva = resolvedAmounts.tva;
      if (resolvedAmounts.amountTTC != null) fields.amountTTC = resolvedAmounts.amountTTC;
      if (ice != null) fields.ice = ice;
      if (ifNumber != null) fields.ifNumber = ifNumber;
      if (rcNumber != null) fields.rcNumber = rcNumber;
      if (designation != null) fields.designation = designation;
      if (tvaRate != null) fields.tvaRate = tvaRate;

      const dossierIdParam = dossierId ? `?dossierId=${dossierId}` : "";
      const fieldsResponse = await fetch(
        `${BACKEND_URL}/api/dynamic-invoices/${invoiceId}/fields${dossierIdParam}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            cookie: cookieHeader,
          },
          body: JSON.stringify(fields),
        },
      );

      if (fieldsResponse.ok) {
        const updatedInvoice = await fieldsResponse.json();
        return NextResponse.json({
          success: true,
          invoice: updatedInvoice,
          alphaMeta: {
            confidence: alphaResult?.confidence || {},
            missingFields: alphaResult?.missingFields || [],
            lowConfidenceFields: alphaResult?.lowConfidenceFields || [],
            reviewRecommended: Boolean(alphaResult?.reviewRecommended),
            validationNotes: alphaResult?.validationNotes || [],
            diagnostics: alphaResult?.diagnostics || [],
            features: alphaResult?.features || {},
            extractionPipeline: "alpha-ocr-text-then-js-extractor",
          },
        });
      }

      const fieldsErrorText = await fieldsResponse.text();
      // Keep upload non-blocking: if post-upload enrichment fails (e.g. permissions),
      // keep the created invoice and return a warning instead of failing the whole upload.
      if (fieldsResponse.status === 401 || fieldsResponse.status === 403) {
        return NextResponse.json({
          success: true,
          invoice: savedInvoice,
          warning: "Invoice uploaded but alpha field enrichment is not allowed for current role",
          warningCode: "ALPHA_FIELDS_UPDATE_FORBIDDEN",
          alphaMeta: {
            confidence: alphaResult?.confidence || {},
            missingFields: alphaResult?.missingFields || [],
            lowConfidenceFields: alphaResult?.lowConfidenceFields || [],
            reviewRecommended: true,
            diagnostics: alphaResult?.diagnostics || [],
            features: alphaResult?.features || {},
            extractionPipeline: "alpha-ocr-text-uploaded-without-field-sync",
          },
        });
      }

      // Rollback only for server-side corruption risks.
      if ((fieldsResponse.status || 500) >= 500) {
        await bestEffortRollbackInvoice(invoiceId, dossierId, cookieHeader);
      }

      return NextResponse.json({
        success: true,
        invoice: savedInvoice,
        warning: `Invoice uploaded but field sync failed: ${fieldsErrorText}`,
        warningCode: "ALPHA_FIELDS_UPDATE_FAILED",
        alphaMeta: {
          confidence: alphaResult?.confidence || {},
          missingFields: alphaResult?.missingFields || [],
          lowConfidenceFields: alphaResult?.lowConfidenceFields || [],
          reviewRecommended: true,
          diagnostics: alphaResult?.diagnostics || [],
          features: alphaResult?.features || {},
          extractionPipeline: "alpha-ocr-text-uploaded-with-warning",
        },
      });
    }

    return NextResponse.json({
      success: true,
      invoice: savedInvoice,
      alphaMeta: {
        confidence: alphaResult?.confidence || {},
        missingFields: alphaResult?.missingFields || [],
        reviewRecommended: Boolean(alphaResult?.reviewRecommended),
        diagnostics: alphaResult?.diagnostics || [],
        features: alphaResult?.features || {},
        extractionPipeline: "alpha-ocr-text-only",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Alpha processing failed" },
      { status: 500 },
    );
  }
}
