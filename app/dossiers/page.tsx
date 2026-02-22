"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { AuthGuard } from "@/components/auth-guard"
import { api } from "@/lib/api"
import { Dossier, CreateDossierRequest } from "@/src/types/dossier"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    FolderOpen, Plus, Search, FileText, Building2,
    CheckCircle2, Clock, ChevronRight, Users, Trash2
} from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { CreateDossierModal } from "../../components/create-dossier-modal"
import { toast } from "sonner"

function mapBackendDossier(raw: any): Dossier {
    return {
        id: raw.id,
        name: raw.name,
        fournisseur: {
            id: raw.fournisseurId ?? 0,
            name: raw.fournisseurEmail ?? "Fournisseur",
            email: raw.fournisseurEmail ?? "",
        },
        comptableId: raw.comptableId ?? 0,
        comptableName: raw.comptableEmail ?? "",
        invoicesCount: raw.invoicesCount ?? 0,
        bankStatementsCount: raw.bankStatementsCount ?? 0,
        pendingInvoicesCount: raw.pendingInvoicesCount ?? 0,
        validatedInvoicesCount: raw.validatedInvoicesCount ?? 0,
        status: String(raw.status || "ACTIVE").toUpperCase() === "ARCHIVED" ? "inactive" : "active",
        createdAt: raw.createdAt ?? new Date().toISOString(),
    }
}

function DossiersPageContent() {
    const { isComptable, isAdmin } = useAuth()
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [loading, setLoading] = useState(true)
    const [dossiers, setDossiers] = useState<Dossier[]>([])

    const loadDossiers = async () => {
        try {
            setLoading(true)
            const items = await api.getDossiers()
            setDossiers((items || []).map(mapBackendDossier))
        } catch (err: any) {
            toast.error(err?.message || "Erreur lors du chargement des dossiers.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDossiers()
    }, [])

    const filtered = useMemo(() => {
        const term = search.toLowerCase()
        return dossiers.filter(d =>
            d.name.toLowerCase().includes(term) ||
            d.fournisseur.name.toLowerCase().includes(term)
        )
    }, [dossiers, search])

    const handleCreateDossier = async (req: CreateDossierRequest) => {
        try {
            await api.createDossier({
                nom: req.name,
                fournisseurEmail: req.fournisseurEmail,
            })
            toast.success(`Dossier "${req.name}" créé.`)
            setShowCreateModal(false)
            await loadDossiers()
        } catch (err: any) {
            toast.error(err?.message || "Erreur lors de la création du dossier.")
        }
    }

    const handleDeleteDossier = async (id: number, name: string) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le dossier "${name}" ? Cette action est irréversible.`)) {
            return
        }

        try {
            await api.deleteDossier(id)
            setDossiers(prev => prev.filter(d => d.id !== id))
            toast.success(`Le dossier "${name}" a été supprimé.`)
        } catch (err) {
            toast.error("Erreur lors de la suppression du dossier.")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg text-muted-foreground">
                        {loading ? "Chargement..." : `${dossiers.length} dossier(s)`}
                    </h2>
                </div>
                {(isComptable() || isAdmin()) && (
                    <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nouveau Dossier
                    </Button>
                )}
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Rechercher un dossier ou fournisseur..."
                    className="pl-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-border/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <FolderOpen className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{dossiers.length}</p>
                                <p className="text-xs text-muted-foreground">Dossiers</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <Clock className="h-4 w-4 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {dossiers.reduce((s, d) => s + d.pendingInvoicesCount, 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">En attente</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {dossiers.reduce((s, d) => s + d.validatedInvoicesCount, 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Validées</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <Users className="h-4 w-4 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{new Set(dossiers.map(d => d.fournisseur.email)).size}</p>
                                <p className="text-xs text-muted-foreground">Fournisseurs</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">Aucun dossier trouvé</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {search ? "Modifiez votre recherche" : "Créez votre premier dossier"}
                    </p>
                    {!search && (isComptable() || isAdmin()) && (
                        <Button className="mt-4 gap-2" onClick={() => setShowCreateModal(true)}>
                            <Plus className="h-4 w-4" />
                            Nouveau Dossier
                        </Button>
                    )}
                </div>
            ) : filtered.length > 4 ? (
                <Card className="border-border/50 bg-card/50">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Dossier</TableHead>
                                <TableHead>Fournisseur</TableHead>
                                <TableHead>Factures</TableHead>
                                <TableHead>En attente</TableHead>
                                <TableHead>Créé le</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map(dossier => (
                                <TableRow
                                    key={dossier.id}
                                    className="cursor-pointer hover:bg-accent/50 group"
                                    onClick={() => router.push(`/dossiers/${dossier.id}`)}
                                >
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <FolderOpen className="h-4 w-4 text-primary" />
                                            {dossier.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{dossier.fournisseur.name}</TableCell>
                                    <TableCell>{dossier.invoicesCount}</TableCell>
                                    <TableCell>
                                        {dossier.pendingInvoicesCount > 0 ? (
                                            <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                                                {dossier.pendingInvoicesCount}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{new Date(dossier.createdAt).toLocaleDateString("fr-FR")}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="sm" className="group-hover:text-primary" onClick={() => router.push(`/dossiers/${dossier.id}`)}>
                                                Ouvrir <ChevronRight className="ml-1 h-4 w-4" />
                                            </Button>
                                            {(isComptable() || isAdmin()) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteDossier(dossier.id, dossier.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(dossier => (
                        <Card
                            key={dossier.id}
                            className="border-border/50 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer group"
                            onClick={() => router.push(`/dossiers/${dossier.id}`)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                        <FolderOpen className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={dossier.status === "active" ? "default" : "secondary"}
                                            className="text-xs"
                                        >
                                            {dossier.status === "active" ? "Actif" : "Inactif"}
                                        </Badge>
                                        {dossier.pendingInvoicesCount > 0 && (
                                            <Badge className="bg-amber-500 text-white text-xs border-none">
                                                {dossier.pendingInvoicesCount} en attente
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <CardTitle className="text-base mt-2 leading-tight">{dossier.name}</CardTitle>
                                <CardDescription className="flex items-center gap-1.5">
                                    <Building2 className="h-3 w-3" />
                                    {dossier.fournisseur.name}
                                </CardDescription>
                                {isAdmin() && (
                                    <CardDescription className="text-xs mt-0.5">
                                        Comptable : {dossier.comptableName}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <FileText className="h-3.5 w-3.5" />
                                            {dossier.invoicesCount} factures
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Building2 className="h-3.5 w-3.5" />
                                            {dossier.bankStatementsCount} relevés
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        {(isComptable() || isAdmin()) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDeleteDossier(dossier.id, dossier.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <ChevronRight className="h-4 w-4 group-hover:text-primary transition-colors" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Créé le {new Date(dossier.createdAt).toLocaleDateString("fr-FR")}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CreateDossierModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateDossier}
            />
        </div>
    )
}

export default function DossiersPage() {
    return (
        <AuthGuard allowedRoles={["COMPTABLE", "ADMIN", "CLIENT"]}>
            <DossiersPageContent />
        </AuthGuard>
    )
}

