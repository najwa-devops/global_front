"use client"

import { useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { MOCK_AUDIT_LOGS } from "@/src/mock/data.mock"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ShieldCheck, Upload, CheckCircle2, FolderPlus, UserPlus } from "lucide-react"

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    UPLOAD: { label: "Upload", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Upload },
    VALIDATE: { label: "Validation", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
    CREATE_DOSSIER: { label: "Création dossier", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: FolderPlus },
    CREATE_COMPTABLE: { label: "Création compte", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: UserPlus },
}

function AuditPageContent() {
    const [search, setSearch] = useState("")
    const [roleFilter, setRoleFilter] = useState("ALL")

    const filtered = MOCK_AUDIT_LOGS.filter(log => {
        const matchSearch = log.userName.toLowerCase().includes(search.toLowerCase()) ||
            log.action.toLowerCase().includes(search.toLowerCase()) ||
            (log.details ?? "").toLowerCase().includes(search.toLowerCase())
        const matchRole = roleFilter === "ALL" || log.userRole === roleFilter
        return matchSearch && matchRole
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher dans les logs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="Filtrer par rôle" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les rôles</SelectItem>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        <SelectItem value="COMPTABLE">Comptable</SelectItem>
                        <SelectItem value="FOURNISSEUR">Fournisseur</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Journal d&apos;audit ({filtered.length} entrées)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                        {filtered.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">Aucune entrée trouvée</div>
                        ) : filtered.map(log => {
                            const actionConf = ACTION_CONFIG[log.action] ?? { label: log.action, color: "bg-muted text-muted-foreground border-border", icon: ShieldCheck }
                            const ActionIcon = actionConf.icon
                            return (
                                <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                                    <div className={`p-1.5 rounded-lg border ${actionConf.color} shrink-0 mt-0.5`}>
                                        <ActionIcon className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">{log.userName}</span>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{log.userRole}</Badge>
                                            <Badge className={`text-[10px] px-1.5 py-0 border ${actionConf.color}`}>{actionConf.label}</Badge>
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
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function AuditPage() {
    return (
        <AuthGuard allowedRoles={["SUPER_ADMIN"]}>
            <AuditPageContent />
        </AuthGuard>
    )
}
