"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Building2, Settings2, ShieldCheck, Gauge } from "lucide-react"
import { toast } from "sonner"

export function GeneralSettingsPage() {
    // Global Settings
    const [globalAuxMode, setGlobalAuxMode] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("accounting_global_aux_mode")
            return saved === "true"
        }
        return false
    })

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("accounting_global_aux_mode", String(globalAuxMode))
        }
    }, [globalAuxMode])

    const handleToggleAuxMode = (checked: boolean) => {
        setGlobalAuxMode(checked)
        toast.success(checked ? "Mode auxiliaire activé par défaut" : "Mode auxiliaire désactivé par défaut")
    }

    return (
        <div className="space-y-6 max-w-4xl">

            <div className="grid gap-6">
                <Card className="border-border/50 bg-card/50 overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Logique Métier - Comptabilité</CardTitle>
                                <CardDescription>Configurez comment le système gère les écritures et les tiers.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="global-aux-mode" className="text-base font-semibold">Mode Auxiliaire par défaut</Label>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Si activé, les nouveaux tiers seront créés en mode auxiliaire (Collectif + Numéro) par défaut.
                                </p>
                            </div>
                            <Switch
                                id="global-aux-mode"
                                checked={globalAuxMode}
                                onCheckedChange={handleToggleAuxMode}
                            />
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                            <div className="space-y-1">
                                <Label className="text-base font-semibold">Validation automatique des ICE</Label>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Vérifier la validité des ICE via l'API nationale lors de la création d'un tier.
                                </p>
                            </div>
                            <Switch disabled id="auto-validate-ice" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50 overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Gauge className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Performance & Extraction</CardTitle>
                                <CardDescription>Paramètres liés au moteur OCR et au traitement des documents.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-base font-semibold">Seuil de confiance automatique</Label>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Niveau minimal de confiance (0-100) pour marquer une facture comme "Prêt à valider".
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded">80%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-dashed border-2 bg-muted/20">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Settings2 className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-sm font-medium">Plus de paramètres prochainement</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            Nous travaillons sur l'ajout de configurations pour les notifications email, l'export comptable personnalisé et la gestion multi-utilisateurs.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
