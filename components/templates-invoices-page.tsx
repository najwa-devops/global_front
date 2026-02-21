"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Sparkles,
  Zap,
  FileText,
  Eye,
  Trash2,
  TrendingUp,
  Clock,
  DollarSign,
  AlertCircle,
  Search,
  Filter,
  Edit
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TemplateEditDialog } from "./template-edit-dialog"
import { Progress } from "@/components/ui/progress"
import type { DynamicInvoice, DynamicTemplateDto } from "@/lib/types"
import { formatDate, formatAmount } from "@/lib/utils"

interface TemplateGroup {
  templateId: number | null
  templateName: string
  supplier?: string
  supplierType?: string
  lastDate?: string
  totalAmount: number
  invoices: DynamicInvoice[]
}

interface TemplatesInvoicesPageProps {
  invoices: DynamicInvoice[]
  templates: DynamicTemplateDto[]
  onView: (invoice: DynamicInvoice) => void
  onDelete: (invoiceId: number) => void
  onUpdateTemplate?: (templateId: number, data: { templateName: string; supplierType: string }) => Promise<void>
  onDeleteTemplate?: (templateId: number) => Promise<void>
}

export function TemplatesInvoicesPage({ invoices, templates, onView, onDelete, onUpdateTemplate, onDeleteTemplate }: TemplatesInvoicesPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "count" | "amount">("count")
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  // State pour l'édition de template
  const [editingTemplate, setEditingTemplate] = useState<{
    id: number;
    name: string;
    supplier: string;
  } | null>(null)

  // Grouper les factures par template
  const templateGroups = groupInvoicesByTemplate(invoices, templates)

  // Filtrer et trier
  const filteredGroups = templateGroups
    .filter(group => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        group.templateName.toLowerCase().includes(query) ||
        group.supplier?.toLowerCase().includes(query) ||
        group.invoices.some(inv =>
          inv.filename.toLowerCase().includes(query) ||
          String(inv.fields.find(f => f.key === "invoiceNumber")?.value || "").toLowerCase().includes(query)
        )
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.templateName.localeCompare(b.templateName)
        case "count":
          return b.invoices.length - a.invoices.length
        case "amount":
          return b.totalAmount - a.totalAmount
        default:
          return 0
      }
    })

  // Statistiques globales
  const totalTemplates = templateGroups.filter(g => g.templateId !== null).length
  const totalWithTemplate = invoices.filter(inv => inv.templateId).length
  const totalWithoutTemplate = invoices.filter(inv => !inv.templateId).length
  const templateUsageRate = invoices.length > 0 ? (totalWithTemplate / invoices.length) * 100 : 0

  const handleDeleteInvoice = (invoice: DynamicInvoice, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${invoice.filename}" ?`)) {
      return
    }
    onDelete(invoice.id)
    toast.success("Facture supprimée")
  }
  const handleOpenEdit = (group: TemplateGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    if (group.templateId) {
      setEditingTemplate({
        id: group.templateId,
        name: group.templateName,
        supplier: group.supplierType || group.supplier || "GENERAL"
      })
    }
  }

  const handleDeleteTemplate = async (templateId: number, templateName: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const confirmed = confirm(
      `ATTENTION !\n\n` +
      `Êtes-vous sûr de vouloir supprimer le template "${templateName}" ?\n\n` +
      `Les factures associées ne seront PAS supprimées mais perdront leur lien avec ce template.`
    )

    if (!confirmed) {
      return
    }

    if (onDeleteTemplate) {
      try {
        await onDeleteTemplate(templateId)
        toast.success("Template supprimé avec succès")
      } catch (error) {
        console.error("Erreur suppression template:", error)
        toast.error("Erreur lors de la suppression")
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Templates actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalTemplates}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalWithoutTemplate > 0 ? `+${totalWithoutTemplate} sans template` : "Tous groupés"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Taux d'utilisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{templateUsageRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalWithTemplate} / {invoices.length} factures
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total factures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{invoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dans {templateGroups.length} groupes
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Montant total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatAmount(
                templateGroups.reduce((sum, group) => sum + group.totalAmount, 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Toutes factures confondues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filtres et recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par template, fournisseur ou facture..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Trier par nombre</SelectItem>
                <SelectItem value="name">Trier par nom</SelectItem>
                <SelectItem value="amount">Trier par montant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accordéon des groupes */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Factures groupées par template
          </CardTitle>
          <CardDescription>
            {filteredGroups.length} groupe{filteredGroups.length > 1 ? "s" : ""} affiché{filteredGroups.length > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">Aucun résultat</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Essayez de modifier vos critères de recherche
              </p>
            </div>
          ) : (
            <Accordion type="multiple" value={expandedGroups} onValueChange={setExpandedGroups} className="space-y-4">
              {filteredGroups.map((group, index) => (
                <AccordionItem
                  key={group.templateId || "no-template"}
                  value={String(group.templateId || "no-template")}
                  className="border border-border/50 rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="px-6 py-4 hover:bg-accent/50 transition-colors [&[data-state=open]]:bg-accent/30">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        {/* Icône du template */}
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${group.templateId
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                          }`}>
                          {group.templateId ? (
                            <Zap className="h-5 w-5" />
                          ) : (
                            <Sparkles className="h-5 w-5" />
                          )}
                        </div>

                        {/* Nom du template */}
                        <div className="text-left">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            {group.templateName}
                            {group.templateId && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                Template
                              </Badge>
                            )}
                          </h3>
                          {group.supplier && (
                            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                              {group.supplier}
                              {group.supplierType && group.supplierType !== group.supplier && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground uppercase">
                                  {group.supplierType}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Statistiques du groupe + BOUTONS ACTIONS */}
                      <div className="flex items-center gap-6 text-sm">
                        {/* Stats existantes */}
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-foreground">
                            {group.invoices.length}
                          </span>
                          <span className="text-muted-foreground">factures</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-primary">
                            {formatAmount(group.totalAmount)}
                          </span>
                        </div>

                        {/* Reliability Score */}
                        {group.templateId && templates.find(t => t.id === group.templateId)?.successRate !== undefined && (
                          <div className="flex items-center gap-2 w-24">
                            <div className="flex-1">
                              <Progress value={templates.find(t => t.id === group.templateId)?.successRate} className="h-1.5" />
                            </div>
                            <span className="text-[10px] font-medium">{templates.find(t => t.id === group.templateId)?.successRate}%</span>
                          </div>
                        )}

                        {/* 🆕 BOUTONS D'ACTIONS TEMPLATE */}
                        {group.templateId && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleOpenEdit(group, e)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleOpenEdit(group, e as any)
                                }
                              }}
                              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent"
                            >
                              <Edit className="h-4 w-4" />
                              Modifier
                            </div>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleDeleteTemplate(group.templateId!, group.templateName, e)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleDeleteTemplate(group.templateId!, group.templateName, e as any)
                                }
                              }}
                              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-6 pb-4 pt-2">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50 hover:bg-transparent">
                            <TableHead className="text-muted-foreground">Fichier</TableHead>
                            <TableHead className="text-muted-foreground">N° Facture</TableHead>
                            <TableHead className="text-muted-foreground">Date</TableHead>
                            <TableHead className="text-muted-foreground">Montant TTC</TableHead>
                            <TableHead className="text-muted-foreground">Statut</TableHead>
                            <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.invoices.map((invoice) => {
                            const invoiceNumber = invoice.fields.find(f => f.key === "invoiceNumber")?.value
                            const ttc = invoice.fields.find(f => f.key === "amountTTC")?.value

                            return (
                              <TableRow
                                key={invoice.id}
                                className="border-border/50 cursor-pointer transition-colors hover:bg-accent/50"
                                onClick={() => onView(invoice)}
                              >
                                <TableCell className="font-medium text-foreground">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    {invoice.filename}
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground">
                                  {invoiceNumber || "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(invoice.createdAt)}
                                </TableCell>
                                <TableCell className="font-semibold text-primary">
                                  {ttc ? formatAmount(ttc) : "-"}
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(invoice.status)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onView(invoice)}
                                      className="gap-2"
                                    >
                                      <Eye className="h-4 w-4" />
                                      Voir
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => handleDeleteInvoice(invoice, e)}
                                      className="gap-2 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Supprimer
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Statistiques du groupe (détaillées) */}
                    <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {group.invoices.length}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total factures</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">
                          {formatAmount(group.totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Montant total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {formatAmount(group.totalAmount / group.invoices.length)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Montant moyen</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'édition */}
      {editingTemplate && (
        <TemplateEditDialog
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
          templateId={editingTemplate.id}
          initialName={editingTemplate.name}
          initialSupplier={editingTemplate.supplier}
          onUpdate={async (id, data) => {
            if (onUpdateTemplate) {
              await onUpdateTemplate(id, data)
              toast.success("Template mis à jour avec succès")
            }
          }}
        />
      )}
    </div>
  )
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

function groupInvoicesByTemplate(invoices: DynamicInvoice[], templates: DynamicTemplateDto[] = []): TemplateGroup[] {
  const groups = new Map<number | null, TemplateGroup>()

  invoices.forEach((invoice) => {
    const templateId = invoice.templateId || null
    const templateName = invoice.templateName || "Sans template"

    if (!groups.has(templateId)) {
      // Trouver les infos du template dans la liste complète si possible
      const templateInfo = templateId ? templates.find(t => t.id === templateId) : null

      const supplier = invoice.fields.find(f => f.key === "supplier")?.value
      groups.set(templateId, {
        templateId,
        templateName,
        supplier: supplier ? String(supplier) : undefined,
        supplierType: templateInfo?.supplierType,
        lastDate: invoice.createdAt.toISOString(),
        totalAmount: 0,
        invoices: [] as DynamicInvoice[],
      })
    }

    const group = groups.get(templateId)!
    group.invoices.push(invoice)

    // Calculer le montant total
    const amountTTCField = invoice.fields.find((f: any) => f.key === "amountTTC")
    if (amountTTCField && amountTTCField.value) {
      const val = parseFloat(String(amountTTCField.value).replace(",", "."))
      if (!isNaN(val)) {
        group.totalAmount += val
      }
    }

    // Mettre à jour la date la plus récente
    if (new Date(invoice.createdAt) > new Date(group.lastDate!)) {
      group.lastDate = invoice.createdAt.toISOString()
    }
  })

  return Array.from(groups.values())
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20">
          En attente
        </Badge>
      )
    case "processing":
      return (
        <Badge className="bg-sky-400/10 text-sky-400 border-sky-400/30 hover:bg-sky-400/20">
          En cours
        </Badge>
      )
    case "treated":
      return (
        <Badge className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/20">
          Traité
        </Badge>
      )
    case "validated":
      return (
        <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/20">
          Validé
        </Badge>
      )
    case "error":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">
          Erreur
        </Badge>
      )
    default:
      return (
        <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20">
          En attente
        </Badge>
      )
  }
}