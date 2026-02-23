"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Info, AlertTriangle, CheckCircle2 } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import type { Tier, Account } from "@/lib/types"

interface TierCreationModalProps {
    isOpen: boolean
    onClose: () => void
    onCreated: (tier: Tier) => void
    initialData: {
        libelle: string
        ice: string
        ifNumber: string
        rcNumber: string
    }
    tierId?: number | undefined // Facultatif, si présent on est en mode édition
    existingTier?: Tier | undefined // Objet complet pour pré-remplir en mode édition
    chargeAccounts: Account[]
    tvaAccounts: Account[]
    fournisseurAccounts: Account[]
    isLoadingAccounts: boolean
}

export function TierCreationModal({
    isOpen,
    onClose,
    onCreated,
    initialData,
    tierId,
    existingTier,
    chargeAccounts,
    tvaAccounts,
    fournisseurAccounts,
    isLoadingAccounts
}: TierCreationModalProps) {
    const [formData, setFormData] = useState<Partial<Tier>>({
        libelle: "",
        ice: "",
        ifNumber: "",
        rcNumber: "",
        auxiliaireMode: true,
        collectifAccount: "441100000",
        tierNumber: "",
        defaultChargeAccount: "611100000",
        tvaAccount: "",
        defaultTvaRate: 20,
        taxCode: ""
    })

    const [isSubmitting, setIsSubmitting] = useState(false)
    const isEditMode = !!tierId

    // Synchroniser quand les props changent (ouverture du modal)
    useEffect(() => {
        if (isOpen) {
            setFormData({
                libelle: existingTier?.libelle || initialData.libelle || "",
                ice: existingTier?.ice || initialData.ice || "",
                ifNumber: existingTier?.ifNumber || initialData.ifNumber || "",
                rcNumber: existingTier?.rcNumber || initialData.rcNumber || "",
                auxiliaireMode: existingTier?.auxiliaireMode ?? (typeof window !== "undefined" ? localStorage.getItem("accounting_global_aux_mode") === "true" : true),
                collectifAccount: existingTier?.collectifAccount || "441100000",
                tierNumber: existingTier?.tierNumber || "",
                defaultChargeAccount: existingTier?.defaultChargeAccount || "611100000",
                tvaAccount: existingTier?.tvaAccount || "",
                defaultTvaRate: existingTier?.defaultTvaRate ?? 20,
                taxCode: existingTier?.taxCode || (existingTier?.tvaAccount?.startsWith("345") || existingTier?.tvaAccount?.startsWith("445") ? "146" : "")
            })
        }
    }, [isOpen, initialData, existingTier])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            // Validation
            if (!formData.libelle?.trim()) throw new Error("Le libellé est requis")

            if (formData.auxiliaireMode) {
                if (!formData.collectifAccount) throw new Error("Le compte collectif est requis en mode auxiliaire")
                if (!/^(342100000|441100000)$/.test(formData.collectifAccount)) {
                    throw new Error("Compte collectif invalide (doit être 342100000 ou 441100000)")
                }
                if (!formData.tierNumber?.trim()) throw new Error("Le compte tier est obligatoire")
            } else {
                if (!formData.tierNumber?.trim()) throw new Error("Le compte tier est obligatoire")
            }

            // Regex Validation
            if (formData.tierNumber && !/^[A-Z0-9-]+$/.test(formData.tierNumber)) {
                throw new Error("Le compte tier ne doit contenir que des majuscules, chiffres et tirets")
            }
            if (formData.ice && !/^\d{15}$/.test(formData.ice)) {
                throw new Error("L'ICE doit contenir exactement 15 chiffres")
            }
            if (formData.ifNumber && !/^\d{7,10}$/.test(formData.ifNumber)) {
                throw new Error("L'IF doit contenir entre 7 et 10 chiffres")
            }
            if (formData.rcNumber && formData.rcNumber.length > 20) {
                throw new Error("Le Numéro RC ne doit pas dépasser 20 caractères")
            }
            if (formData.defaultChargeAccount && !/^\d{9}$/.test(formData.defaultChargeAccount)) {
                throw new Error("Le compte de charge doit contenir exactement 9 chiffres")
            }
            if (formData.tvaAccount && !/^\d{9}$/.test(formData.tvaAccount)) {
                throw new Error("Le compte TVA doit contenir exactement 9 chiffres")
            }

            const payload: any = {
                ...formData,
                libelle: formData.libelle?.trim(),
                tierNumber: formData.tierNumber?.trim().toUpperCase(),
                collectifAccount: formData.collectifAccount?.trim() || null,
                ifNumber: formData.ifNumber?.trim() || null,
                ice: formData.ice?.trim() || null,
                rcNumber: formData.rcNumber?.trim() || null,
                defaultChargeAccount: formData.defaultChargeAccount?.trim() || null,
                tvaAccount: formData.tvaAccount?.trim() || null,
                auxiliaireMode: formData.auxiliaireMode,
                // Ensure correct types
                defaultTvaRate: formData.tvaAccount ? Number(formData.defaultTvaRate) : null,
                active: true,
                createdBy: "user" // TODO: Get actual user via context if available
            }

            const currentDossierId = (() => {
                if (typeof window === "undefined") return undefined
                const id = Number(window.localStorage.getItem("currentDossierId"))
                return Number.isFinite(id) && id > 0 ? id : undefined
            })()

            // Early business check: same ICE must not exist in the same dossier.
            if (!isEditMode && payload.ice) {
                const existingByIce = await api.getTierByIce(payload.ice, currentDossierId)
                if (existingByIce) {
                    throw new Error(
                        `ICE déjà utilisé dans ce dossier (dossierId=${existingByIce.dossierId ?? currentDossierId}, tierId=${existingByIce.id}).`
                    )
                }
            }

            // Cleanup headers specific to mode
            if (!formData.auxiliaireMode) {
                payload.collectifAccount = null;
            }

            let result: Tier
            if (isEditMode && tierId) {
                result = await api.updateTier(tierId, payload)
                toast.success("Fournisseur mis à jour")
            } else {
                result = await api.createTier(payload)
                toast.success("Fournisseur créé")
            }
            onCreated(result)
            onClose()
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Erreur lors de l'enregistrement")
        } finally {
            setIsSubmitting(false)
        }
    }

    // Calcul du compte affiché pour preview
    const getAccountPreview = () => {
        if (formData.auxiliaireMode) {
            if (formData.collectifAccount && formData.tierNumber) {
                // Suffixe Logic (si c'est comme ça que le backend gère) ou concatenation visuelle
                // Le backend concatène souvent Collectif (4411) + Suffixe (001) -> 4411001 ? 
                // Compte collectif + Numéro tier
                // L'affichage backend est "441100000 / 000000123"
                return `${formData.collectifAccount} / ${formData.tierNumber}`
            }
        } else {
            return formData.tierNumber || "..."
        }
        return "..."
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="grid gap-6 py-4">
                        <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                            <h4 className="text-sm font-semibold">Identité & Configuration</h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {formData.auxiliaireMode ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Compte Collectif</Label>
                                            <Select
                                                value={formData.collectifAccount}
                                                onValueChange={(v) => setFormData({ ...formData, collectifAccount: v })}
                                                disabled={isEditMode}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                                <SelectContent>
                                                    {fournisseurAccounts.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                                                    {fournisseurAccounts.length === 0 && (
                                                        <SelectItem value="441100000">441100000</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Compte Tier</Label>
                                            <Input
                                                value={formData.tierNumber}
                                                onChange={e => setFormData({ ...formData, tierNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 31) })}
                                                placeholder="ex: FFF-555-555"
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label>Libellé Fournisseur</Label>
                                            <Input
                                                value={formData.libelle}
                                                onChange={e => setFormData({ ...formData, libelle: e.target.value })}
                                                placeholder="ex: IAM"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Compte Tier</Label>
                                            <Input
                                                value={formData.tierNumber}
                                                onChange={e => setFormData({ ...formData, tierNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 31) })}
                                                placeholder="ex: 441100001"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Libellé Fournisseur</Label>
                                            <Input
                                                value={formData.libelle}
                                                onChange={e => setFormData({ ...formData, libelle: e.target.value })}
                                                placeholder="ex: IAM"
                                            />
                                        </div>
                                    </>
                                )}
                                <div className="space-y-2">
                                    <Label>ICE</Label>
                                    <Input
                                        value={formData.ice}
                                        onChange={e => setFormData({ ...formData, ice: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                                        placeholder="15 chiffres"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>IF</Label>
                                    <Input
                                        value={formData.ifNumber}
                                        onChange={e => setFormData({ ...formData, ifNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        placeholder="7 à 10 chiffres"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>RC</Label>
                                    <Input
                                        value={formData.rcNumber}
                                        onChange={e => setFormData({ ...formData, rcNumber: e.target.value })}
                                        placeholder="Registre de Commerce"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 border rounded-md p-4 bg-primary/5">
                            <h4 className="text-sm font-semibold">Configuration Comptable</h4>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Compte Charge (6...)</Label>
                                    <Select
                                        value={formData.defaultChargeAccount}
                                        onValueChange={v => setFormData({ ...formData, defaultChargeAccount: v })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                        <SelectContent>
                                            {chargeAccounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} - {a.libelle}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Compte TVA (345/445...)</Label>
                                    <Select
                                        value={formData.tvaAccount}
                                        onValueChange={v => {
                                            const updates: any = { tvaAccount: v }
                                            if (v.startsWith("345") || v.startsWith("445")) {
                                                updates.defaultTvaRate = 20
                                                updates.taxCode = "146"
                                            }
                                            setFormData({ ...formData, ...updates })
                                        }}
                                    >
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                        <SelectContent>
                                            {tvaAccounts
                                                .filter(a => a.code.startsWith("345") || a.code.startsWith("445"))
                                                .map(a => <SelectItem key={a.code} value={a.code}>{a.code} - {a.libelle}</SelectItem>)
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(formData.tvaAccount?.startsWith("345") || formData.tvaAccount?.startsWith("445")) && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Code Taux</Label>
                                            <Input
                                                value={formData.taxCode}
                                                onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                                                placeholder="146"
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Taux TVA (%)</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={formData.defaultTvaRate}
                                                    onChange={(e) => setFormData({ ...formData, defaultTvaRate: Number(e.target.value) })}
                                                    className="h-9 pr-7"
                                                />
                                                <span className="absolute right-2 top-2 text-muted-foreground text-xs">%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enregistrement...
                                </>
                            ) : (
                                "Enregistrer le fournisseur"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
