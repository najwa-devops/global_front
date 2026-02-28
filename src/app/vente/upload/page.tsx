"use client";

import { UploadPage } from "@/components/upload-page";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/hooks/use-auth";

function SalesUploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const resolveDossierId = (): number | undefined => {
    const fromQuery = Number(searchParams.get("dossierId"));
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;

    if (typeof window !== "undefined") {
      const fromStorage = Number(localStorage.getItem("currentDossierId"));
      if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
    }

    return undefined;
  };

  const handleUpload = async (files: File[]) => {
    try {
      const dossierId = resolveDossierId();

      if (user?.role !== "ADMIN" && !dossierId) {
        toast.error("Dossier requis: ouvrez un dossier avant l'upload.");
        return;
      }

      for (const file of files) {
        await api.uploadSalesInvoice(file, dossierId);
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
        toast.error("Le fichier envoyé est vide. Veuillez sélectionner un fichier valide.");
      } else {
        toast.error(message);
      }
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
    />
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <SalesUploadPageContent />
    </AuthGuard>
  );
}
