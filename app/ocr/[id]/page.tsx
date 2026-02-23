"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { dynamicInvoiceDtoToLocal, toWorkflowStatus } from "@/lib/utils"
import { type DynamicInvoice, type LocalTemplate } from "@/lib/types"
import { OcrProcessingPage } from "@/components/ocr-processing-page"
import { Clock } from "lucide-react"
import { toast } from "sonner"

export default function Page() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const id = params.id ? Number(params.id) : null

    const [invoice, setInvoice] = useState<DynamicInvoice | null>(null)
    const [templates, setTemplates] = useState<LocalTemplate[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!id) return

        const queryDossierId = Number(searchParams.get("dossierId"))
        const hasQueryDossierId = Number.isFinite(queryDossierId) && queryDossierId > 0

        if (typeof window !== "undefined") {
            if (hasQueryDossierId) {
                localStorage.setItem("currentDossierId", String(queryDossierId))
            } else {
                const storedDossierId = Number(localStorage.getItem("currentDossierId"))
                const hasStoredDossierId = Number.isFinite(storedDossierId) && storedDossierId > 0
                if (!hasStoredDossierId) {
                    toast.error("Dossier requis: ouvrez un dossier avant d'acceder a la facture.")
                    router.push("/dossiers")
                    return
                }
            }
        }

        const loadData = async () => {
            try {
                setIsLoading(true)
                const [dto, templateDtos] = await Promise.all([
                    api.getInvoiceById(id),
                    api.getAllTemplates()
                ])
                setInvoice(dynamicInvoiceDtoToLocal(dto))
                setTemplates(templateDtos as any)
            } catch (err) {
                console.error("Error loading OCR data:", err)
                toast.error("Impossible de charger la facture")
                router.push("/invoices")
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [id, router, searchParams])

    const handleInvoiceSaved = (updatedInvoice: DynamicInvoice) => {
        setInvoice(updatedInvoice)
        if (toWorkflowStatus(updatedInvoice.status) === "VALIDATED") {
            toast.success("Facture validée")
            router.push("/validated")
        } else {
            toast.success("Modifications enregistrées")
        }
    }

    if (isLoading || !invoice) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Clock className="h-8 w-8 text-primary animate-spin" />
                <p className="mt-4 text-muted-foreground">Chargement de la facture...</p>
            </div>
        )
    }

    return (
        <OcrProcessingPage
            invoice={invoice}
            file={null}
            templates={templates}
            onBack={() => router.back()}
            onSave={handleInvoiceSaved}
            isDemoMode={false}
        />
    )
}
