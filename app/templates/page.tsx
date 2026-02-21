"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { dynamicInvoiceDtoToLocal } from "@/lib/utils"
import { type DynamicInvoice, type LocalTemplate } from "@/lib/types"
import { TemplatesInvoicesPage } from "@/components/templates-invoices-page"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock } from "lucide-react"

export default function Page() {
    const [invoices, setInvoices] = useState<DynamicInvoice[]>([])
    const [templates, setTemplates] = useState<LocalTemplate[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setIsLoading(true)
            const [invoiceDtos, templateDtos] = await Promise.all([
                api.getAllInvoices(),
                api.getAllTemplates()
            ])
            setInvoices(invoiceDtos.map(dynamicInvoiceDtoToLocal))
            setTemplates(templateDtos as any)
        } catch (err) {
            console.error("Error loading templates data:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdateTemplate = async (templateId: number, data: { templateName: string; supplierType: string }) => {
        try {
            await api.patchTemplate(templateId, data)
            await loadData()
            toast.success("Template mis à jour")
        } catch (error) {
            toast.error("Erreur mise à jour")
        }
    }

    const handleDeleteTemplate = async (templateId: number) => {
        try {
            await api.deactivateTemplate(templateId)
            await loadData()
            toast.success("Template supprimé")
        } catch (error) {
            toast.error("Erreur suppression")
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Clock className="h-8 w-8 text-primary animate-spin" />
                <p className="mt-4 text-muted-foreground">Chargement...</p>
            </div>
        )
    }

    return (
        <TemplatesInvoicesPage
            invoices={invoices}
            templates={templates as any}
            onView={(inv) => router.push(`/ocr/${inv.id}`)}
            onDelete={async (id) => {
                await api.deleteDynamicInvoice(id)
                await loadData()
            }}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
        />
    )
}
