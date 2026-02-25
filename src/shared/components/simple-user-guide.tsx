"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HelpCircle, X } from "lucide-react"

const STORAGE_KEY = "simple_user_guide_hidden"

export function SimpleUserGuide() {
    const [hidden, setHidden] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") return
        setHidden(localStorage.getItem(STORAGE_KEY) === "1")
    }, [])

    const hideGuide = () => {
        setHidden(true)
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, "1")
        }
    }

    if (hidden) return null

    return (
        <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <HelpCircle className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                        <p className="text-sm font-semibold">Mode simple: suivez ces 3 etapes</p>
                        <p className="text-xs text-muted-foreground mt-1">Pour aller vite: 1) Ajouter, 2) Verifier, 3) Valider.</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={hideGuide}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                    <Link href="/upload">1. Ajouter une facture</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                    <Link href="/invoices">2. Verifier</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                    <Link href="/validated">3. Factures validees</Link>
                </Button>
            </div>
        </div>
    )
}

