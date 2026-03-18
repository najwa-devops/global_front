"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus,
  Edit2,
  Trash2,
  TestTube2,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  GripVertical,
  Settings,
  Loader2,
} from "lucide-react"
import type { FieldPattern } from "@/lib/types"
import { FIELD_LABELS } from "@/lib/types"
import { useFieldPatterns } from "@/lib/hooks"

const FIELD_OPTIONS = [
  { value: "invoiceNumber", label: "Numero de facture" },
  { value: "invoiceDate", label: "Date de facture" },
  { value: "supplier", label: "Fournisseur" },
  { value: "ice", label: "ICE" },
  { value: "amountHT", label: "Montant HT" },
  { value: "tva", label: "TVA" },
  { value: "amountTTC", label: "Montant TTC" },
]

const DEMO_PATTERNS: FieldPattern[] = [
  {
    id: 1,
    fieldName: "invoiceNumber",
    patternRegex: "(?:Facture|Invoice|N)\\s*[:#]?\\s*([A-Z0-9\\-/]+)",
    priority: 1,
    description: "Detecte les numeros de facture standards",
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    fieldName: "ice",
    patternRegex: "ICE[:\\s]*(\\d{15})",
    priority: 1,
    description: "Extrait le numero ICE a 15 chiffres",
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: 3,
    fieldName: "amountTTC",
    patternRegex: "(?:Total\\s*TTC|TTC)[:\\s]*([\\d\\s,.]+)\\s*(?:DH|MAD)?",
    priority: 1,
    description: "Detecte le montant TTC",
    active: true,
    createdAt: "2026-01-02T00:00:00Z",
  },
  {
    id: 4,
    fieldName: "invoiceDate",
    patternRegex:
      "(\\d{2}[/\\-.]\\d{2}[/\\-.]\\d{2,4}|\\d{4}[/\\-.]\\d{2}[/\\-.]\\d{2})",
    priority: 2,
    description:
      "Detecte les dates (DD/MM/YY, DD/MM/YYYY, YYYY-MM-DD)",
    active: true,
    createdAt: "2026-01-03T00:00:00Z",
  },
]

