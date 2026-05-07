"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BankStatementTable } from "@/releve-bancaire/components/bank-statement-table"
import { UploadBankPage } from "@/releve-bancaire/components/upload-bank-page"
import { api } from "@/lib/api"
import { BankStatementV2 } from "@/releve-bancaire/types"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { GeneralParamsService } from "@/src/api/services/general-params.service"

function BankListPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useAuth()
    const isClient = user?.role === "CLIENT"
    const [loading, setLoading] = useState(true)
    const [allowDeleteValidated, setAllowDeleteValidated] = useState(false)
    const [allowDeleteAccounted, setAllowDeleteAccounted] = useState(false)
    const [statements, setStatements] = useState<BankStatementV2[]>([])
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accounted">("all")
    const [deleteAllOpen, setDeleteAllOpen] = useState(false)

    const isAccountedStatus = (status?: string) => {
        const normalized = (status || "").toUpperCase()
        return normalized === "COMPTABILISE" || normalized === "COMPTABILISÉ"
    }

    const loadData = async () => {
        try {
            const [statementsData, generalParams] = await Promise.all([
                api.getAllBankStatements({ limit: 1000 }),
                GeneralParamsService.getParams().catch(() => ({})),
            ])
            setStatements(Array.isArray(statementsData) ? statementsData : [])
            setAllowDeleteValidated(Boolean((generalParams as any)?.allowValidatedDocumentDeletion))
            setAllowDeleteAccounted(Boolean((generalParams as any)?.allowAccountedDocumentDeletion))
        } catch (error) {
            console.error("Error loading bank statements:", error)
            toast.error("Impossible de charger les relevés bancaires")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        const q = (searchParams.get("filter") || "").toLowerCase()
        if (q === "pending" || q === "accounted") {
            setStatusFilter(q)
        } else {
            setStatusFilter("all")
        }
    }, [searchParams])

    useEffect(() => {
        const hasProcessing = statements.some((s) =>
            ["PENDING", "PROCESSING", "EN_ATTENTE", "EN_COURS"].includes(s.status)
        )
        if (!hasProcessing) return

        const interval = setInterval(() => {
            loadData()
        }, 2000)
        return () => clearInterval(interval)
    }, [statements])

    const filteredStatements = statements.filter((s) => {
        const status = (s.status || "").toUpperCase()
        const isAccounted = isAccountedStatus(status)
        const isPending = !isAccounted

        if (statusFilter === "accounted") return isAccounted
        if (statusFilter === "pending") return isPending
        return true
    })

    const handleUpload = async (file: File, bankType?: string) => {
        const effectiveBankType = bankType || "AUTO"
        const allowedBanks: string[] = []
        const statement = await api.uploadBankStatement(file, effectiveBankType, allowedBanks)
        const normalizedStatus = (statement.status || "").toUpperCase()
        if (normalizedStatus === "DUPLIQUE" || normalizedStatus === "DUPLICATE") {
            await loadData()
            toast.error("Relevé dupliqué détecté: même RIB, même période et mêmes soldes déjà présents.")
            return { outcome: "duplicate" as const, statement }
        }
        return { outcome: "success" as const, statement }
    }

    const handleView = (statement: BankStatementV2) => {
        router.push(`/bank/detail/${statement.id}`)
    }

    const handleDelete = async (id: number) => {
        try {
            await api.deleteBankStatement(id)
            setStatements((prev) => prev.filter((s) => s.id !== id))
            toast.success("Relevé supprimé")
        } catch (error) {
            toast.error("Erreur lors de la suppression")
        }
    }

    const handleValidate = async (id: number) => {
        try {
            if (isClient) {
                await api.clientValidateBankStatement(id)
            } else {
                await api.validateBankStatement(id)
            }
            await loadData()
            toast.success("Relevé validé")
        } catch (error) {
            toast.error("Erreur lors de la validation")
        }
    }

    const handleMarkAsAccounted = async (id: number) => {
        const previous = statements

        // Mise à jour instantanée UI sans refresh
        setStatements((prev) =>
            prev.map((s) =>
                s.id === id
                    ? { ...s, status: "COMPTABILISE", statusCode: "COMPTABILISE", canReprocess: false }
                    : s
            )
        )

        try {
            const updated = await api.updateBankStatementStatus(id, "COMPTABILISE")
            setStatements((prev) =>
                prev.map((s) => (s.id === id ? { ...s, ...updated } : s))
            )
            toast.success("Relevé comptabilisé")
        } catch (error) {
            setStatements(previous)
            toast.error("Erreur lors de la comptabilisation")
        }
    }

    const handleReprocess = async (statement: BankStatementV2) => {
        try {
            // Reflect the action immediately in UI while backend starts processing.
            setStatements((prev) =>
                prev.map((s) =>
                    s.id === statement.id
                        ? { ...s, status: "PROCESSING", canReprocess: false }
                        : s
                )
            )

            const allowedBanks: string[] = []

            const updatedStatement = await api.processBankStatement(statement.id, allowedBanks)
            setStatements((prev) =>
                prev.map((s) => (s.id === statement.id ? { ...s, ...updatedStatement } : s))
            )
            toast.success("Reprocessage lancé")

            // Force short polling on the single statement to keep UI in sync immediately.
            const maxAttempts = 8
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 1200))
                const latest = await api.getBankStatementById(statement.id)
                setStatements((prev) =>
                    prev.map((s) => (s.id === statement.id ? { ...s, ...latest } : s))
                )
                const isStillProcessing = ["PENDING", "PROCESSING", "EN_ATTENTE", "EN_COURS"].includes(latest.status)
                if (!isStillProcessing) {
                    break
                }
            }
            await loadData()
        } catch (error) {
            toast.error("Erreur lors du reprocessage")
            await loadData()
        }
    }

    const handleDeleteAll = () => {
        setDeleteAllOpen(true)
    }

    const confirmDeleteAll = async () => {
        try {
            await api.deleteAllBankStatements()
            await loadData()
            toast.success("Tous les relevés ont été supprimés")
        } catch (error) {
            toast.error("Erreur lors de la suppression globale")
        } finally {
            setDeleteAllOpen(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <UploadBankPage
                onUpload={handleUpload}
                onUploadComplete={async ({ successCount, duplicateCount, errorCount }) => {
                    await loadData()
                    if (successCount > 0) {
                        toast.success(`Import termine: ${successCount} releve${successCount > 1 ? "s" : ""} accepte${successCount > 1 ? "s" : ""}.`)
                    }
                    if (duplicateCount > 0) {
                        toast.error(`${duplicateCount} releve${duplicateCount > 1 ? "s" : ""} duplique${duplicateCount > 1 ? "s" : ""} refuse${duplicateCount > 1 ? "s" : ""}.`)
                    }
                    if (successCount === 0 && duplicateCount === 0 && errorCount > 0) {
                        toast.error("Aucun releve n'a ete importe.")
                    }
                }}
                onViewBankStatement={() => {}}
            />

            <Card className="border-border/50 bg-card/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardDescription>
                            {filteredStatements.length} relevé{filteredStatements.length > 1 ? "s" : ""} affiché{filteredStatements.length > 1 ? "s" : ""}
                        </CardDescription>
                        {!isClient && (
                            <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={statements.length === 0}>
                                Tout supprimer
                            </Button>
                        )}
                    </div>
                </CardHeader>
            </Card>

            <div className="flex flex-wrap gap-2">
                <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
                    Tous
                </Button>
                <Button variant={statusFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("pending")}>
                    À traiter
                </Button>
                <Button variant={statusFilter === "accounted" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("accounted")}>
                    Comptabilisés
                </Button>
            </div>

            <BankStatementTable
                statements={filteredStatements}
                onView={handleView}
                onDelete={handleDelete}
                onValidate={handleValidate}
                onMarkAsAccounted={handleMarkAsAccounted}
                onReprocess={handleReprocess}
                onUpdateStatement={(updated) => {
                    setStatements((prev) =>
                        prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
                    )
                }}
                userRole={user?.role}
                allowDeleteValidated={allowDeleteValidated}
                allowDeleteAccounted={allowDeleteAccounted}
            />

            <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de supprimer ces fichiers ?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmDeleteAll() }}>
                            Oui
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}


export default function BankListPage() {
    return (
        <Suspense fallback={<div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <BankListPageContent />
        </Suspense>
    )
}
