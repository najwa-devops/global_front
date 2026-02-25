"use client"

import { useEffect, useMemo, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Users, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/src/api/api-client"
import { AdminService } from "@/src/api/services/admin.service"
import { ComptableAdminDto } from "@/src/types"

function AdminUsersPageContent() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [createdComptables, setCreatedComptables] = useState<ComptableAdminDto[]>([])

    const canSubmit = useMemo(() => {
        return !!username.trim() && !!password.trim() && !isSubmitting
    }, [username, password, isSubmitting])

    const activeCount = useMemo(() => {
        return createdComptables.filter((c) => c.active).length
    }, [createdComptables])

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

            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Ajouter un comptable
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onCreateComptable} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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

                        <Button type="submit" className="gap-2 w-full md:w-auto" disabled={!canSubmit}>
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
                    </form>
                </CardContent>
            </Card>

            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Comptables
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Chargement...</p>
                    ) : createdComptables.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun comptable cree pour le moment.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {createdComptables.map((u) => (
                                <div key={u.id} className="rounded-lg border border-border/60 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{u.username}</p>
                                            <p className="text-xs text-muted-foreground">ID: {u.id}</p>
                                        </div>
                                        <Badge variant={u.active ? "default" : "secondary"}>
                                            {u.active ? "Actif" : "Inactif"}
                                        </Badge>
                                    </div>
                                    <div className="mt-2">
                                        <Badge variant="outline">{u.role}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
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
