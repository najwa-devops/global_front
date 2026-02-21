"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

interface TemplateEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    templateId: number
    initialName: string
    initialSupplier: string
    onUpdate: (templateId: number, data: { templateName: string; supplierType: string }) => Promise<void>
}

export function TemplateEditDialog({
    open,
    onOpenChange,
    templateId,
    initialName,
    initialSupplier,
    onUpdate,
}: TemplateEditDialogProps) {
    const [name, setName] = useState(initialName)
    const [supplier, setSupplier] = useState(initialSupplier)
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        if (open) {
            setName(initialName)
            setSupplier(initialSupplier)
        }
    }, [open, initialName, initialSupplier])

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Le nom du template est requis")
            return
        }

        try {
            setIsUpdating(true)
            await onUpdate(templateId, {
                templateName: name.trim(),
                supplierType: supplier.trim().toUpperCase().replace(/\s+/g, "_")
            })
            onOpenChange(false)
        } catch (error) {
            console.error("Erreur mise à jour template:", error)
            toast.error("Erreur lors de la mise à jour")
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Modifier le template
                    </DialogTitle>
                    <DialogDescription>
                        Mettez à jour les informations d'identification du template.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nom du Template (template_name)</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Template Facture Maroc Telecom"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="supplier">Type Fournisseur (supplier)</Label>
                        <Input
                            id="supplier"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            placeholder="Ex: MAROC_TELECOM"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={isUpdating}>
                        {isUpdating ? "Enregistrement..." : "Enregistrer les modifications"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
