"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Building2, Save, Info, CheckCircle2, CheckSquare, Square, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { api } from "@/lib/api"
import { type BankOption } from "@/releve-bancaire/types"

export function BankSettingsPage() {
    const [supportedBanks, setSupportedBanks] = useState<BankOption[]>([])
    const [selectedBanks, setSelectedBanks] = useState<string[]>(["AUTO"])
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const data = await api.getBankOptions()
                setSupportedBanks(data.options)
            } catch (error) {
                console.error("Error fetching bank options", error)
                toast.error("Impossible de charger les options bancaires")
                // Fallback to minimal list if API fails
                setSupportedBanks([
                    { code: "AUTO", label: "Détection Automatique", mappedTo: "AUTO" }
                ])
            } finally {
                setIsLoading(false)
            }
        }

        fetchOptions()

        const savedBanks = localStorage.getItem("selected_banks_processing")
        if (savedBanks) {
            try {
                const parsed = JSON.parse(savedBanks)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSelectedBanks(parsed)
                }
            } catch (e) {
                console.error("Error parsing saved banks", e)
                // Fallback to legacy single value if possible
                const legacy = localStorage.getItem("default_bank_processing")
                if (legacy) setSelectedBanks([legacy])
            }
        } else {
            // Check legacy
            const legacy = localStorage.getItem("default_bank_processing")
            if (legacy) setSelectedBanks([legacy])
        }
    }, [])

    const toggleBank = (bankId: string) => {
        setSelectedBanks(prev => {
            if (prev.includes(bankId)) {
                // Don't allow empty selection, default back to AUTO if last item removed
                if (prev.length === 1) return ["AUTO"]
                return prev.filter(id => id !== bankId)
            } else {
                return [...prev, bankId]
            }
        })
    }

    const handleSave = () => {
        setIsSaving(true)
        localStorage.setItem("selected_banks_processing", JSON.stringify(selectedBanks))
        // Maintain compatibility for now
        localStorage.setItem("default_bank_processing", selectedBanks[0] || "AUTO")

        // Simuler un délai pour l'effet visuel
        setTimeout(() => {
            setIsSaving(false)
            toast.success("Paramètres bancaires enregistrés")
        }, 500)
    }

    return (
        <div className="space-y-6">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Building2 className="h-6 w-6 text-primary bg-primary/10 p-1 rounded-md" />
                        <div>
                            <CardTitle>Configuration des Relevés Bancaires</CardTitle>
                            <CardDescription>
                                Choisissez la structure de banque par défaut pour le traitement OCR des relevés bancaires.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 text-sm text-blue-600 dark:text-blue-400">
                        <Info className="h-5 w-5 shrink-0" />
                        <p>
                            Ce paramétrage permet de forcer l'extracteur OCR à utiliser une structure spécifique.
                            Cela est utile si la détection automatique échoue ou pour garantir une extraction optimale.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Banques actives pour l'upload</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {supportedBanks.map((bank) => {
                                const isSelected = selectedBanks.includes(bank.code)
                                return (
                                    <div
                                        key={bank.code}
                                        className={cn(
                                            "relative flex items-center space-x-3 rounded-xl border p-4 cursor-pointer transition-all hover:bg-accent/50",
                                            isSelected
                                                ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                                                : "border-border/50"
                                        )}
                                        onClick={() => toggleBank(bank.code)}
                                    >
                                        <div className={cn(
                                            "h-5 w-5 rounded flex items-center justify-center transition-colors",
                                            isSelected ? "text-emerald-500" : "text-muted-foreground/30"
                                        )}>
                                            {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                        </div>
                                        <Label htmlFor={bank.code} className="flex-1 font-medium cursor-pointer">
                                            {bank.label}
                                        </Label>
                                        {isSelected && (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {isLoading && (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                            {isSaving ? "Enregistrement..." : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Enregistrer les préférences
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="py-4">
                    <CardTitle className="text-lg">Détails des structures supportées</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Chaque banque possède une structure de relevé unique (position des colonnes, formats de dates,
                        mots-clés pour les soldes). L'extracteur OCR utilise ces modèles pour identifier précisément :
                    </p>
                    <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Dates d'opération et de valeur
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Libellés multi-lignes
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Montants Débit / Crédit
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Soldes initiaux et finaux
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
