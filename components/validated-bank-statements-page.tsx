"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Download, FileText } from "lucide-react"
import type { LocalBankStatement } from "@/lib/types"
import { BankStatementTable } from "./bank-statement-table"
import type { FilterValues } from "./invoice-filters"

interface ValidatedBankStatementsPageProps {
    statements: LocalBankStatement[]
    filters: FilterValues
    onFiltersChange: (filters: FilterValues) => void
    onView: (statement: LocalBankStatement) => void
    onDelete: (statementId: number) => void
    onExport: (format: "csv" | "excel" | "pdf") => void
}

export function ValidatedBankStatementsPage({
    statements,
    filters,
    onFiltersChange,
    onView,
    onDelete,
    onExport,
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
                                <CardTitle className="text-2xl">Relevés Bancaires Validés</CardTitle>
                                <CardDescription>
                                    {statements.length} relevé{statements.length > 1 ? "s" : ""} bancaire{statements.length > 1 ? "s" : ""} validé{statements.length > 1 ? "s" : ""}
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
                />
            ) : (
                <Card className="border-border/50">
                    <CardContent className="pt-16 pb-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium">Aucun relevé bancaire validé</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Les relevés bancaires validés apparaîtront ici
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
