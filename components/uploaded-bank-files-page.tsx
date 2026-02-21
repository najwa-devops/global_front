"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileText, Scan, Loader2, CheckCircle2, Zap, Eye } from "lucide-react"
import type { LocalBankStatement } from "@/lib/types"
import { formatFileSize, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface UploadedBankFilesPageProps {
    statements: LocalBankStatement[]
    onProcessAll: () => Promise<void>
    onProcessSingle: (statement: LocalBankStatement) => Promise<void>
    onView: (statement: LocalBankStatement) => void
    onNavigateToDashboard: () => void
}

export function UploadedBankFilesPage({
    statements,
    onProcessAll,
    onProcessSingle,
    onView,
    onNavigateToDashboard,
}: UploadedBankFilesPageProps) {
    const [isProcessingAll, setIsProcessingAll] = useState(false)
    const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())

    const handleProcessAll = async () => {
        setIsProcessingAll(true)
        try {
            await onProcessAll()
            toast.success(`${statements.length} relevé(s) bancaire(s) traité(s) avec succès`)
        } catch (error) {
            toast.error("Erreur lors du traitement")
        } finally {
            setIsProcessingAll(false)
        }
    }

    const handleProcessSingle = async (statement: LocalBankStatement) => {
        setProcessingIds(prev => new Set(prev).add(statement.id))
        try {
            await onProcessSingle(statement)
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(statement.id)
                return newSet
            })
        }
    }

    const allProcessed = statements.every(stmt => stmt.status !== "pending")

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                                <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">Relevés Bancaires Uploadés</CardTitle>
                                <CardDescription>
                                    {statements.length} fichier{statements.length > 1 ? "s" : ""} prêt{statements.length > 1 ? "s" : ""} à être traité{statements.length > 1 ? "s" : ""}
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {allProcessed ? (
                                <Button className="gap-2" onClick={onNavigateToDashboard}>
                                    <CheckCircle2 className="h-5 w-5" />
                                    Voir le Tableau de Bord
                                </Button>
                            ) : (
                                <Button
                                    className="gap-2"
                                    onClick={handleProcessAll}
                                    disabled={isProcessingAll || statements.length === 0}
                                >
                                    {isProcessingAll ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Traitement en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="h-5 w-5" />
                                            Traiter Tout ({statements.length})
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Tableau des fichiers */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border/50 hover:bg-transparent">
                                    <TableHead className="w-16">Aperçu</TableHead>
                                    <TableHead>Nom du fichier</TableHead>
                                    <TableHead>Date upload</TableHead>
                                    <TableHead>Taille</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statements.map((statement) => {
                                    const isProcessing = processingIds.has(statement.id) || statement.isProcessing
                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(statement.filename)

                                    return (
                                        <TableRow key={statement.id} className="border-border/50">
                                            <TableCell>
                                                <div className="h-12 w-12 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center overflow-hidden relative">
                                                    {isProcessing && (
                                                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        </div>
                                                    )}
                                                    {statement.fileUrl && isImage ? (
                                                        <img
                                                            src={statement.fileUrl}
                                                            alt={statement.filename}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="font-medium">{statement.filename}</TableCell>
                                            <TableCell className="text-muted-foreground">{formatDate(statement.createdAt)}</TableCell>
                                            <TableCell className="text-muted-foreground">{formatFileSize(statement.fileSize)}</TableCell>
                                            <TableCell>
                                                {statement.status === "pending" && (
                                                    <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30">
                                                        En attente
                                                    </Badge>
                                                )}
                                                {statement.status === "processing" && (
                                                    <Badge className="bg-sky-400/10 text-sky-400 border-sky-400/30">
                                                        En cours
                                                    </Badge>
                                                )}
                                                {statement.status === "treated" && (
                                                    <Badge className="bg-primary/10 text-primary border-primary/30">
                                                        Traité
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onView(statement)}
                                                        className="gap-1"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        Voir
                                                    </Button>
                                                    {statement.status === "pending" && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleProcessSingle(statement)}
                                                            disabled={isProcessing}
                                                            className="gap-1"
                                                        >
                                                            {isProcessing ? (
                                                                <>
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    Traitement...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Scan className="h-4 w-4" />
                                                                    Traiter
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                    {statement.status === "treated" && (
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                                            ✓ Prêt
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
