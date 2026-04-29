import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    FileText,
    Save,
    Trash2,
    Eye,
    Loader2,
    MoreHorizontal,
    Edit2,
    X,
    CheckCircle2,
    RefreshCw
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BankStatementV2, BankTransactionV2 } from "@/releve-bancaire/types"
import { formatFileSize, formatDate } from "@/lib/utils"

interface BankStatementTableProps {
    statements: BankStatementV2[]
    onView: (statement: BankStatementV2) => void
    onDelete: (statementId: number) => void
    onValidate?: (statementId: number) => void
    onMarkAsAccounted?: (statementId: number) => void
    onReprocess?: (statement: BankStatementV2) => void
    onSave?: (statement: BankStatementV2) => void
    onUpdateStatement?: (statement: BankStatementV2) => void
    userRole?: string
}

export function BankStatementTable({ statements, onView, onDelete, onValidate, onMarkAsAccounted, onReprocess, onSave, onUpdateStatement, userRole }: BankStatementTableProps) {
    void onView
    void onSave
    // Initialiser les états de "Lier" à partir des données backend si disponibles
    const initialLinked = useMemo(() => {
        const linked: Record<number, boolean> = {};
        statements.forEach(s => {
            if (s.isLinked !== undefined) {
                linked[s.id] = s.isLinked;
            }
        });
        return linked;
    }, [statements]);

    const [linkedStatements, setLinkedStatements] = useState<Record<number, boolean>>(initialLinked)
    const [deleteStatementId, setDeleteStatementId] = useState<number | null>(null)
    const isClient = userRole === "CLIENT"
    const showActions = !isClient

    // Mettre à jour si les statements changent
    useEffect(() => {
        setLinkedStatements(prev => ({ ...prev, ...initialLinked }));
    }, [initialLinked]);

    const toggleLink = (id: number, checked: boolean) => {
        setLinkedStatements(prev => ({ ...prev, [id]: checked }))
    }

    const confirmDeleteStatement = () => {
        if (deleteStatementId == null) return
        onDelete(deleteStatementId)
        setDeleteStatementId(null)
    }

    const getStatusBadge = (status: string) => {
        const normalized = String(status || "").toUpperCase()
        switch (normalized) {
            case "PENDING":
            case "EN_ATTENTE":
                return <Badge className="bg-sky-400/10 text-sky-500 border-sky-400/30">En attente</Badge>
            case "PROCESSING":
            case "EN_COURS":
                return <Badge className="bg-blue-500/10 text-blue-600 border-blue-400/30 animate-pulse">En cours</Badge>
            case "TREATED":
            case "TRAITE":
            case "A_VERIFIER":
                return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/40 animate-pulse">À vérifier</Badge>
            case "READY_TO_VALIDATE":
            case "PRET_A_VALIDER":
                return <Badge className="bg-emerald-400/10 text-emerald-500 border-emerald-400/30">Prêt à valider</Badge>
            case "VALIDATED":
            case "VALIDE":
                return <Badge className="bg-emerald-600 text-white border-emerald-700">Validé</Badge>
            case "COMPTABILISE":
            case "COMPTABILISÉ":
                return <Badge className="bg-violet-600 text-white border-violet-700">Comptabilisé</Badge>
            case "ERROR":
            case "ERREUR":
                return <Badge className="bg-destructive text-white border-destructive">Erreur</Badge>
            case "PARTIAL_SUCCESS":
                return <Badge className="bg-orange-400/10 text-orange-600 border-orange-400/30">Succès Partiel</Badge>
            case "VIDE":
                return <Badge variant="outline" className="text-muted-foreground border-muted">Vide</Badge>
            case "DUPLIQUE":
            case "DUPLICATE":
                return <Badge variant="outline" className="text-muted-foreground border-muted">Dupliqué</Badge>
            default:
                return <Badge className="bg-muted/10 text-muted-foreground border-muted/30">{normalized || "INCONNU"}</Badge>
        }
    }

    const renderStatusCell = (statement: BankStatementV2) => {
        const displayStatus = String(statement.displayStatus || statement.status || "").toUpperCase()
        if (displayStatus === "PROCESSING" && statement.totalPages) {
            const progress = Math.round(((statement.processedPages || 0) / statement.totalPages) * 100);
            return (
                <div className="flex flex-col gap-1 w-24">
                    {getStatusBadge(displayStatus)}
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-sky-400 h-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center">
                        {statement.processedPages}/{statement.totalPages} pages
                    </span>
                </div>
            );
        }
        return getStatusBadge(displayStatus);
    }

    return (
        <>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="py-4">
                    <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-emerald-600 bg-emerald-100 p-1 rounded-md" />
                        <CardTitle className="text-xl">Relevés Bancaires</CardTitle>
                    </div>
                    <CardDescription className="ml-9">
                        {statements.length} relevé{statements.length > 1 ? "s" : ""} à gérer
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border/50 hover:bg-transparent bg-muted/30">
                                    <TableHead className="font-bold text-foreground">Nom du relevé</TableHead>
                                    <TableHead className="font-bold text-foreground">Période</TableHead>
                                    <TableHead className="font-bold text-foreground">Banque</TableHead>
                                    <TableHead className="font-bold text-foreground">RIB</TableHead>
                                    <TableHead className="font-bold text-foreground">Total Décaissement</TableHead>
                                    <TableHead className="font-bold text-foreground">Total Encaissement</TableHead>
                                    <TableHead className="font-bold text-foreground">Statut</TableHead>
                                    {showActions && <TableHead className="text-right font-bold text-foreground">Action</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.isArray(statements) && statements.map((statement) => {
                                    const isLinked = linkedStatements[statement.id] || false
                                    return (
                                        <TableRow key={statement.id} className="border-border/50 hover:bg-muted/10 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span>{statement.originalName || statement.filename}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {statement.month && statement.year ? `${String(statement.month).padStart(2, '0')}/${statement.year}` : "-"}
                                            </TableCell>
                                            <TableCell>{statement.bankName || "-"}</TableCell>
                                            <TableCell className="font-mono text-xs">{statement.rib || "-"}</TableCell>
                                            <TableCell className="text-red-500 font-medium whitespace-nowrap">
                                                {statement.totalDebit ? `${statement.totalDebit.toLocaleString()} DH` : "0.00 DH"}
                                            </TableCell>
                                            <TableCell className="text-emerald-500 font-medium whitespace-nowrap">
                                                {statement.totalCredit ? `${statement.totalCredit.toLocaleString()} DH` : "0.00 DH"}
                                            </TableCell>
                                            <TableCell>{renderStatusCell(statement)}</TableCell>
                                            {showActions && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="flex items-center gap-2 mr-2">
                                                            {/* Checkbox 'Lier' supprimée comme demandé */}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-primary hover:bg-primary/10"
                                                            onClick={() => onView(statement)}
                                                            title="Détails"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-32">
                                                                {(String(statement.displayStatus || statement.status || "").toUpperCase() === "TREATED"
                                                                    || String(statement.displayStatus || statement.status || "").toUpperCase() === "TRAITE"
                                                                    || String(statement.displayStatus || statement.status || "").toUpperCase() === "A_VERIFIER"
                                                                    || String(statement.displayStatus || statement.status || "").toUpperCase() === "READY_TO_VALIDATE"
                                                                    || String(statement.displayStatus || statement.status || "").toUpperCase() === "PRET_A_VALIDER") && onValidate && (
                                                                    <DropdownMenuItem className="text-emerald-600 gap-2" onClick={() => onValidate(statement.id)}>
                                                                        <CheckCircle2 className="h-4 w-4" /> Valider
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {(String(statement.displayStatus || statement.status || "").toUpperCase() === "VALIDATED"
                                                                    || String(statement.displayStatus || statement.status || "").toUpperCase() === "VALIDE") && onMarkAsAccounted && (
                                                                    <DropdownMenuItem className="text-violet-700 gap-2" onClick={() => onMarkAsAccounted(statement.id)}>
                                                                        <CheckCircle2 className="h-4 w-4" /> Comptabiliser
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {(statement.canReprocess || String(statement.displayStatus || statement.status || "").toUpperCase() === "ERROR" || String(statement.displayStatus || statement.status || "").toUpperCase() === "ERREUR") && onReprocess && (
                                                                    <DropdownMenuItem className="text-blue-600 gap-2" onClick={() => onReprocess(statement)}>
                                                                        <RefreshCw className="h-4 w-4" /> Reprocesser
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem className="text-destructive gap-2" onClick={() => setDeleteStatementId(statement.id)}>
                                                                    <Trash2 className="h-4 w-4" /> Supprimer
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={deleteStatementId !== null} onOpenChange={(open) => { if (!open) setDeleteStatementId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de supprimer ce fichier ?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDeleteStatement() }}>
                            Oui
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

interface BankTransactionTableProps {
    transactions: BankTransactionV2[]
    statement?: BankStatementV2
    onUpdate?: (transaction: BankTransactionV2) => void
    onBulkUpdate?: (ids: number[], data: Partial<BankTransactionV2>) => void
}

export function BankTransactionTable({ transactions, statement, onUpdate }: BankTransactionTableProps) {
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editedFields, setEditedFields] = useState<Partial<BankTransactionV2>>({})

    const handleEdit = (tx: BankTransactionV2) => {
        setEditingId(tx.id)
        setEditedFields({ ...tx })
    }

    const handleSave = (tx: BankTransactionV2) => {
        if (onUpdate) {
            onUpdate({ ...tx, ...editedFields } as BankTransactionV2)
        }
        setEditingId(null)
    }

    return (
        <Card className="border-border/50 bg-card/50">
            <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-emerald-600 bg-emerald-100 p-1 rounded-md" />
                        <CardTitle className="text-xl">Prévisualisation du Relevé</CardTitle>
                    </div>
                    {statement && (
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-muted-foreground uppercase font-semibold">Compte</span>
                                <Badge variant={statement.isLinked ? "default" : "outline"} className={statement.isLinked ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "text-orange-600 bg-orange-500/10 border-orange-500/60"}>
                                    {statement.isLinked ? "LIÉ" : "NON LIÉ"}
                                </Badge>
                            </div>
                            <div className="flex flex-col items-end border-l pl-4 border-border/50">
                                <span className="text-xs text-muted-foreground uppercase font-semibold">Transactions</span>
                                <span className="font-bold">{statement.transactionCount || 0}</span>
                            </div>
                            <div className="flex flex-col items-end border-l pl-4 border-border/50">
                                <span className="text-xs text-muted-foreground uppercase font-semibold text-red-500">Débit Total</span>
                                <span className="font-bold text-red-500">
                                    {statement.totalDebit ? `${statement.totalDebit.toLocaleString()} DH` : "0.00 DH"}
                                </span>
                            </div>
                            <div className="flex flex-col items-end border-l pl-4 border-border/50">
                                <span className="text-xs text-muted-foreground uppercase font-semibold text-emerald-500">Crédit Total</span>
                                <span className="font-bold text-emerald-500">
                                    {statement.totalCredit ? `${statement.totalCredit.toLocaleString()} DH` : "0.00 DH"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <CardDescription className={statement ? "mt-1 ml-9" : "ml-9"}>
                    {transactions.length} transactions gérées
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead>Date Opération</TableHead>
                                <TableHead>Date Valeur</TableHead>
                                <TableHead>Compte</TableHead>
                                <TableHead>Libellé</TableHead>
                                <TableHead>RIB</TableHead>
                                <TableHead>Débit</TableHead>
                                <TableHead>Crédit</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.isArray(transactions) && transactions.map((tx) => (
                                <TableRow key={tx.id} className="border-border/50 hover:bg-muted/10 transition-colors">
                                    <TableCell className="whitespace-nowrap">{tx.dateOperation}</TableCell>
                                    <TableCell className="whitespace-nowrap">{tx.dateValeur}</TableCell>
                                    <TableCell>
                                        <div
                                            className={`px-3 py-1.5 rounded-lg font-mono text-sm inline-flex items-center gap-2 transition-all duration-300 ${tx.isLinked ? "text-orange-600 bg-orange-500/10 font-bold border-2 border-orange-500/60 shadow-sm shadow-orange-500/10" : "text-muted-foreground"}`}
                                        >
                                            {tx.isLinked && <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]" />}
                                            {tx.compte}
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate" title={tx.libelle}>{tx.libelle}</TableCell>
                                    <TableCell className="font-mono text-xs">{tx.rib || "-"}</TableCell>
                                    <TableCell className="text-red-500 font-medium whitespace-nowrap">
                                        {tx.debit > 0 ? `${tx.debit.toLocaleString()} DH` : ""}
                                    </TableCell>
                                    <TableCell className="text-emerald-500 font-medium whitespace-nowrap">
                                        {tx.credit > 0 ? `${tx.credit.toLocaleString()} DH` : ""}
                                    </TableCell>
                                    <TableCell>
                                        {tx.isValid ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Valide</Badge>
                                        ) : tx.needsReview ? (
                                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">À réviser</Badge>
                                        ) : (
                                            <Badge variant="outline">OCR</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="flex items-center gap-2 mr-2">
                                                <Checkbox
                                                    id={`link-${tx.id}`}
                                                    checked={tx.isLinked}
                                                    onCheckedChange={(checked) => {
                                                        if (onUpdate) {
                                                            onUpdate({
                                                                ...tx,
                                                                isLinked: !!checked
                                                            })
                                                        }
                                                    }}
                                                    className="h-4 w-4 border-muted-foreground data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                                />
                                                <label htmlFor={`link-${tx.id}`} className="text-xs font-medium cursor-pointer">Lier</label>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(tx)}>
                                                        <Edit2 className="h-4 w-4 mr-2" /> Modifier
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
