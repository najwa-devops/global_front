"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { UserRole } from "@/src/types"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
    children: React.ReactNode
    /** Roles allowed to access this page. If empty, any authenticated user can access. */
    allowedRoles?: UserRole[]
}

/**
 * AuthGuard wraps a page and ensures the user is authenticated.
 * Optionally restricts access to specific roles.
 * - Unauthenticated users are redirected to /login.
 * - Unauthorized roles see an "Access Denied" message.
 */
export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
    const { user, loading, authenticated } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !authenticated) {
            router.replace("/login")
        }
    }, [loading, authenticated, router])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Vérification de la session...</span>
            </div>
        )
    }

    if (!authenticated) {
        return null // Redirect is in progress
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <div className="text-6xl">🚫</div>
                <h2 className="text-2xl font-bold">Accès refusé</h2>
                <p className="text-muted-foreground">
                    Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
                </p>
                <button
                    onClick={() => router.push("/dashboard")}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Retour au tableau de bord
                </button>
            </div>
        )
    }

    return <>{children}</>
}
