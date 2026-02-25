"use client"

import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react"

interface ConfidenceBadgeProps {
    score: number // 0-100
    size?: "sm" | "md" | "lg"
    showIcon?: boolean
    showPercentage?: boolean
}

export function ConfidenceBadge({
    score,
    size = "md",
    showIcon = true,
    showPercentage = true,
}: ConfidenceBadgeProps) {
    const getConfidenceLevel = () => {
        if (score >= 80) return "high"
        if (score >= 50) return "medium"
        return "low"
    }

    const level = getConfidenceLevel()

    const sizeClasses = {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-2.5 py-1",
        lg: "text-base px-3 py-1.5",
    }

    const iconSizes = {
        sm: "h-3 w-3",
        md: "h-3.5 w-3.5",
        lg: "h-4 w-4",
    }

    const variants = {
        high: {
            className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
            icon: CheckCircle,
        },
        medium: {
            className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
            icon: AlertTriangle,
        },
        low: {
            className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
            icon: XCircle,
        },
    }

    const { className, icon: Icon } = variants[level]

    return (
        <Badge
            variant="outline"
            className={`${className} ${sizeClasses[size]} flex items-center gap-1 font-medium`}
        >
            {showIcon && <Icon className={iconSizes[size]} />}
            {showPercentage && `${Math.round(score)}%`}
        </Badge>
    )
}

// Helper component for displaying confidence with label
export function ConfidenceDisplay({
    label,
    score,
    size = "sm",
}: {
    label: string
    score: number
    size?: "sm" | "md" | "lg"
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <ConfidenceBadge score={score} size={size} />
        </div>
    )
}
