"use client"

import { useEffect, useMemo, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ShieldCheck } from "lucide-react"
import { AuditService, AuditLogEntry } from "@/src/api/services/audit.service"

function AuditPageContent() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [search, setSearch] = useState("")
    const [roleFilter, setRoleFilter] = useState("ALL")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const data = await AuditService.list()
                setLogs(data)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        return logs.filter((log) => {
            const matchesSearch =
                !term ||
                log.userName.toLowerCase().includes(term) ||
                log.action.toLowerCase().includes(term) ||
                (log.details ?? "").toLowerCase().includes(term)
            const matchesRole = roleFilter === "ALL" || log.userRole === roleFilter
            return matchesSearch && matchesRole
        })
    }, [logs, search, roleFilter])

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher dans les logs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="Filtrer par rôle" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les rôles</SelectItem>
                        <SelectItem value="ADMIN">Administrateur</SelectItem>
                        <SelectItem value="COMPTABLE">Comptable</SelectItem>
                        <SelectItem value="CLIENT">Fournisseur</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Journal d&apos;audit ({filtered.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground">Chargement en cours...</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">Aucune entrée trouvée</div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {filtered.map((log) => (
                                <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                                    <div className={`p-1.5 rounded-lg border ${log.userRole === "ADMIN" ? "border-primary text-primary" : log.userRole === "COMPTABLE" ? "border-blue-500/60 text-blue-500" : "border-muted text-muted-foreground"}`}>
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">{log.userName}</span>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {log.userRole}
                                            </Badge>
                                            <Badge className="text-[10px] px-1.5 py-0 border border-muted/60">
                                                {log.action}
                                            </Badge>
                                        </div>
                                        {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleDateString("fr-FR")}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/70">
                                            {new Date(log.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                        {log.ip && <p className="text-[10px] text-muted-foreground/50">{log.ip}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function AuditPage() {
    return (
        <AuthGuard allowedRoles={["ADMIN"]}>
            <AuditPageContent />
        </AuthGuard>
    )
}
