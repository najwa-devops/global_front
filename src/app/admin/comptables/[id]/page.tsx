"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FolderOpen, FileText, Building2, Clock, CheckCircle2, ChevronRight, Plus } from "lucide-react"
import { CreateDossierModal } from "@/components/create-dossier-modal"
import { CreateDossierRequest } from "@/src/types/dossier"
import { toast } from "sonner"
import { AdminService, AdminDossierDto } from "@/src/api/services/admin.service"
import { ComptableAdminDto } from "@/src/types"
import { GeneralParamsService } from "@/src/api/services/general-params.service"

type DossierRow = {
    id: number
    name: string
    fournisseurName: string
    invoicesCount: number
    pendingInvoicesCount: number
    validatedInvoicesCount: number
}

function ComptableDossiersContent() {
    const params = useParams()
    const router = useRouter()
    const comptableId = Number(params.id)
    const [loading, setLoading] = useState(true)
    const [comptable, setComptable] = useState<ComptableAdminDto | null>(null)
    const [dossiers, setDossiers] = useState<DossierRow[]>([])
    const [showCreate, setShowCreate] = useState(false)

    const loadData = async () => {
        try {
            const [comptables, allDossiers] = await Promise.all([
                AdminService.listComptables().catch(() => []),
                AdminService.listDossiers().catch(() => []),
            ])
            const currentComptable = (comptables || []).find((c) => c.id === comptableId) || null
            const mapped = (allDossiers || [])
                .filter((d: AdminDossierDto) => d.comptableId === comptableId)
                .map((d: AdminDossierDto) => ({
                    id: d.id,
                    name: d.name,
                    fournisseurName: d.fournisseurEmail || "N/A",
                    invoicesCount: d.invoicesCount ?? 0,
                    pendingInvoicesCount: d.pendingInvoicesCount ?? 0,
                    validatedInvoicesCount: d.validatedInvoicesCount ?? 0,
                }))
            setComptable(currentComptable)
            setDossiers(mapped)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comptableId])

    const handleCreate = async (req: CreateDossierRequest) => {
        try {
            const created = await AdminService.createFournisseurForComptable({
                dossierNom: req.name,
                fournisseurEmail: req.fournisseurEmail,
                comptableId,
                fournisseurName: req.fournisseurName,
                fournisseurPassword: req.fournisseurPassword,
                exerciseStartDate: req.exerciseStartDate,
                exerciseEndDate: req.exerciseEndDate,
            })
            const createdData = created as { id?: unknown; dossier?: { id?: unknown } }
            const createdDossierId = Number(createdData?.id ?? createdData?.dossier?.id)
            if (Number.isFinite(createdDossierId) && createdDossierId > 0) {
                await GeneralParamsService.saveParams(
                    {
                        companyName: req.fournisseurName,
                        ice: req.ice,
                    },
                    createdDossierId,
                )
            }
            toast.success(`Dossier "${req.name}" créé.`)
            setShowCreate(false)
            await loadData()
        } catch (error: any) {
            toast.error(error?.message || "Erreur lors de la création du dossier.")
        }
    }

    const stats = useMemo(() => {
        return {
            total: dossiers.length,
            pending: dossiers.reduce((s, d) => s + d.pendingInvoicesCount, 0),
            validated: dossiers.reduce((s, d) => s + d.validatedInvoicesCount, 0),
        }
    }, [dossiers])

    const openDossier = (id: number, name: string) => {
        if (typeof window !== "undefined") {
            localStorage.setItem("currentDossierId", String(id))
            localStorage.setItem("currentDossierName", name)
        }
        router.push(`/dossiers/${id}`)
    }

    if (!loading && !comptable) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-muted-foreground">Comptable introuvable</p>
                <Button variant="outline" className="mt-4" onClick={() => router.back()}>Retour</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {(comptable?.username || "U").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{comptable?.username || "Comptable"}</h2>
                            <p className="text-sm text-muted-foreground">{comptable?.username || ""}</p>
                        </div>
                        <Badge variant={comptable?.active ? "default" : "secondary"} className="ml-2">
                            {comptable?.active ? "Actif" : "Inactif"}
                        </Badge>
                    </div>
                </div>
                <Button className="gap-2" onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4" />
                    Nouveau Dossier
                </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Dossiers", value: loading ? "..." : stats.total, icon: FolderOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { label: "En attente", value: loading ? "..." : stats.pending, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
                    { label: "Validées", value: loading ? "..." : stats.validated, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
                ].map(stat => (
                    <Card key={stat.label} className="border-border/50">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${stat.bg}`}>
                                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dossiers.map(dossier => (
                    <Card
                        key={dossier.id}
                        className="border-border/50 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => openDossier(dossier.id, dossier.name)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <FolderOpen className="h-4 w-4 text-primary" />
                                </div>
                                {dossier.pendingInvoicesCount > 0 && (
                                    <Badge className="bg-amber-500 text-white text-xs border-none">
                                        {dossier.pendingInvoicesCount} en attente
                                    </Badge>
                                )}
                            </div>
                            <CardTitle className="text-sm mt-2">{dossier.name}</CardTitle>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> {dossier.fournisseurName}
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" /> {dossier.invoicesCount} factures
                                </span>
                                <ChevronRight className="h-4 w-4 group-hover:text-primary transition-colors" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <CreateDossierModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
        </div>
    )
}

export default function ComptableDossiersPage() {
    return (
        <AuthGuard allowedRoles={["ADMIN"]}>
            <ComptableDossiersContent />
        </AuthGuard>
    )
}
