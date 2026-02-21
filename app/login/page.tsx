"use client"

import { useAuth } from "@/hooks/use-auth"
import { ApiError } from "@/src/api/api-client"
import { toast } from "sonner"
import { Loader2, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const { login, authenticated, user, loading } = useAuth()
    const router = useRouter()

    // Rediriger si déjà connecté
    useEffect(() => {
        if (!loading && authenticated && user) {
            if (user.role === 'FOURNISSEUR') {
                router.replace(`/dossiers/${user.id}`)
            } else if (user.role === 'SUPER_ADMIN') {
                router.replace('/admin')
            } else {
                router.replace('/dossiers')
            }
        }
    }, [loading, authenticated, user, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) {
            toast.error("Veuillez remplir tous les champs.")
            return
        }
        try {
            setIsLoading(true)
            await login(email, password)
            toast.success("Connexion réussie !")
            // La redirection sera gérée par le useEffect ci-dessus
            // dès que l'état global sera mis à jour.
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "Identifiants incorrects.")
            } else {
                toast.error("Une erreur est survenue. Veuillez réessayer.")
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.2),transparent_38%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(30,64,175,0.24),transparent_45%)]" />
                <div className="absolute inset-0 opacity-25 [background-size:42px_42px] [background-image:linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)]" />
                <div className="absolute -left-24 top-24 h-72 w-72 rounded-full border border-emerald-300/30" />
                <div className="absolute -right-20 bottom-16 h-64 w-64 rounded-full border border-sky-300/30" />
            </div>

            <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
                <Card className="w-full max-w-md border-white/20 bg-white/90 shadow-2xl backdrop-blur">
                    <CardHeader className="text-center space-y-2">
                        <div className="flex justify-center mb-2">
                            <div className="p-3 bg-emerald-500/15 rounded-full">
                                <FileText className="h-8 w-8 text-emerald-600" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Plateforme OCR</p>
                        <CardTitle className="text-2xl font-bold">Invoices System</CardTitle>
                        <CardDescription>Connectez-vous pour accéder à votre espace</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="votre@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Mot de passe</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connexion en cours...
                                    </>
                                ) : (
                                    "Se connecter"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
