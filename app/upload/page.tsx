"use client"

import { UploadPage } from "@/components/upload-page"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/hooks/use-auth"

function UploadPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useAuth()

    const resolveDossierId = (): number | undefined => {
        const fromQuery = Number(searchParams.get("dossierId"))
        if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery

        if (typeof window !== "undefined") {
            const fromStorage = Number(localStorage.getItem("currentDossierId"))
            if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage
        }

        return undefined
    }

    const handleUpload = async (files: File[]) => {
        try {
            const dossierId = resolveDossierId()

            if (user?.role !== "ADMIN" && !dossierId) {
                toast.error("Dossier requis: ouvrez un dossier avant l'upload.")
                return
            }

            const uploadedIds: number[] = []
            for (const file of files) {
                const response = await api.uploadInvoice(file, dossierId)
                uploadedIds.push(response.id)
            }

            toast.success(`${files.length} fichier(s) uploadé(s) avec succès`)
            router.push("/invoices")
        } catch (err: any) {
            const message = err?.message || "Erreur lors de l'upload"
            if (message.includes("BUSINESS_EMPTY_FILE")) {
                toast.error("Le fichier envoyé est vide. Veuillez sélectionner un fichier valide.")
            } else {
                toast.error(message)
            }
        }
    }

    return (
        <UploadPage
            onUpload={handleUpload}
            onViewInvoice={(inv) => router.push(inv.dossierId ? `/ocr/${inv.id}?dossierId=${inv.dossierId}` : `/ocr/${inv.id}`)}
            isDemoMode={false}
        />
    )
}

export default function Page() {
    return (
        <AuthGuard>
            <UploadPageContent />
        </AuthGuard>
    )
}
