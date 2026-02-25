"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, Building2, CheckCircle2, ChevronRight, FolderOpen, Users, UserPlus } from "lucide-react"
import { AdminService, AdminDossierDto, AdminUserDto } from "@/src/api/services/admin.service"
import { ComptableAdminDto } from "@/src/types"

function StatsPageContent() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<AdminUserDto[]>([])
    const [comptables, setComptables] = useState<ComptableAdminDto[]>([])
    const [dossiers, setDossiers] = useState<AdminDossierDto[]>([])
    const [search, setSearch] = useState("")

    useEffect(() => {
        const load = async () => {
            try {
                const [usersData, dossierData, comptableData] = await Promise.all([
                    AdminService.listUsers(),
                    AdminService.listDossiers(),
                    AdminService.listComptables(),
                ])
                setUsers(usersData || [])
                setDossiers(dossierData || [])
                setComptables(comptableData || [])
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    const supplierCount = useMemo(() => {
        if (!dossiers.length) return 0
        return new Set(dossiers.map(d => d.fournisseurEmail || "")).size
    }, [dossiers])

    const filteredComptables = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return comptables
        return comptables.filter((c) => {
            const label = (c.displayName ?? c.email ?? "").toLowerCase()
            return label.includes(term)
        })
    }, [comptables, search])

    const filteredDossiers = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return dossiers
        return dossiers.filter((d) =>
            (d.name || "").toLowerCase().includes(term) ||
            (d.fournisseurEmail || "").toLowerCase().includes(term)
        )
    }, [dossiers, search])

    const dossierStats = useMemo(() => {
        const map = new Map<number, { dossiers: number; invoices: number; pending: number }>()
        filteredDossiers.forEach((item) => {
            const comptableId = item.comptableId || 0
            if (!map.has(comptableId)) {
                map.set(comptableId, { dossiers: 0, invoices: 0, pending: 0 })
            }
            const agg = map.get(comptableId)!
            agg.dossiers += 1
            agg.invoices += item.invoicesCount || 0
            agg.pending += item.pendingInvoicesCount || 0
        })
        return map
    }, [filteredDossiers])

    const statsCards = [
        { label: "Comptables", value: filteredComptables.length, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Utilisateurs", value: users.length, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
        { label: "Dossiers", value: filteredDossiers.length, icon: FolderOpen, color: "text-indigo-500", bg: "bg-indigo-500/10" },
        { label: "Fournisseurs uniques", value: supplierCount, icon: Building2, color: "text-purple-500", bg: "bg-purple-500/10" },
    ]

    const openDossier = (id: number, name?: string | null) => {
        if (typeof window !== "undefined") {
            localStorage.setItem("currentDossierId", String(id))
            localStorage.setItem("currentDossierName", (name || `Dossier #${id}`).trim())
        }
        router.push(`/dossiers/${id}`)
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statsCards.map((card) => {
                    const Icon = card.icon
                    return (
                        <Card key={card.label} className="border-border/50">
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${card.bg}`}>
                                        <Icon className={`h-4 w-4 ${card.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{loading ? "..." : card.value}</p>
                                        <p className="text-xs text-muted-foreground">{card.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="search"
                    placeholder="Rechercher par email ou dossier..."
                    className="rounded-md border border-border/50 bg-card/40 px-3 py-2 text-sm w-full max-w-md"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={() => router.push("/admin/utilisateurs")}>
                    <UserPlus className="h-4 w-4" />
                    Ajouter un comptable
                </Button>
            </div>

            <Tabs defaultValue="comptables">
                <TabsList>
                    <TabsTrigger value="comptables" className="gap-2">
                        <Users className="h-4 w-4" />
                        Comptables ({filteredComptables.length})
                    </TabsTrigger>
                    <TabsTrigger value="dossiers" className="gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Dossiers ({filteredDossiers.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="comptables">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {filteredComptables.map((comptable) => {
                            const agg = dossierStats.get(comptable.id) || { dossiers: 0, invoices: 0, pending: 0 }
                            return (
                                <Card
                                    key={comptable.id}
                                    className="border-border/50 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
                                    onClick={() => router.push(`/admin/comptables/${comptable.id}`)}
                                >
                                    <CardContent className="py-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                                                    {(comptable.email || "U").slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">{comptable.email?.split("@")[0]}</p>
                                                    <p className="text-xs text-muted-foreground">{comptable.email}</p>
                                                </div>
                                            </div>
                                            <Badge variant={comptable.active ? "default" : "secondary"} className="text-xs">
                                                {comptable.active ? "Actif" : "Inactif"}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center mt-3">
                                            <div className="rounded-lg bg-muted/50 py-2">
                                                <p className="text-lg font-bold">{agg.dossiers}</p>
                                                <p className="text-[10px] text-muted-foreground">Dossiers</p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 py-2">
                                                <p className="text-lg font-bold">{agg.pending}</p>
                                                <p className="text-[10px] text-muted-foreground">En attente</p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 py-2">
                                                <p className="text-lg font-bold">{agg.invoices}</p>
                                                <p className="text-[10px] text-muted-foreground">Factures</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <ArrowRight className="h-4 w-4 group-hover:text-primary transition-colors" />
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="dossiers">
                    <div className="space-y-2 mt-4">
                        {filteredDossiers.map((dossier) => (
                            <Card
                                key={dossier.id}
                                className="border-border/50 hover:border-border cursor-pointer"
                                onClick={() => openDossier(dossier.id, dossier.name)}
                            >
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">{dossier.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {dossier.fournisseurEmail || "N/A"} · Comptable : {dossier.comptableEmail || "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs text-muted-foreground">{dossier.invoicesCount ?? 0} factures</span>
                                            {(dossier.pendingInvoicesCount ?? 0) > 0 && (
                                                <Badge className="bg-amber-500 text-white text-xs border-none">
                                                    {dossier.pendingInvoicesCount} en attente
                                                </Badge>
                                            )}
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function StatistiquesPage() {
    return (
        <AuthGuard allowedRoles={["ADMIN"]}>
            <StatsPageContent />
        </AuthGuard>
    )
}
