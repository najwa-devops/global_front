"use client"

import { useState, useEffect } from "react"
import { UploadedBankFilesPage } from "@/components/uploaded-bank-files-page"
import { api } from "@/lib/api"
import { LocalBankStatement } from "@/lib/types"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function BankListPage() {
    const [statements, setStatements] = useState<LocalBankStatement[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    const fetchStatements = async () => {
        try {
            const data = await api.getAllBankStatements("READY_TO_VALIDATE")
            setStatements(data)
        } catch (error) {
            console.error("Error fetching bank statements:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatements()
    }, [])

    const handleProcessAll = async () => {
        // Implement batch processing if supported
        for (const stmt of statements) {
            router.push(`/bank/ocr/${stmt.id}`)
            break; // For now, just go to the first one or implement a real batch logic
        }
    }

    const handleProcessSingle = async (statement: LocalBankStatement) => {
        router.push(`/bank/ocr/${statement.id}`)
    }

    const handleView = (statement: LocalBankStatement) => {
        router.push(`/bank/ocr/${statement.id}`)
    }

    const handleNavigateToDashboard = () => {
        router.push("/dashboard")
    }

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6">
            <UploadedBankFilesPage
                statements={statements}
                onProcessAll={handleProcessAll}
                onProcessSingle={handleProcessSingle}
                onView={handleView}
                onNavigateToDashboard={handleNavigateToDashboard}
            />
        </div>
    )
}
