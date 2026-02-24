"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Download, FileText } from "lucide-react"
import type { BankStatementV2 } from "@/lib/types"
import { BankStatementTable } from "./bank-statement-table"

interface ValidatedBankStatementsPageProps {
    statements: BankStatementV2[]
    onView: (statement: BankStatementV2) => void
    onDelete: (statementId: number) => void
    onMarkAsAccounted?: (statementId: number) => void
    onExport: (format: "csv" | "excel" | "pdf") => void
    title?: string
    emptyTitle?: string
    emptyDescription?: string
    statusWord?: string
}

export function ValidatedBankStatementsPage({
    statements,
    onView,
    onDelete,
    onMarkAsAccounted,
    onExport,
    title = "Relevés Bancaires Validés",
    emptyTitle = "Aucun relevé bancaire validé",
    emptyDescription = "Les relevés bancaires validés apparaîtront ici",
    statusWord = "validé",
}: ValidatedBankStatementsPageProps) {
    return (
        <div className="space-y-6">
            {/* En-tête */}
            <Card className="border-emerald-500/50 bg-emerald-500/10">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">{title}</CardTitle>
                                <CardDescription>
                                    {statements.length} relevé{statements.length > 1 ? "s" : ""} bancaire{statements.length > 1 ? "s" : ""} {statusWord}{statements.length > 1 ? "s" : ""}
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => onExport("excel")}
                                disabled={statements.length === 0}
                            >
                                <Download className="h-4 w-4" />
                                Exporter Excel
                            </Button>
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => onExport("pdf")}
                                disabled={statements.length === 0}
                            >
                                <Download className="h-4 w-4" />
                                Exporter PDF
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Tableau des relevés validés */}
            {statements.length > 0 ? (
                <BankStatementTable
                    statements={statements}
                    onView={onView}
                    onDelete={onDelete}
                    onMarkAsAccounted={onMarkAsAccounted}
                />
            ) : (
                <Card className="border-border/50">
                    <CardContent className="pt-16 pb-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium">{emptyTitle}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {emptyDescription}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