export function PatternManagementPage() {
  const {
    patterns: apiPatterns,
    isLoading,
    error,
    loadPatterns,
    addPattern,
    updatePattern,
    deletePattern,
  } = useFieldPatterns()
  const [patterns, setPatterns] = useState<FieldPattern[]>(DEMO_PATTERNS)
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [filterField, setFilterField] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPattern, setEditingPattern] = useState<FieldPattern | null>(null)
  const [testText, setTestText] = useState("")
  const [testResults, setTestResults] = useState<{ pattern: FieldPattern; match: string | null }[]>([])

  // Form state - Updated to use fieldName and patternRegex
  const [formFieldName, setFormFieldName] = useState("")
  const [formPatternRegex, setFormPatternRegex] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPriority, setFormPriority] = useState("1")
  const [formActive, setFormActive] = useState(true)

  useEffect(() => {
    loadPatterns()
      .then(() => {
        if (apiPatterns.length > 0) {
          setPatterns(apiPatterns)
          setIsDemoMode(false)
        }
      })
      .catch(() => {
        setIsDemoMode(true)
      })
  }, [])

  useEffect(() => {
    if (apiPatterns.length > 0) {
      setPatterns(apiPatterns)
      setIsDemoMode(false)
    }
  }, [apiPatterns])

  const filteredPatterns = patterns.filter((p) => {
    if (filterField !== "all" && p.fieldName !== filterField) return false
    if (filterStatus === "active" && !p.active) return false
    if (filterStatus === "inactive" && p.active) return false
    return true
  })

  const getFieldLabel = (fieldName: string) => {
    return FIELD_LABELS[fieldName] || FIELD_OPTIONS.find((f) => f.value === fieldName)?.label || fieldName
  }

  const openAddDialog = () => {
    setEditingPattern(null)
    setFormFieldName("")
    setFormPatternRegex("")
    setFormDescription("")
    setFormPriority("1")
    setFormActive(true)
    setIsDialogOpen(true)
  }

  const openEditDialog = (pattern: FieldPattern) => {
    setEditingPattern(pattern)
    setFormFieldName(pattern.fieldName)
    setFormPatternRegex(pattern.patternRegex)
    setFormDescription(pattern.description || "")
    setFormPriority(String(pattern.priority))
    setFormActive(pattern.active)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formFieldName || !formPatternRegex) return

    const patternData: FieldPattern = {
      fieldName: formFieldName,
      patternRegex: formPatternRegex,
      description: formDescription,
      priority: Number.parseInt(formPriority),
      active: formActive,
    }

    if (isDemoMode) {
      if (editingPattern) {
        setPatterns((prev) => prev.map((p) => (p.id === editingPattern.id ? { ...p, ...patternData } : p)))
      } else {
        setPatterns((prev) => [...prev, { ...patternData, id: Date.now(), createdAt: new Date().toISOString() }])
      }
    } else {
      if (editingPattern && editingPattern.id) {
        await updatePattern(editingPattern.id, patternData)
      } else {
        await addPattern(patternData)
      }
    }

    setIsDialogOpen(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Etes-vous sur de vouloir supprimer ce pattern ?")) return

    if (isDemoMode) {
      setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, active: false } : p)))
    } else {
      await deletePattern(id)
    }
  }

  const handleToggleActive = async (id: number) => {
    const pattern = patterns.find((p) => p.id === id)
    if (!pattern) return

    if (isDemoMode) {
      setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)))
    } else {
      await updatePattern(id, { ...pattern, active: !pattern.active })
    }
  }

  const handleTest = () => {
    if (!testText) return

    const results = patterns
      .filter((p) => p.active)
      .map((pattern) => {
        try {
          const regex = new RegExp(pattern.patternRegex, "i")
          const match = testText.match(regex)
          return {
            pattern,
            match: match ? match[1] || match[0] : null,
          }
        } catch {
          return { pattern, match: null }
        }
      })

    setTestResults(results)
  }

  const handleExport = () => {
    const data = JSON.stringify(patterns, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `patterns_export_${new Date().toISOString().split("T")[0]}.json`
    link.click()
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string)
        if (Array.isArray(imported)) {
          setPatterns((prev) => [...prev, ...imported.map((p, i) => ({ ...p, id: Date.now() + i }))])
          alert("Patterns importes avec succes")
        }
      } catch {
        alert("Erreur lors de l'import du fichier")
      }
    }
    reader.readAsText(file)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" className="gap-2 bg-transparent" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Exporter
        </Button>
        <Button variant="outline" className="gap-2 bg-transparent" asChild>
          <label>
            <Upload className="h-4 w-4" />
            Importer
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </Button>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Ajouter un pattern
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Champ:</Label>
              <Select value={filterField} onValueChange={setFilterField}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les champs</SelectItem>
                  {FIELD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Statut:</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patterns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patterns configures ({filteredPatterns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Champ</TableHead>
                <TableHead>Pattern Regex</TableHead>
                <TableHead className="w-20">Priorite</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">Actif</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatterns.map((pattern) => (
                <TableRow key={pattern.id} className={!pattern.active ? "opacity-50" : ""}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getFieldLabel(pattern.fieldName)}</Badge>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{pattern.patternRegex}</code>
                  </TableCell>
                  <TableCell className="text-center">{pattern.priority}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{pattern.description}</TableCell>
                  <TableCell>
                    <Switch
                      checked={pattern.active}
                      onCheckedChange={() => pattern.id && handleToggleActive(pattern.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(pattern)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => pattern.id && handleDelete(pattern.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Test Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube2 className="h-4 w-4" />
            Zone de test
          </CardTitle>
          <CardDescription>Collez un texte OCR pour tester vos patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Collez ici un exemple de texte OCR pour tester les patterns..."
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
          />
          <Button onClick={handleTest} className="gap-2">
            <TestTube2 className="h-4 w-4" />
            Tester les patterns
          </Button>

          {testResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium">Resultats:</h4>
              <div className="space-y-2">
                {testResults.map((result) => (
                  <div key={result.pattern.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    {result.match ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant="outline">{getFieldLabel(result.pattern.fieldName)}</Badge>
                    {result.match ? (
                      <span className="text-sm">
                        Valeur extraite: <strong className="text-green-600">{result.match}</strong>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Aucune correspondance</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPattern ? "Modifier le pattern" : "Ajouter un pattern"}</DialogTitle>
            <DialogDescription>
              Configurez une expression reguliere pour extraire automatiquement un champ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Champ cible</Label>
              <Select value={formFieldName} onValueChange={setFormFieldName}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionnez un champ" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pattern Regex</Label>
              <Input
                value={formPatternRegex}
                onChange={(e) => setFormPatternRegex(e.target.value)}
                placeholder="Ex: ICE[:\s]*(\d{15})"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Utilisez des parentheses () pour capturer la valeur a extraire
              </p>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description du pattern"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>Priorite</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={formActive} onCheckedChange={setFormActive} />
                <Label>Actif</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-transparent">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!formFieldName || !formPatternRegex}>
              {editingPattern ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
