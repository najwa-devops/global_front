"use client"

import { useEffect, useMemo, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Users, Loader2, CheckCircle2, Search, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/src/api/api-client"
import { AdminService } from "@/src/api/services/admin.service"
import { ComptableAdminDto } from "@/src/types"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function AdminUsersPageContent() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [createdComptables, setCreatedComptables] = useState<ComptableAdminDto[]>([])
    const [showCreateSheet, setShowCreateSheet] = useState(false)
    const [comptableSearch, setComptableSearch] = useState("")

    const canSubmit = useMemo(() => {
        return !!username.trim() && !!password.trim() && !isSubmitting
    }, [username, password, isSubmitting])

    const activeCount = useMemo(() => {
        return createdComptables.filter((c) => c.active).length
    }, [createdComptables])

    const filteredComptables = useMemo(() => {
        const term = comptableSearch.trim().toLowerCase()
        if (!term) return createdComptables
        return createdComptables.filter((c) => {
            const label = `${c.username || ""} ${c.email || ""} ${c.displayName || ""}`.toLowerCase()
            return label.includes(term)
        })
    }, [createdComptables, comptableSearch])

    const onCreateComptable = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return

        try {
            setIsSubmitting(true)
            const created = await AdminService.createComptable({
                username: username.trim(),
                password: password.trim(),
            })

            setCreatedComptables((prev) => [created, ...prev])
            toast.success(`Comptable cree: ${created.username}`)
            setUsername("")
            setPassword("")
            setShowCreateSheet(false)
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === "BUSINESS_ALREADY_EXISTS") {
                    toast.error("Cet username est deja utilise.")
                } else if (err.code === "BUSINESS_BAD_REQUEST") {
                    toast.error("username ou mot de passe invalide.")
                } else {
                    toast.error(err.message || "Erreur lors de la creation du comptable.")
                }
            } else {
                toast.error("Erreur inattendue lors de la creation du comptable.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    useEffect(() => {
        const loadComptables = async () => {
            try {
                const list = await AdminService.listComptables()
                setCreatedComptables(list)
            } finally {
                setIsLoading(false)
            }
        }
        loadComptables()
    }, [])

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                    {
                        label: "Comptables",
                        value: isLoading ? "..." : createdComptables.length,
                        icon: Users,
                        color: "text-blue-500",
                        bg: "bg-blue-500/10",
                    },
                    {
                        label: "Actifs",
                        value: isLoading ? "..." : activeCount,
                        icon: CheckCircle2,
                        color: "text-green-500",
                        bg: "bg-green-500/10",
                    },
                ].map((stat) => (
                    <Card key={stat.label} className="border-border/50">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-2">
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

            <div className="flex justify-end">
                <Button className="gap-2" onClick={() => setShowCreateSheet(true)}>
                    <UserPlus className="h-4 w-4" />
                    Ajouter un comptable
                </Button>
            </div>

            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Comptables
                        </CardTitle>
                        <div className="relative w-full md:max-w-sm">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={comptableSearch}
                                onChange={(e) => setComptableSearch(e.target.value)}
                                placeholder="Rechercher un comptable..."
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Chargement...</p>
                    ) : filteredComptables.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun comptable cree pour le moment.</p>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-border/50">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Comptable</TableHead>
                                        <TableHead>Statut</TableHead>
                                        <TableHead>Rôle</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredComptables.map((u) => (
                                        <TableRow key={u.id} className="hover:bg-accent/40">
                                            <TableCell>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{u.username}</p>
                                                    <p className="text-xs text-muted-foreground truncate">ID: {u.id}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={u.active ? "default" : "secondary"}>
                                                    {u.active ? "Actif" : "Inactif"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{u.role}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
                <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-md">
                    <SheetHeader className="border-b px-6 py-5">
                        <SheetTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Ajouter un comptable
                        </SheetTitle>
                        <SheetDescription>
                            Créez un nouvel accès comptable depuis ce panneau latéral.
                        </SheetDescription>
                    </SheetHeader>

                    <form onSubmit={onCreateComptable} className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                            <div className="space-y-2">
                                <Label htmlFor="comptable-username">Username</Label>
                                <Input
                                    id="comptable-username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="comptable.username"
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="comptable-password">Mot de passe</Label>
                                <Input
                                    id="comptable-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Comptable@123"
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Un identifiant et un mot de passe seront créés pour ce comptable.
                            </p>
                        </div>

                        <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-between">
                            <Button type="button" variant="outline" onClick={() => setShowCreateSheet(false)} disabled={isSubmitting}>
                                Annuler
                            </Button>
                            <Button type="submit" className="gap-2" disabled={!canSubmit}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Creation...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        Creer le comptable
                                    </>
                                )}
                            </Button>
                        </SheetFooter>
                    </form>
                </SheetContent>
            </Sheet>
        </div>
    )
}

export default function AdminUsersPage() {
    return (
        <AuthGuard allowedRoles={["ADMIN"]}>
            <AdminUsersPageContent />
        </AuthGuard>
    )
}
