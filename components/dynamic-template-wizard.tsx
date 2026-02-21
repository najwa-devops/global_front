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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Plus, X, ArrowRight, ArrowLeft, Check } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import type { DynamicInvoice, DynamicFieldDefinition, DynamicFieldType, CreateDynamicTemplateRequest } from "@/lib/types"

interface DynamicTemplateWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    invoice: DynamicInvoice
    ice?: string | null
    ifNumber?: string | null
    supplier?: string | null
    onSuccess?: (templateId: number) => void
}

// Common invoice fields with their types
const COMMON_FIELDS: Array<{ name: string; type: DynamicFieldType; required: boolean }> = [
    { name: "invoiceNumber", type: "IDENTIFIER", required: true },
    { name: "invoiceDate", type: "DATE", required: true },
    { name: "supplier", type: "TEXT", required: true },
    { name: "ice", type: "IDENTIFIER", required: false },
    { name: "ifNumber", type: "IDENTIFIER", required: false },
    { name: "amountHT", type: "CURRENCY", required: true },
    { name: "tva", type: "CURRENCY", required: true },
    { name: "amountTTC", type: "CURRENCY", required: true },
]

const FIELD_TYPE_LABELS: Record<DynamicFieldType, string> = {
    TEXT: "Texte",
    NUMBER: "Nombre",
    CURRENCY: "Montant",
    DATE: "Date",
    IDENTIFIER: "Identifiant",
}

