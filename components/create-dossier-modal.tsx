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
    onSubmit: (req: CreateDossierRequest) => void
}

export function CreateDossierModal({ open, onClose, onSubmit }: CreateDossierModalProps) {
    const [name, setName] = useState("")
    const [fournisseurName, setFournisseurName] = useState("")
    const [fournisseurEmail, setFournisseurEmail] = useState("")
    const [fournisseurPassword, setFournisseurPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !fournisseurName.trim() || !fournisseurEmail.trim()) return
        setIsLoading(true)
        // Simulate API delay
        await new Promise(r => setTimeout(r, 800))
        onSubmit({
            name: name.trim(),
            fournisseurName: fournisseurName.trim(),
            fournisseurEmail: fournisseurEmail.trim(),
            fournisseurPassword: fournisseurPassword.trim() || undefined
        })
        setIsLoading(false)
        setName("")
        setFournisseurName("")
        setFournisseurEmail("")
        setFournisseurPassword("")
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
                                    <Label htmlFor="fournisseur-email">Email</Label>
                                    <Input
                                        id="fournisseur-email"
                                        type="email"
                                        placeholder="contact@fournisseur.ma"
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
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="text-xs">
                            Un compte fournisseur sera créé avec cet email et mot de passe.
                        </p>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={isLoading || !name || !fournisseurName || !fournisseurEmail}>
                            {isLoading ? "Création en cours..." : "Créer le dossier"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
