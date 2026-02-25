import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, FileText, Calendar } from "lucide-react"
import type { DetectedFieldPattern } from "@/lib/types"
import { formatDate } from "@/lib/utils"

interface PatternCardProps {
    pattern: DetectedFieldPattern
    onApprove: (patternId: number) => void
    onReject: (patternId: number) => void
}

export function PatternCard({ pattern, onApprove, onReject }: PatternCardProps) {
    const getStatusBadge = () => {
        switch (pattern.status) {
            case "PENDING":
                return <Badge className="bg-amber-500 text-white">En attente</Badge>
            case "APPROVED":
                return <Badge className="bg-green-600 text-white">Approuvé</Badge>
            case "REJECTED":
                return <Badge className="bg-red-500 text-white">Rejeté</Badge>
            default:
                return null
        }
    }

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                        {/* Header */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {pattern.invoiceNumber || `Facture #${pattern.invoiceId}`}
                                </span>
                            </div>
                            {getStatusBadge()}
                        </div>

                        {/* Pattern Info */}
                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-muted-foreground">Champ:</span>
                                <span className="font-medium">{pattern.fieldLabel}</span>
                                <Badge variant="outline" className="text-xs">
                                    {pattern.fieldName}
                                </Badge>
                            </div>

                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-muted-foreground">Pattern:</span>
                                <code className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-mono">
                                    {pattern.patternText}
                                </code>
                            </div>

                            {pattern.fieldValue && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Valeur:</span>
                                    <span className="text-sm">{pattern.fieldValue}</span>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>Détecté: {formatDate(pattern.detectedAt)}</span>
                                </div>
                                {pattern.approvedAt && (
                                    <div className="flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                        <span>Approuvé: {formatDate(pattern.approvedAt)}</span>
                                        {pattern.approvedBy && <span>par {pattern.approvedBy}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {pattern.status === "PENDING" && (
                        <div className="flex items-center gap-2 ml-4">
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => onApprove(pattern.patternId)}
                            >
                                <CheckCircle className="h-4 w-4" />
                                Approuver
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => onReject(pattern.patternId)}
                            >
                                <XCircle className="h-4 w-4" />
                                Rejeter
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
