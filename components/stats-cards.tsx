"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Clock, CheckCircle, TrendingUp } from "lucide-react"
import type { DynamicInvoice } from "@/lib/types"
import { api } from "@/lib/api"
import { formatAmount, toWorkflowStatus } from "@/lib/utils"

interface StatsCardsProps {
  invoices: DynamicInvoice[]
}

export function StatsCards({ invoices }: StatsCardsProps) {
  const [serverStats, setServerStats] = useState<Record<string, number> | null>(null)

  const localStats = useMemo(() => {
    return {
      total: invoices.length,
      pending: invoices.filter((i) =>
        ["VERIFY", "READY_TO_TREAT", "READY_TO_VALIDATE"].includes(toWorkflowStatus(i.status))
      ).length,
      validated: invoices.filter((i) => toWorkflowStatus(i.status) === "VALIDATED").length,
      errors: invoices.filter((i) => toWorkflowStatus(i.status) === "REJECTED").length,
    }
  }, [invoices])

  useEffect(() => {
    let mounted = true

    const loadStats = async () => {
      try {
        const stats = await api.getInvoiceStats()
        if (mounted) setServerStats((stats || {}) as Record<string, number>)
      } catch {
        if (mounted) setServerStats(null)
      }
    }

    loadStats()
    return () => {
      mounted = false
    }
  }, [invoices])

  const hasServerPending =
    serverStats?.verify !== undefined ||
    serverStats?.readyToTreat !== undefined ||
    serverStats?.readyToValidate !== undefined

  const stats = {
    total: serverStats?.total ?? localStats.total,
    pending: hasServerPending
      ? (serverStats?.verify ?? 0) + (serverStats?.readyToTreat ?? 0) + (serverStats?.readyToValidate ?? 0)
      : localStats.pending,
    validated: serverStats?.validated ?? localStats.validated,
    errors: serverStats?.rejected ?? localStats.errors,
  }

  const totalAmount = invoices.reduce((sum, inv) => {
    const ttc = Number.parseFloat(String(inv.fields.find((f) => f.key === "amountTTC")?.value || "0"))
    return sum + ttc
  }, 0)

  const cards = [
    {
      label: "Total factures",
      value: stats.total,
      icon: FileText,
      trend: "+12%",
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
    },
    {
      label: "En attente",
      value: stats.pending,
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
      borderColor: "border-amber-400/20",
    },
    {
      label: "Validees",
      value: stats.validated,
      icon: CheckCircle,
      trend: "+8%",
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      borderColor: "border-emerald-400/20",
    },
    {
      label: "Montant total",
      value: formatAmount(totalAmount),
      icon: TrendingUp,
      color: "text-sky-400",
      bgColor: "bg-sky-400/10",
      borderColor: "border-sky-400/20",
      isAmount: true,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              {card.trend && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  {card.trend}
                </span>
              )}
            </div>
            <div className="mt-4">
              <p
                className={`text-2xl font-bold tracking-tight ${card.isAmount ? "text-foreground" : "text-foreground"}`}
              >
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