export function DynamicTemplateWizard({
    open,
    onOpenChange,
    invoice,
    ice,
    ifNumber,
    supplier,
    onSuccess,
}: DynamicTemplateWizardProps) {
    // Configuration initiale des champs basée sur l'OCR
    const initialDefinitions: DynamicFieldDefinition[] = invoice.fields.length > 0
        ? invoice.fields.map(f => {
            let fieldType: DynamicFieldType = "TEXT"
            if (f.key === "invoiceNumber" || f.key === "ice" || f.key === "ifNumber" || f.key === "rcNumber") {
                fieldType = "IDENTIFIER"
            } else if (f.type === "number") {
                fieldType = "CURRENCY"
            } else if (f.type === "date") {
                fieldType = "DATE"
            }

            return {
                fieldName: f.key,
                fieldType,
                labels: [],
                required: f.required || false,
            }
        })
        : COMMON_FIELDS.map(f => ({
            fieldName: f.name,
            fieldType: f.type,
            labels: [],
            required: f.required,
        }))

    const [step, setStep] = useState(1)
    const [selectedSignature, setSelectedSignature] = useState<"ICE" | "IF" | null>(null)
    const [templateName, setTemplateName] = useState("")
    const [supplierType, setSupplierType] = useState("GENERAL")
    const [description, setDescription] = useState("")
    const [fieldDefinitions, setFieldDefinitions] = useState<DynamicFieldDefinition[]>(initialDefinitions)
    const [isCreating, setIsCreating] = useState(false)

    // État pour les données fournisseurs supplémentaires
    const [supplierData, setSupplierData] = useState({
        address: "",
        phone: "",
        email: "",
        city: "",
        postalCode: "",
    })

    const hasIce = !!ice?.trim()
    const hasIf = !!ifNumber?.trim()

    // Reset state when opening or invoice changes
    useEffect(() => {
        if (open) {
            setStep(1)
            setTemplateName(supplier ? `Template ${supplier}` : "")
            setSupplierType(supplier ? supplier.toUpperCase().replace(/\s+/g, "_") : "GENERAL")
            setFieldDefinitions(initialDefinitions)

            if (hasIce) setSelectedSignature("ICE")
            else if (hasIf) setSelectedSignature("IF")
            else setSelectedSignature(null)

            setSupplierData({
                address: "",
                phone: "",
                email: "",
                city: "",
                postalCode: "",
            })
            setDescription("")
        }
    }, [open, invoice.id, supplier, ice, ifNumber, initialDefinitions, hasIce, hasIf])

    const addLabel = (fieldName: string, label: string) => {
        if (!label.trim()) return

        setFieldDefinitions(prev =>
            prev.map(f =>
                f.fieldName === fieldName
                    ? { ...f, labels: [...f.labels, label.trim()] }
                    : f
            )
        )
    }

    const updateFieldSettings = (fieldName: string, updates: Partial<DynamicFieldDefinition>) => {
        setFieldDefinitions(prev =>
            prev.map(f =>
                f.fieldName === fieldName ? { ...f, ...updates } : f
            )
        )
    }

    const handleCreate = async () => {
        if (!selectedSignature) {
            toast.error("Veuillez sélectionner une signature (ICE ou IF)")
            return
        }

        if (!templateName.trim()) {
            toast.error("Veuillez entrer un nom de template")
            return
        }

        const signatureValue = selectedSignature === "ICE" ? (ice || "") : (ifNumber || "")

        if (!signatureValue.trim()) {
            toast.error("La valeur de signature est vide")
            return
        }

        // Filter out fields with no labels
        const validFields = fieldDefinitions.filter(f => f.labels.length > 0)

        if (validFields.length < 1) {
            toast.error(`Au moins 1 champ doit avoir des labels (actuellement: ${validFields.length})`)
            return
        }

        try {
            setIsCreating(true)

            const request: CreateDynamicTemplateRequest = {
                templateName: templateName.trim(),
                supplierType: supplierType,
                signature: {
                    type: selectedSignature,
                    value: signatureValue,
                },
                fieldDefinitions: validFields.map(f => ({
                    ...f,
                    detectionMethod: f.detectionMethod || (f.regexPattern ? "REGEX_BASED" : "LABEL_BASED"),
                    searchZone: f.searchZone || "ALL",
                    confidenceThreshold: f.confidenceThreshold || 0.7
                })),
                fixedSupplierData: {
                    ice: ice || undefined,
                    ifNumber: ifNumber || undefined,
                    rcNumber: invoice.fields.find(f => f.key === "rcNumber")?.value ? String(invoice.fields.find(f => f.key === "rcNumber")?.value) : undefined,
                    supplier: supplier || undefined,
                    address: supplierData.address || undefined,
                    phone: supplierData.phone || undefined,
                    email: supplierData.email || undefined,
                    city: supplierData.city || undefined,
                    postalCode: supplierData.postalCode || undefined,
                },
                description: description || undefined,
                createdBy: "user"
            }

            console.log("📤 Sending Create Template Request:", request)
            const result = await api.createDynamicTemplate(request)
            console.log("✅ Template dynamique créé:", result)

            toast.success(
                `✓ Template créé avec succès\n` +
                `Nom: ${result.templateName}\n` +
                `Champs: ${result.fieldDefinitions.length}`,
                { duration: 6000 }
            )

            onOpenChange(false)
            onSuccess?.(result.id)

        } catch (error) {
            const message = error instanceof Error ? error.message : "Erreur inconnue"
            console.error("❌ Erreur création template:", message)
            toast.error(`Erreur: ${message}`, { duration: 5000 })
        } finally {
            setIsCreating(false)
        }
    }

    const canProceedToStep2 = selectedSignature && templateName.trim()
    const canCreate = fieldDefinitions.filter(f => f.labels.length > 0).length >= 1

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Créer un Template Dynamique
                    </DialogTitle>
                    <DialogDescription>
                        Étape {step}/2 - {step === 1 ? "Configuration" : "Définition des Labels"}
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Signature & Name */}
                {step === 1 && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nom du Template (template_name)</Label>
                            <Input
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Ex: Template EVOLEO"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type Fournisseur (supplier)</Label>
                                <Input
                                    value={supplierType}
                                    onChange={(e) => setSupplierType(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                                    placeholder="Ex: GENERAL"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fournisseur (Nom)</Label>
                                <Input value={supplier || ""} disabled />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description (Optionnel)</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ex: Template standard v1"
                            />
                        </div>

                        <div className="rounded-lg border p-4 bg-muted/30">
                            <Label className="text-xs font-semibold uppercase text-muted-foreground">Données Fournisseur fixes</Label>
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Adresse</Label>
                                    <Input
                                        className="h-8 text-xs"
                                        value={supplierData.address}
                                        onChange={(e) => setSupplierData({ ...supplierData, address: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Ville</Label>
                                    <Input
                                        className="h-8 text-xs"
                                        value={supplierData.city}
                                        onChange={(e) => setSupplierData({ ...supplierData, city: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Email</Label>
                                    <Input
                                        className="h-8 text-xs"
                                        value={supplierData.email}
                                        onChange={(e) => setSupplierData({ ...supplierData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Téléphone</Label>
                                    <Input
                                        className="h-8 text-xs"
                                        value={supplierData.phone}
                                        onChange={(e) => setSupplierData({ ...supplierData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Signature (Identifiant Unique)</Label>
                            <RadioGroup
                                value={selectedSignature ?? ""}
                                onValueChange={(v) => setSelectedSignature(v as "ICE" | "IF")}
                                className="space-y-3"
                            >
                                {hasIce && (
                                    <div
                                        onClick={() => setSelectedSignature("ICE")}
                                        className={`cursor-pointer rounded-lg border-2 p-4 transition ${selectedSignature === "ICE"
                                            ? "border-primary bg-primary/5"
                                            : "hover:border-primary/50"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="ICE" />
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Label className="text-base font-semibold">ICE</Label>
                                                    {selectedSignature === "ICE" && (
                                                        <Badge className="bg-primary">✓ Sélectionné</Badge>
                                                    )}
                                                </div>
                                                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                                                    {ice}
                                                </code>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {hasIf && (
                                    <div
                                        onClick={() => setSelectedSignature("IF")}
                                        className={`cursor-pointer rounded-lg border-2 p-4 transition ${selectedSignature === "IF"
                                            ? "border-primary bg-primary/5"
                                            : "hover:border-primary/50"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="IF" />
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Label className="text-base font-semibold">IF</Label>
                                                    {selectedSignature === "IF" && (
                                                        <Badge className="bg-primary">✓ Sélectionné</Badge>
                                                    )}
                                                </div>
                                                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                                                    {ifNumber}
                                                </code>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </RadioGroup>
                        </div>
                    </div>
                )}

                {/* Step 2: Field Labels */}
                {step === 2 && (
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                            💡 Pour chaque champ, ajoutez les <strong>labels</strong> (mots-clés) qui apparaissent
                            sur la facture. Ex: pour "Total HT", ajoutez "Total H.T.", "Montant HT", etc.
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {fieldDefinitions.map((field) => {
                                const detectedValue = invoice.fields.find(f => f.key === field.fieldName)?.value
                                return (
                                    <FieldLabelEditor
                                        key={field.fieldName}
                                        field={field}
                                        detectedValue={String(detectedValue || "")}
                                        onAddLabel={(label) => addLabel(field.fieldName, label)}
                                        onRemoveLabel={(index) => {
                                            setFieldDefinitions(prev =>
                                                prev.map(f =>
                                                    f.fieldName === field.fieldName
                                                        ? { ...f, labels: f.labels.filter((_, i) => i !== index) }
                                                        : f
                                                )
                                            )
                                        }}
                                        onUpdateSettings={(updates) => updateFieldSettings(field.fieldName, updates)}
                                    />
                                )
                            })}
                        </div>

                        <div className="text-sm text-muted-foreground">
                            Champs avec labels: {fieldDefinitions.filter(f => f.labels.length > 0).length} / {fieldDefinitions.length}
                            {" "}(minimum 1 requis)
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Annuler
                            </Button>
                            <Button
                                onClick={() => setStep(2)}
                                disabled={!canProceedToStep2}
                            >
                                Suivant <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                            </Button>
                            <Button onClick={handleCreate} disabled={!canCreate || isCreating}>
                                {isCreating ? (
                                    "Création..."
                                ) : (
                                    <>
                                        <Check className="mr-2 h-4 w-4" /> Créer le Template
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// Sub-component for editing labels of a single field
function FieldLabelEditor({
    field,
    detectedValue,
    onAddLabel,
    onRemoveLabel,
    onUpdateSettings,
}: {
    field: DynamicFieldDefinition
    detectedValue?: string
    onAddLabel: (label: string) => void
    onRemoveLabel: (index: number) => void
    onUpdateSettings: (updates: Partial<DynamicFieldDefinition>) => void
}) {
    const [newLabel, setNewLabel] = useState("")
    const [showAdvanced, setShowAdvanced] = useState(false)

    const handleAdd = () => {
        if (newLabel.trim()) {
            onAddLabel(newLabel)
            setNewLabel("")
        }
    }

    return (
        <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium">{field.fieldName}</div>
                    <div className="text-xs text-muted-foreground">
                        Type: {FIELD_TYPE_LABELS[field.fieldType]}
                        {field.required && <Badge className="ml-2 text-xs">Requis</Badge>}
                    </div>
                </div>
                {detectedValue && (
                    <div className="text-right">
                        <div className="text-[10px] uppercase text-muted-foreground font-semibold">Valeur détectée</div>
                        <div className="text-xs font-mono bg-primary/5 text-primary px-2 py-1 rounded border border-primary/10">
                            {detectedValue}
                        </div>
                    </div>
                )}
            </div>

            {/* Existing labels */}
            {field.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {field.labels.map((label, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                            {label}
                            <button
                                onClick={() => onRemoveLabel(index)}
                                className="ml-1 hover:text-destructive"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Add new label */}
            <div className="flex gap-2">
                <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="Ajouter un label (ex: Net à payer)..."
                    className="text-sm"
                />
                <Button onClick={handleAdd} size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className={`text-[10px] uppercase font-bold ${showAdvanced ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    Avançé
                </Button>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Regex Pattern</Label>
                        <Input
                            className="h-8 text-xs font-mono"
                            placeholder="(?:Total)\s*([0-9.]+)"
                            value={field.regexPattern || ""}
                            onChange={(e) => onUpdateSettings({ regexPattern: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Zone de recherche</Label>
                        <Select
                            value={field.searchZone || "ALL"}
                            onValueChange={(v) => onUpdateSettings({ searchZone: v as any })}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="HEADER">En-tête (Header)</SelectItem>
                                <SelectItem value="BODY">Corps (Body)</SelectItem>
                                <SelectItem value="FOOTER">Bas (Footer)</SelectItem>
                                <SelectItem value="ALL">Tout le document</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Méthode</Label>
                        <Select
                            value={field.detectionMethod || "LABEL_BASED"}
                            onValueChange={(v) => onUpdateSettings({ detectionMethod: v })}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LABEL_BASED">Labels seulement</SelectItem>
                                <SelectItem value="REGEX_BASED">Regex seulement</SelectItem>
                                <SelectItem value="HYBRID">Hybride (Label + Regex)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Confiance Min.</Label>
                        <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            className="h-8 text-xs"
                            value={field.confidenceThreshold || 0.7}
                            onChange={(e) => onUpdateSettings({ confidenceThreshold: parseFloat(e.target.value) })}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
