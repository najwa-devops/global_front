"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Save, Trash2, Eye, Loader2 } from "lucide-react"
import type { LocalBankStatement, BankStatementField } from "@/lib/types"
import { formatFileSize, formatDate } from "@/lib/utils"

interface BankStatementTableProps {
    statements: LocalBankStatement[]
    onView: (statement: LocalBankStatement) => void
    onDelete: (statementId: number) => void
    onSave?: (statement: LocalBankStatement) => void
}

export function BankStatementTable({ statements, onView, onDelete, onSave }: BankStatementTableProps) {
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editedFields, setEditedFields] = useState<BankStatementField[]>([])

    const handleEdit = (statement: LocalBankStatement) => {
        setEditingId(statement.id)
        setEditedFields([...statement.fields])
    }

    const handleFieldChange = (fieldKey: string, value: string) => {
        setEditedFields(prev =>
            prev.map(field =>
                field.key === fieldKey ? { ...field, value } : field
            )
        )
    }

    const handleSave = (statement: LocalBankStatement) => {
        if (onSave) {
            onSave({
                ...statement,
                fields: editedFields,
            })
        }
        setEditingId(null)
        setEditedFields([])
    }

    const handleCancel = () => {
        setEditingId(null)
        setEditedFields([])
    }

    const getFieldValue = (statement: LocalBankStatement, fieldKey: string): string => {
        if (editingId === statement.id) {
            const field = editedFields.find(f => f.key === fieldKey)
            return String(field?.value || "")
        }
        const field = statement.fields.find(f => f.key === fieldKey)
        return String(field?.value || "")
    }

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case "pending":
                return <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30">En attente</Badge>
            case "processing":
                return <Badge className="bg-sky-400/10 text-sky-400 border-sky-400/30">En cours</Badge>
            case "validated":
                return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Validé</Badge>
            default:
                return <Badge className="bg-muted/10 text-muted-foreground border-muted/30">-</Badge>
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    Relevés Bancaires
                </CardTitle>
                <CardDescription>
                    {statements.length} relevé{statements.length > 1 ? "s" : ""} bancaire{statements.length > 1 ? "s" : ""}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border/50 hover:bg-transparent">
                                <TableHead className="w-16">Aperçu</TableHead>
                                <TableHead>Fichier</TableHead>
                                <TableHead>Date Opération</TableHead>
                                <TableHead>Date Valeur</TableHead>
                                <TableHead>Libellé</TableHead>
                                <TableHead>Débit</TableHead>
                                <TableHead>Crédit</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {statements.map((statement) => {
                                const isEditing = editingId === statement.id
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(statement.filename)

                                return (
                                    <TableRow key={statement.id} className="border-border/50">
                                        <TableCell>
                                            <div className="h-12 w-12 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center overflow-hidden">
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

                                        <TableCell className="font-medium max-w-[200px] truncate">
                                            {statement.filename}
                                        </TableCell>

                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="date"
                                                    value={getFieldValue(statement, "dateOperation")}
                                                    onChange={(e) => handleFieldChange("dateOperation", e.target.value)}
                                                    className="w-[150px]"
                                                />
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {getFieldValue(statement, "dateOperation") || "-"}
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="date"
                                                    value={getFieldValue(statement, "dateValeur")}
                                                    onChange={(e) => handleFieldChange("dateValeur", e.target.value)}
                                                    className="w-[150px]"
                                                />
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {getFieldValue(statement, "dateValeur") || "-"}
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="text"
                                                    value={getFieldValue(statement, "libelle")}
                                                    onChange={(e) => handleFieldChange("libelle", e.target.value)}
                                                    className="min-w-[200px]"
                                                />
                                            ) : (
                                                <span className="text-muted-foreground max-w-[250px] truncate block">
                                                    {getFieldValue(statement, "libelle") || "-"}
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={getFieldValue(statement, "debit")}
                                                    onChange={(e) => handleFieldChange("debit", e.target.value)}
                                                    className="w-[120px]"
                                                />
                                            ) : (
                                                <span className="text-red-500 font-medium">
                                                    {getFieldValue(statement, "debit") ? `${getFieldValue(statement, "debit")} DH` : "-"}
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={getFieldValue(statement, "credit")}
                                                    onChange={(e) => handleFieldChange("credit", e.target.value)}
                                                    className="w-[120px]"
                                                />
                                            ) : (
                                                <span className="text-emerald-500 font-medium">
                                                    {getFieldValue(statement, "credit") ? `${getFieldValue(statement, "credit")} DH` : "-"}
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            {getStatusBadge(statement.status)}
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex items-center justify-end gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={handleCancel}
                                                        >
                                                            Annuler
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSave(statement)}
                                                            className="gap-1"
                                                        >
                                                            <Save className="h-4 w-4" />
                                                            Sauvegarder
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onView(statement)}
                                                            className="gap-1"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            Voir
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(statement)}
                                                            className="gap-1"
                                                        >
                                                            Éditer
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onDelete(statement.id)}
                                                            className="gap-1 text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
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
    )
}
