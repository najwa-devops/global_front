"use client"

import { use, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import type { BankStatementV2 } from "@/lib/types"
import { BankStatementDetailModal } from "@/src/features/bank/view/BankStatementDetailModal"

interface PageProps {
    params: Promise<{ id: string }>
}

export default function BankStatementDetailPage({ params }: PageProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { id } = use(params)
    const [statement, setStatement] = useState<BankStatementV2 | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStatement = async () => {
            try {
                const data = await api.getBankStatementById(Number(id))
                setStatement(data)
            } catch (error) {
                console.error("Error fetching bank statement detail:", error)
                setStatement(null)
            } finally {
                setLoading(false)
            }
        }

        void fetchStatement()
    }, [id])

    const handleBack = () => {
        const dossierId = Number(searchParams.get("dossierId"))
        if (Number.isFinite(dossierId) && dossierId > 0) {
            router.push(`/bank/list?dossierId=${dossierId}`)
            return
        }
        router.push("/bank/list")
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!statement) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <p className="text-lg font-medium">Relevé bancaire non trouvé</p>
                <button
                    onClick={handleBack}
                    className="text-primary hover:underline"
                >
                    Retour à la liste
                </button>
            </div>
        )
    }

    return (
        <BankStatementDetailModal
            open={true}
            onOpenChange={() => {}}
            statement={statement}
            renderAsPage={true}
            onBack={handleBack}
        />
    )
}
