"use client"

import { Card, CardContent } from "@/components/ui/card"
import { FileText, Clock, CheckCircle, Building2 } from "lucide-react"
import type { BankStatementStats } from "@/lib/types"

interface BankStatsCardsProps {
    stats: BankStatementStats | null
}

export function BankStatsCards({ stats }: BankStatsCardsProps) {
    if (!stats) return null;

    const cards = [
        {
            label: "Total relevés",
            value: stats.total,
            icon: FileText,
            color: "text-primary",
            bgColor: "bg-primary/10",
            borderColor: "border-primary/20",
        },
        {
            label: "En traitement",
            value: stats.pending + stats.processing,
            icon: Clock,
            color: "text-amber-400",
            bgColor: "bg-amber-400/10",
            borderColor: "border-amber-400/20",
        },
        {
            label: "Validés",
            value: stats.validated,
            icon: CheckCircle,
            color: "text-emerald-400",
            bgColor: "bg-emerald-400/10",
            borderColor: "border-emerald-400/20",
        },
        {
            label: "Comptabilisés",
            value: stats.accounted || 0,
            icon: CheckCircle,
            color: "text-violet-500",
            bgColor: "bg-violet-500/10",
            borderColor: "border-violet-500/20",
        },
        {
            label: "RIBs identifiés",
            value: stats.totalRibs,
            icon: Building2,
            color: "text-sky-400",
            bgColor: "bg-sky-400/10",
            borderColor: "border-sky-400/20",
        },
    ]

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((card, index) => (
                <Card
                    key={card.label}
                    className={`border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-card/80 hover:border-border animate-slide-up`}
                    style={{ animationDelay: `${index * 100}ms` }}
                >
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div
                                className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.bgColor} ${card.borderColor} border`}
                            >
                                <card.icon className={`h-5 w-5 ${card.color}`} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-bold tracking-tight text-foreground">
                                {card.value}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">{card.label}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
