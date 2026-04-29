"use client";

import { Suspense, useEffect, useState } from "react";
import { UploadPage } from "@/components/upload-page";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

type OcrMode = "OCR_SCAN" | "EVOLEO_AI";

const OCR_MODE_STORAGE_KEY = "achat_ocr_mode";
const DEFAULT_OCR_MODE: OcrMode = "OCR_SCAN";

function getCurrentDossierIdState(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const keys = ["currentDossierId", "selectedDossierId", "dossierId"];
  for (const key of keys) {
    const local = Number(window.localStorage.getItem(key));
    if (Number.isFinite(local) && local > 0) return local;
    const session = Number(window.sessionStorage.getItem(key));
    if (Number.isFinite(session) && session > 0) return session;
  }
  return undefined;
}

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [ocrMode, setOcrMode] = useState<OcrMode>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_OCR_MODE;
    }
    const storedMode = window.localStorage.getItem(OCR_MODE_STORAGE_KEY);
    return storedMode === "EVOLEO_AI" ? "EVOLEO_AI" : DEFAULT_OCR_MODE;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OCR_MODE_STORAGE_KEY, ocrMode);
    }
  }, [ocrMode]);

  const resolveDossierId = (): number | undefined => {
    const fromQuery = Number(searchParams.get("dossierId"));
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;

    if (typeof window !== "undefined") {
      const fromState = getCurrentDossierIdState();
      if (typeof fromState === "number" && fromState > 0) return fromState;
    }

    return undefined;
  };

  const handleUpload = async (
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void,
  ) => {
    const dossierId = resolveDossierId();
    if (!dossierId) {
      const message = "Dossier requis: ouvrez un dossier avant l'upload.";
      toast.error(message);
      throw new Error(message);
    }

    if (ocrMode === "EVOLEO_AI") {
      // Evoleo Intelligent: JS InvoiceExtractor via Next.js API route (no direct DB)
      files.forEach((_, index) => onProgress?.(index, 15));

      let successCount = 0;
      let errorCount = 0;
      const failed: { fileIndex: number; error?: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("dossierId", String(dossierId));

          const response = await fetch("/api/achat/alpha", {
            method: "POST",
            body: fd,
            credentials: "include",
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: "Erreur inconnue" }));
            failed.push({ fileIndex: i, error: err?.error || "Erreur lors de l'upload" });
            errorCount++;
            onProgress?.(i, 0);
          } else {
            successCount++;
            onProgress?.(i, 100);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Erreur lors de l'upload";
          failed.push({ fileIndex: i, error: msg });
          errorCount++;
          onProgress?.(i, 0);
        }
      }

      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} fichier(s) uploadé(s) avec succès`);
        router.push("/achat/invoices");
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(
          `${successCount} succès, ${errorCount} erreur(s). Les fichiers valides ont été uploadés.`,
        );
        router.push("/achat/invoices");
      } else {
        const firstError = failed[0]?.error || "Échec de l'upload: aucun fichier n'a été traité.";
        toast.error(firstError);
      }

      return { failed };
    }

    // Standard OCR_SCAN path
    files.forEach((_, index) => onProgress?.(index, 15));

    try {
      const batchResult = await api.uploadInvoicesBatch(files, dossierId, "DEFAULT");

      const failed: { fileIndex: number; error?: string }[] = [];
      batchResult.results.forEach((item, index) => {
        if (item.status === "error") {
          failed.push({
            fileIndex: index,
            error: item.error || "Erreur lors de l'upload",
          });
        }
      });

      batchResult.results.forEach((item, index) => {
        onProgress?.(index, item.status === "success" ? 100 : 0);
      });

      if (batchResult.successCount > 0 && batchResult.errorCount === 0) {
        toast.success(`${batchResult.successCount} fichier(s) uploadé(s) avec succès`);
        router.push("/achat/invoices");
      } else if (batchResult.successCount > 0 && batchResult.errorCount > 0) {
        toast.warning(
          `${batchResult.successCount} succès, ${batchResult.errorCount} erreur(s). Les fichiers valides ont été uploadés.`,
        );
        router.push("/achat/invoices");
      } else {
        const firstError =
          failed[0]?.error || "Échec de l'upload: aucun fichier n'a été traité.";
        toast.error(firstError);
      }

      return { failed };
    } catch (batchError) {
      // Fallback mode: if batch endpoint fails (e.g. HTTP 500), upload files one by one.
      const failed: { fileIndex: number; error?: string }[] = [];
      let successCount = 0;

      for (let i = 0; i < files.length; i++) {
        try {
          await api.uploadInvoice(files[i], dossierId, "DEFAULT");
          successCount++;
          onProgress?.(i, 100);
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Erreur lors de l'upload unitaire";
          failed.push({ fileIndex: i, error: msg });
          onProgress?.(i, 0);
        }
      }

      if (successCount > 0 && failed.length === 0) {
        toast.success(`${successCount} fichier(s) uploadé(s) avec succès (mode fallback)`);
        router.push("/achat/invoices");
      } else if (successCount > 0) {
        toast.warning(
          `${successCount} succès, ${failed.length} erreur(s). Upload poursuivi en mode fallback.`,
        );
        router.push("/achat/invoices");
      } else {
        const firstError = failed[0]?.error || "Échec de l'upload OCR";
        toast.error(firstError);
      }

      return { failed };
    }
  };

  return (
    <UploadPage
      onUpload={handleUpload}
      onViewInvoice={(inv) =>
        router.push(
          inv.dossierId
            ? `/achat/ocr/${inv.id}?dossierId=${inv.dossierId}`
            : `/achat/ocr/${inv.id}`,
        )
      }
      isDemoMode={false}
      headerActions={({ uploadFiles, pendingCount, isUploading }) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              htmlFor="achat-evoleo-ocr"
              className={`flex items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                ocrMode === "OCR_SCAN"
                  ? "border-emerald-300 bg-emerald-50/80 text-emerald-900 shadow-sm"
                  : "border-border bg-background/80 hover:bg-muted/40"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">Evoleo OCR</span>
              </div>
              <Switch
                id="achat-evoleo-ocr"
                checked={ocrMode === "OCR_SCAN"}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setOcrMode("OCR_SCAN");
                  } else if (ocrMode === "OCR_SCAN") {
                    setOcrMode("EVOLEO_AI");
                  }
                }}
              />
            </label>

            <label
              htmlFor="achat-evoleo-intelligent"
              className={`flex items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                ocrMode === "EVOLEO_AI"
                  ? "border-sky-300 bg-sky-50/80 text-sky-900 shadow-sm"
                  : "border-border bg-background/80 hover:bg-muted/40"
              }`}
            >
              <div className="flex flex-col pr-4">
                <span className="text-sm font-medium">Evoleo Intelligent</span>
              </div>
              <Switch
                id="achat-evoleo-intelligent"
                checked={ocrMode === "EVOLEO_AI"}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setOcrMode("EVOLEO_AI");
                  } else if (ocrMode === "EVOLEO_AI") {
                    setOcrMode("OCR_SCAN");
                  }
                }}
              />
            </label>
          </div>
          <Button
            onClick={uploadFiles}
            disabled={pendingCount === 0 || isUploading}
            className="w-full gap-2"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Upload en cours..." : `Uploader (${pendingCount})`}
          </Button>
        </div>
      )}
    />
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <UploadPageContent />
      </Suspense>
    </AuthGuard>
  );
}
