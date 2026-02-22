"use client"

import { useEffect, useMemo, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Users, Loader2 } from "lucide-react"
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

    const onCreateComptable = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return

        try {
            setIsSubmitting(true)
            const created = await AdminService.createComptable({
                username: username.trim(),
                password: password.trim(),
            })

            setCreatedComptables(prev => [created, ...prev])
            toast.success(`Comptable créé: ${created.username}`)
            setUsername("")
            setPassword("")
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === "BUSINESS_ALREADY_EXISTS") {
                    toast.error("Cet email est déjà utilisé.")
                } else if (err.code === "BUSINESS_BAD_REQUEST") {
                    toast.error("Email ou mot de passe invalide.")
                } else {
                    toast.error(err.message || "Erreur lors de la création du comptable.")
                }
            } else {
                toast.error("Erreur inattendue lors de la création du comptable.")
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
            <Card className="border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Ajouter un comptable
                    </CardTitle>
                    <CardDescription>
                        Créez un utilisateur avec le rôle COMPTABLE (endpoint: POST /api/auth/users). La liste est récupérée du même endpoint puis filtrée par rôle.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onCreateComptable} className="space-y-4 max-w-md">
                        <div className="space-y-2">
                            <Label htmlFor="comptable-email">Email</Label>
                            <Input
                                id="comptable-email"
                                type="email"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="comptable@cabinet.ma"
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

                        <Button type="submit" className="gap-2" disabled={!canSubmit}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Création...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="h-4 w-4" />
                                    Créer le comptable
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Comptables créés (session)
                    </CardTitle>
                    <CardDescription>
                        Liste locale des créations effectuées depuis cette page.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Chargement...</p>
                    ) : createdComptables.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun comptable créé pour le moment.</p>
                    ) : (
                        <div className="space-y-2">
                            {createdComptables.map((u) => (
                                <div key={u.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{u.email}</p>
                                        <p className="text-xs text-muted-foreground">ID: {u.id}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{u.role}</Badge>
                                        <Badge variant={u.active ? "default" : "secondary"}>
                                            {u.active ? "Actif" : "Inactif"}
                                        </Badge>
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
