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

const OCR_MODE_STORAGE_KEY = "vente_ocr_mode";
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
    try {
      const dossierId = resolveDossierId();
      if (!dossierId) {
        const message = "Dossier requis: ouvrez un dossier avant l'upload.";
        toast.error(message);
        throw new Error(message);
      }

      for (let index = 0; index < files.length; index++) {
        if (onProgress) onProgress(index, 20);
        await api.uploadSalesInvoice(
          files[index],
          dossierId,
          ocrMode === "EVOLEO_AI" ? "ALPHA_AGENT" : "DEFAULT",
        );
        if (onProgress) onProgress(index, 100);
      }

      toast.success(`${files.length} fichier(s) uploadé(s) avec succès`);
      if (user?.role === "CLIENT" || user?.role === "FOURNISSEUR") {
        router.push("/vente/invoices");
      } else {
        router.push("/vente/scanned");
      }
    } catch (err: any) {
      const message = err?.message || "Erreur lors de l'upload";
      if (message.includes("BUSINESS_EMPTY_FILE")) {
        toast.error(
          "Le fichier envoyé est vide. Veuillez sélectionner un fichier valide.",
        );
      } else if (message.includes("doublon par nom")) {
        toast.error("Facture déjà existe avec même nom");
        if (user?.role === "CLIENT" || user?.role === "FOURNISSEUR") {
          router.push("/vente/invoices");
        } else {
          router.push("/vente/scanned");
        }
      } else {
        toast.error(message);
      }
      throw err;
    }
  };

  return (
    <UploadPage
      onUpload={handleUpload}
      onViewInvoice={(inv) =>
        router.push(
          inv.dossierId
            ? `/vente/ocr/${inv.id}?dossierId=${inv.dossierId}`
            : `/vente/ocr/${inv.id}`,
        )
      }
      isDemoMode={false}
      headerActions={({ uploadFiles, pendingCount, isUploading }) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              htmlFor="vente-evoleo-ocr"
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
                id="vente-evoleo-ocr"
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
              htmlFor="vente-evoleo-intelligent"
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
                id="vente-evoleo-intelligent"
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
