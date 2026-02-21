"use client"

import { AuthGuard } from "@/components/auth-guard"
import { MOCK_GLOBAL_STATS, MOCK_COMPTABLES, MOCK_DOSSIERS } from "@/src/mock/data.mock"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    FileText, CheckCircle2, Clock, TrendingUp, Users,
    FolderOpen, Building2, BarChart3, ArrowUp, ArrowDown
} from "lucide-react"

function StatsPageContent() {
    const stats = MOCK_GLOBAL_STATS

    return (
        <div className="space-y-6">
            {/* Top KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Factures ce mois", value: stats.invoicesThisMonth, prev: stats.invoicesLastMonth, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { label: "Validées", value: stats.validatedInvoices, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
                    { label: "En attente", value: stats.pendingInvoices, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
                    { label: "Relevés bancaires", value: stats.totalBankStatements, icon: Building2, color: "text-purple-500", bg: "bg-purple-500/10" },
                ].map(stat => {
                    const trend = "prev" in stat ? ((stat.value - stat.prev!) / stat.prev! * 100).toFixed(0) : null
                    const isUp = trend && Number(trend) >= 0
                    return (
                        <Card key={stat.label} className="border-border/50">
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                                        {trend && (
                                            <p className={`text-[10px] flex items-center gap-0.5 ${isUp ? "text-green-500" : "text-red-500"}`}>
                                                {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                                                {Math.abs(Number(trend))}% vs mois dernier
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Validation Rate */}
            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Taux de validation global
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4">
                        <p className="text-5xl font-bold text-green-500">{stats.validationRate}%</p>
                        <p className="text-sm text-muted-foreground mb-2">
                            {stats.validatedInvoices} validées sur {stats.totalInvoices} factures totales
                        </p>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all" style={{ width: `${stats.validationRate}%` }} />
                    </div>
                </CardContent>
            </Card>

            {/* Per Comptable Stats */}
            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Statistiques par comptable
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {MOCK_COMPTABLES.map(comptable => {
                        const dossiers = MOCK_DOSSIERS.filter(d => d.comptableId === comptable.id)
                        const totalInv = dossiers.reduce((s, d) => s + d.invoicesCount, 0)
                        const validatedInv = dossiers.reduce((s, d) => s + d.validatedInvoicesCount, 0)
                        const rate = totalInv > 0 ? Math.round(validatedInv / totalInv * 100) : 0
                        return (
                            <div key={comptable.id} className="space-y-1.5">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                            {comptable.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                        </div>
                                        <span className="font-medium">{comptable.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>{dossiers.length} dossiers</span>
                                        <span>{totalInv} factures</span>
                                        <span className="font-semibold text-foreground">{rate}%</span>
                                    </div>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all"
                                        style={{ width: `${rate}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: "Total comptables", value: stats.totalComptables, sub: `${stats.activeComptables} actifs`, icon: Users },
                    { label: "Total fournisseurs", value: stats.totalFournisseurs, sub: "comptes actifs", icon: Building2 },
                    { label: "Délai moyen traitement", value: `${stats.avgProcessingTimeDays}j`, sub: "par facture", icon: Clock },
                ].map(s => (
                    <Card key={s.label} className="border-border/50">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <s.icon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{s.value}</p>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className="text-[10px] text-muted-foreground/70">{s.sub}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

export default function StatistiquesPage() {
    return (
        <AuthGuard allowedRoles={["SUPER_ADMIN"]}>
            <StatsPageContent />
        </AuthGuard>
    )
}
