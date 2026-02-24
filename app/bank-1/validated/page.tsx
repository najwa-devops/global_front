"use client"

import { useState, useEffect } from "react"
import { ValidatedBankStatementsPage } from "@/components/validated-bank-statements-page"
import { api } from "@/lib/api"
import { LocalBankStatement } from "@/lib/types"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { FilterValues } from "@/components/invoice-filters"

export default function BankValidatedPage() {
    const [statements, setStatements] = useState<LocalBankStatement[]>([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState<FilterValues>({
        search: "",
        supplier: "",
        status: ""
    })
    const router = useRouter()

    const fetchStatements = async () => {
        try {
            const data = await api.getAllBankStatements("validated")
            setStatements(data)
        } catch (error) {
            console.error("Error fetching validated bank statements:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatements()
    }, [])

    const handleFiltersChange = (newFilters: FilterValues) => {
        setFilters(newFilters)
        // Implement filtering logic if supported by API or locally
    }

    const handleView = (statement: LocalBankStatement) => {
        router.push(`/bank/ocr/${statement.id}`)
    }

    const handleDelete = async (id: number) => {
        if (confirm("Êtes-vous sûr de vouloir supprimer ce relevé ?")) {
            await api.deleteBankStatement(id)
            setStatements(prev => prev.filter(s => s.id !== id))
        }
    }

    const handleExport = (format: "csv" | "excel" | "pdf") => {
        console.log(`Exporting in ${format}...`)
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
            <ValidatedBankStatementsPage
                statements={statements}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onView={handleView}
                onDelete={handleDelete}
                onExport={handleExport}
            />
        </div>
    )
}
