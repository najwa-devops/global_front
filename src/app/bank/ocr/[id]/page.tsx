"use client"

import { useState, useEffect, use } from "react"
import { OcrProcessingBankPage } from "@/releve-bancaire/components/ocr-processing-bank-page"
import { api } from "@/lib/api"
import { BankStatementV2, LocalBankStatement } from "@/lib/types"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

interface PageProps {
    params: Promise<{ id: string }>
}


function toLocalStatement(data: BankStatementV2): LocalBankStatement {
    const normalizedStatus = (() => {
        const s = (data.status || "").toUpperCase()
        if (s === "COMPTABILISE" || s === "COMPTABILISÉ") return "COMPTABILISE" as const
        if (s === "VALIDATED" || s === "VALIDE") return "validated" as const
        if (s === "TREATED" || s === "TRAITE" || s === "READY_TO_VALIDATE" || s === "PRET_A_VALIDER") return "treated" as const
        if (s === "PROCESSING" || s === "EN_COURS") return "processing" as const
        if (s === "ERROR" || s === "ERREUR") return "error" as const
        return "pending" as const
    })()

    return {
        id: data.id,
        filename: data.originalName || data.filename,
        originalName: data.originalName || data.filename,
        filePath: data.filePath || "",
        fileSize: data.fileSize || 0,
        fileUrl: data.fileUrl,
        fields: [],
        status: normalizedStatus,
        isProcessing: normalizedStatus === "processing",
        statusCode: data.statusCode,
        bankName: data.bankName,
        rib: data.rib,
        month: data.month,
        year: data.year,
        rawOcrText: data.rawOcrText,
        cleanedOcrText: data.cleanedOcrText,
        accountedAt: data.accountedAt,
        accountedBy: data.accountedBy,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    }
}

export default function BankOcrPage({ params }: PageProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { id } = use(params)
    const [statement, setStatement] = useState<LocalBankStatement | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStatement = async () => {
            try {
                const data = await api.getBankStatementById(Number(id))
                setStatement(toLocalStatement(data))
            } catch (error) {
                console.error("Error fetching bank statement:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchStatement()
    }, [id])

    const handleBack = () => {
        const dossierId = Number(searchParams.get("dossierId"))
        if (Number.isFinite(dossierId) && dossierId > 0) {
            router.push(`/bank/list?dossierId=${dossierId}`)
            return
        }
        router.back()
    }

    const handleSave = async (updatedStatement: LocalBankStatement) => {
        try {
            await api.validateBankStatement(updatedStatement.id, updatedStatement.fields)
            router.push("/bank/list")
        } catch (error) {
            console.error("Error saving bank statement:", error)
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!statement) {
        const dossierId = Number(searchParams.get("dossierId"))
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <p className="text-lg font-medium">Relevé bancaire non trouvé</p>
                <button
                    onClick={() => {
                        if (Number.isFinite(dossierId) && dossierId > 0) {
                            router.push(`/bank/list?dossierId=${dossierId}`)
                            return
                        }
                        router.push("/bank/list")
                    }}
                    className="text-primary hover:underline"
                >
                    Retour à la liste
                </button>
            </div>
        )
    }

    return (
        <OcrProcessingBankPage
            statement={statement}
            file={null}
            onBack={handleBack}
            onSave={handleSave}
        />
    )
}
