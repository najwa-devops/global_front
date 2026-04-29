"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreateDossierRequest } from "@/src/types/dossier"
import { FolderPlus, Info } from "lucide-react"

interface CreateDossierModalProps {
    open: boolean
    onClose: () => void
    onSubmit: (req: CreateDossierRequest) => Promise<void>
}

export function CreateDossierModal({ open, onClose, onSubmit }: CreateDossierModalProps) {
    const [name, setName] = useState("")
    const [fournisseurName, setFournisseurName] = useState("")
    const [ice, setIce] = useState("")
    const [fournisseurEmail, setFournisseurEmail] = useState("")
    const [fournisseurPassword, setFournisseurPassword] = useState("")
    const [exerciseStartDate, setExerciseStartDate] = useState("")
    const [exerciseEndDate, setExerciseEndDate] = useState("")
    const [exerciseError, setExerciseError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !fournisseurName.trim() || !ice.trim() || !fournisseurEmail.trim() || !fournisseurPassword.trim()) return
        if (!exerciseStartDate || !exerciseEndDate) {
            setExerciseError("Veuillez renseigner la période d'exercice.")
            return
        }
        if (new Date(exerciseStartDate) > new Date(exerciseEndDate)) {
            setExerciseError("La date de début doit être avant la date de fin.")
            return
        }
        if (fournisseurPassword.trim().length < 6) return
        setIsLoading(true)
        try {
            await onSubmit({
                name: name.trim(),
                fournisseurName: fournisseurName.trim(),
                ice: ice.trim(),
                fournisseurEmail: fournisseurEmail.trim(),
                fournisseurPassword: fournisseurPassword.trim(),
                exerciseStartDate,
                exerciseEndDate
            })
            setName("")
            setFournisseurName("")
            setIce("")
            setFournisseurEmail("")
            setFournisseurPassword("")
            setExerciseStartDate("")
            setExerciseEndDate("")
            setExerciseError("")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <FolderPlus className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle>Nouveau Dossier</DialogTitle>
                    </div>
                    <DialogDescription>
                        Créez un dossier pour un fournisseur. Un compte d&apos;accès lui sera automatiquement créé.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="dossier-name">Nom du dossier</Label>
                        <Input
                            id="dossier-name"
                            placeholder="Ex: Dossier SARL Maroc Tech"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="border-t border-border/50 pt-4">
                        <p className="text-sm font-medium mb-3">Exercice comptable</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="exercise-start">Date de début</Label>
                                <Input
                                    id="exercise-start"
                                    type="date"
                                    value={exerciseStartDate}
                                    onChange={e => {
                                        setExerciseStartDate(e.target.value)
                                        setExerciseError("")
                                    }}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="exercise-end">Date de fin</Label>
                                <Input
                                    id="exercise-end"
                                    type="date"
                                    value={exerciseEndDate}
                                    onChange={e => {
                                        setExerciseEndDate(e.target.value)
                                        setExerciseError("")
                                    }}
                                    required
                                />
                            </div>
                        </div>
                        {exerciseError && (
                            <p className="text-[11px] text-destructive mt-2">{exerciseError}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-2">
                            Période pendant laquelle les factures et relevés doivent se situer.
                        </p>
                    </div>

                    <div className="border-t border-border/50 pt-4">
                        <p className="text-sm font-medium mb-3">Informations du fournisseur</p>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="fournisseur-name">Nom / Raison sociale</Label>
                                <Input
                                    id="fournisseur-name"
                                    placeholder="Ex: SARL Maroc Tech"
                                    value={fournisseurName}
                                    onChange={e => setFournisseurName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fournisseur-ice">ICE</Label>
                                    <Input
                                        id="fournisseur-ice"
                                        type="text"
                                        placeholder="Ex: 001234567890123"
                                        value={ice}
                                        onChange={e => setIce(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fournisseur-username">Username</Label>
                                    <Input
                                        id="fournisseur-username"
                                        type="text"
                                        placeholder="fournisseur.username"
                                        value={fournisseurEmail}
                                        onChange={e => setFournisseurEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fournisseur-password">Mot de passe</Label>
                                    <Input
                                        id="fournisseur-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={fournisseurPassword}
                                        onChange={e => setFournisseurPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                    <p className="text-[11px] text-muted-foreground">Minimum 6 caractères.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="text-xs">
                            Un compte fournisseur sera créé avec ce username et mot de passe.
                        </p>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={isLoading || !name || !fournisseurName || !ice || !fournisseurEmail || fournisseurPassword.trim().length < 6 || !exerciseStartDate || !exerciseEndDate}>
                            {isLoading ? "Création en cours..." : "Créer le dossier"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
