"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft,
    FileText,
    Save,
    Target,
    X,
    Loader2,
    CheckCircle,
    Banknote,
    Calendar,
    Building2,
    CreditCard,
    TrendingUp,
    TrendingDown,
    FileJson,
    FileSpreadsheet,
} from "lucide-react"
import type { LocalBankStatement, BankStatementField, BankTransaction } from "@/lib/types"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"

interface OcrProcessingBankPageProps {
    statement: LocalBankStatement
    file: File | null
    onBack: () => void
    onSave: (statement: LocalBankStatement) => void
}

export function OcrProcessingBankPage({
    statement,
    file,
    onBack,
    onSave,
}: OcrProcessingBankPageProps) {
    void file

    const [fields, setFields] = useState<BankStatementField[]>(statement.fields || [])
    const [isSaving, setIsSaving] = useState(false)
    const [isProcessingOcr, setIsProcessingOcr] = useState(false)
    const [isSelectingPosition, setIsSelectingPosition] = useState<string | null>(null)
    const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"summary" | "transactions" | "raw">("summary")

    const transactions: BankTransaction[] =
        (Array.isArray(statement.transactions) && statement.transactions.length > 0
            ? statement.transactions
            : statement.transactionsPreview) || []

    const handleOcrExtract = async () => {
        setIsProcessingOcr(true)
        toast.loading("Traitement OCR du relevé en cours...")

        try {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            toast.dismiss()
            toast.success("Données extraites avec succès")
        } catch {
            toast.dismiss()
            toast.error("Erreur lors de l'extraction")
        } finally {
            setIsProcessingOcr(false)
        }
    }

    const updateFieldValue = (key: string, value: string) => {
        setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)))
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const updatedStatement: LocalBankStatement = {
                ...statement,
                fields,
                status: "validated",
            }
            onSave(updatedStatement)
            toast.success("Relevé bancaire enregistré")
        } catch {
            toast.error("Erreur lors de l'enregistrement")
        } finally {
            setIsSaving(false)
        }
    }

    const startSelection = (key: string) => {
        setIsSelectingPosition(key)
        setSelectedFieldKey(key)
        toast.info("Sélectionnez la zone dans le document")
    }

    const clearFieldValue = (key: string) => {
        setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value: "" } : f)))
    }

    const formatNumber = (value: number | null | undefined) => {
        if (value === null || value === undefined) return "-"
        return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
    }

    const totalTransactions = transactions.length
    const totalCredit = transactions.reduce((sum, t) => sum + Number(t.credit || 0), 0)
    const totalDebit = transactions.reduce((sum, t) => sum + Number(t.debit || 0), 0)

    const isValidated = statement.status === "validated"
    const statusText = isValidated
        ? "Validé"
        : statement.statusCode === "READY_TO_VALIDATE"
            ? "Prêt à valider"
            : "À traiter"

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Relevé Bancaire: {statement.originalName || statement.filename}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                            <span>Date: {formatDate(statement.createdAt)}</span>
                            <Badge
                                variant="outline"
                                className={isValidated ? "border-emerald-600 text-emerald-700" : "border-amber-500 text-amber-700"}
                            >
                                {statusText}
                            </Badge>
                            {statement.bankName && (
                                <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {statement.bankName}
                                </span>
                            )}
                            {statement.month && statement.year && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {statement.month}/{statement.year}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="gap-2 bg-transparent"
                        onClick={handleOcrExtract}
                        disabled={isProcessingOcr}
                    >
                        <Loader2 className={`h-4 w-4 ${isProcessingOcr ? "animate-spin" : ""}`} />
                        Reprocesser OCR
                    </Button>
                    <Button className="gap-2" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Valider le relevé
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">RIB</span>
                        </div>
                        <p className="text-sm font-mono mt-1 break-all">{statement.rib || "Non disponible"}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-muted-foreground">Total Crédits</span>
                        </div>
                        <p className="text-lg font-bold text-green-600 mt-1">{formatNumber(statement.totalCredit ?? totalCredit)} DH</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="text-xs text-muted-foreground">Total Débits</span>
                        </div>
                        <p className="text-lg font-bold text-red-600 mt-1">{formatNumber(statement.totalDebit ?? totalDebit)} DH</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-blue-600" />
                            <span className="text-xs text-muted-foreground">Transactions</span>
                        </div>
                        <p className="text-lg font-bold mt-1">{statement.transactionCount ?? totalTransactions}</p>
                        {statement.validTransactionCount !== undefined && (
                            <p className="text-xs text-muted-foreground mt-1">{statement.validTransactionCount} valides</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="flex gap-2 mb-4 border-b overflow-x-auto">
                <Button
                    variant="ghost"
                    className={`px-4 py-2 rounded-none border-b-2 ${activeTab === "summary" ? "border-primary text-primary" : "border-transparent"}`}
                    onClick={() => setActiveTab("summary")}
                >
                    <FileText className="h-4 w-4 mr-2" />
                    Résumé
                </Button>
                <Button
                    variant="ghost"
                    className={`px-4 py-2 rounded-none border-b-2 ${activeTab === "transactions" ? "border-primary text-primary" : "border-transparent"}`}
                    onClick={() => setActiveTab("transactions")}
                >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Transactions ({transactions.length})
                </Button>
                <Button
                    variant="ghost"
                    className={`px-4 py-2 rounded-none border-b-2 ${activeTab === "raw" ? "border-primary text-primary" : "border-transparent"}`}
                    onClick={() => setActiveTab("raw")}
                >
                    <FileJson className="h-4 w-4 mr-2" />
                    Données brutes
                </Button>
            </div>

            <div className="space-y-4">
                {activeTab === "summary" && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Informations générales</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">RIB</Label>
                                        <p className="text-sm font-mono break-all">{statement.rib || "-"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Titulaire du compte</Label>
                                        <p className="text-sm">{statement.accountHolder || "-"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Banque</Label>
                                        <p className="text-sm">{statement.bankName || "-"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Période</Label>
                                        <p className="text-sm">{statement.month && statement.year ? `${statement.month}/${statement.year}` : "-"}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Soldes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-muted/30 rounded-lg">
                                        <Label className="text-xs text-muted-foreground">Solde d'ouverture</Label>
                                        <p className="text-lg font-semibold">{formatNumber(statement.openingBalance)} DH</p>
                                    </div>
                                    <div className="p-3 bg-muted/30 rounded-lg">
                                        <Label className="text-xs text-muted-foreground">Solde de clôture</Label>
                                        <p className="text-lg font-semibold">{formatNumber(statement.closingBalance)} DH</p>
                                    </div>
                                </div>
                                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs text-muted-foreground">Contrôle de continuité</Label>
                                        <Badge
                                            variant="outline"
                                            className={statement.isContinuityValid ? "border-emerald-600 text-emerald-700" : "border-destructive text-destructive"}
                                        >
                                            {statement.continuityStatus || "Non vérifié"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-base">Données extraites</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    {fields.length > 0 ? (
                                        fields.map((field) => (
                                            <div key={field.key} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor={field.key} className="text-xs font-medium">
                                                        {field.label}
                                                    </Label>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={`h-7 px-2 text-[10px] ${isSelectingPosition === field.key ? "text-primary bg-primary/10" : ""}`}
                                                            onClick={() => startSelection(field.key)}
                                                        >
                                                            <Target className="h-3 w-3 mr-1" />
                                                            Pointer
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                                                            onClick={() => clearFieldValue(field.key)}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <Input
                                                    id={field.key}
                                                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                                    value={String(field.value || "")}
                                                    onChange={(e) => updateFieldValue(field.key, e.target.value)}
                                                    className={selectedFieldKey === field.key ? "ring-2 ring-primary border-primary" : ""}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-2 text-center py-8">
                                            <p className="text-sm text-muted-foreground">
                                                Aucune donnée extraite. Cliquez sur "Reprocesser OCR" pour lancer l'extraction.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-base">Métadonnées</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-xs text-muted-foreground">Taille du fichier</span>
                                        <p className="font-medium">{((statement.fileSize || 0) / 1024).toFixed(2)} KB</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Date de création</span>
                                        <p className="font-medium">{formatDate(statement.createdAt)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Dernière modification</span>
                                        <p className="font-medium">{formatDate(statement.updatedAt || statement.createdAt)}</p>
                                    </div>
                                    {statement.validatedAt && (
                                        <div>
                                            <span className="text-xs text-muted-foreground">Validé le</span>
                                            <p className="font-medium">{formatDate(statement.validatedAt)}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-xs text-muted-foreground">Confiance globale</span>
                                        <p className="font-medium">{statement.overallConfidence !== undefined ? `${(statement.overallConfidence * 100).toFixed(0)}%` : "-"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Chemin du fichier</span>
                                        <p className="font-medium text-xs truncate" title={statement.filePath}>
                                            {statement.filePath || "-"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "transactions" && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>Liste des transactions</span>
                                <Badge variant="outline">{transactions.length} transactions</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                {transactions.length > 0 ? (
                                    transactions.map((transaction, index) => (
                                        <div key={transaction.id || index} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        #{transaction.transactionIndex || index + 1}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className={transaction.sens === "CREDIT" ? "border-emerald-600 text-emerald-700 text-xs" : "border-destructive text-destructive text-xs"}
                                                    >
                                                        {transaction.sens || "-"}
                                                    </Badge>
                                                    {transaction.isValid && <CheckCircle className="h-3 w-3 text-green-500" />}
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    Confiance: {transaction.confidenceScore !== undefined ? `${(transaction.confidenceScore * 100).toFixed(0)}%` : "-"}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Date opération</span>
                                                    <p className="font-medium">{transaction.dateOperation || "-"}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Date valeur</span>
                                                    <p className="font-medium">{transaction.dateValeur || "-"}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-xs text-muted-foreground">Libellé</span>
                                                    <p className="font-medium truncate" title={transaction.libelle}>
                                                        {transaction.libelle || "-"}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Débit</span>
                                                    <p className="text-red-600 font-semibold">{formatNumber(transaction.debit)} DH</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Crédit</span>
                                                    <p className="text-green-600 font-semibold">{formatNumber(transaction.credit)} DH</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-xs text-muted-foreground">Description</span>
                                                    <p className="text-sm truncate" title={transaction.description}>
                                                        {transaction.description || "-"}
                                                    </p>
                                                </div>
                                            </div>
                                            {Array.isArray(transaction.flags) && transaction.flags.length > 0 && (
                                                <div className="mt-3 flex gap-1 flex-wrap">
                                                    {transaction.flags.map((flag, i) => (
                                                        <Badge key={`${flag}-${i}`} variant="outline" className="text-[10px] border-amber-500 text-amber-700">
                                                            {flag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">Aucune transaction trouvée</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === "raw" && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Texte OCR brut</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap font-mono">
                                    {statement.rawOcrText || "Aucun texte OCR disponible"}
                                </pre>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Texte OCR nettoyé</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap font-mono">
                                    {statement.cleanedOcrText || "Aucun texte nettoyé disponible"}
                                </pre>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">Conseil</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Vérifiez attentivement les dates et les montants avant de valider le relevé pour assurer une comptabilité précise.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
