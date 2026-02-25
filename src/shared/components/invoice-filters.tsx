"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Search, CalendarIcon, X, Download, Filter } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useIsMobile } from "@/hooks/use-mobile"
import { Label } from "@/components/ui/label"

export interface FilterValues {
  search: string
  supplier: string
  status: string
  dateFrom?: Date
  dateTo?: Date
  amountMin?: number
  amountMax?: number
}

interface InvoiceFiltersProps {
  filters: FilterValues
  onFiltersChange: (filters: FilterValues) => void
  suppliers: string[]
  onExport: (format: "csv" | "excel" | "pdf") => void
}

export function InvoiceFilters({ filters, onFiltersChange, suppliers, onExport }: InvoiceFiltersProps) {
  const [dateFromOpen, setDateFromOpen] = useState(false)
  const [dateToOpen, setDateToOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const isMobile = useIsMobile()

  const updateFilter = (key: keyof FilterValues, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      supplier: "",
      status: "",
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: undefined,
      amountMax: undefined,
    })
  }

  const hasActiveFilters =
    filters.search ||
    filters.supplier ||
    filters.status ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.amountMin ||
    filters.amountMax

  const activeFiltersCount = [
    filters.supplier,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
  ].filter(Boolean).length

  const FiltersContent = () => (
    <div className="space-y-4">
      {/* Supplier filter */}
      <div className="space-y-2">
        <Label>Fournisseur</Label>
        <Select value={filters.supplier} onValueChange={(v) => updateFilter("supplier", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier} value={supplier}>
                {supplier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status filter */}
      <div className="space-y-2">
        <Label>Statut</Label>
        <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="VERIFY">À vérifier</SelectItem>
            <SelectItem value="READY_TO_TREAT">Prêt à traiter</SelectItem>
            <SelectItem value="READY_TO_VALIDATE">Prêt à valider</SelectItem>
            <SelectItem value="VALIDATED">Validé</SelectItem>
            <SelectItem value="REJECTED">Rejeté</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date range */}
      <div className="space-y-2">
        <Label>Periode</Label>
        <div className="flex gap-2">
          <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start text-left font-normal bg-transparent">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yy") : "Debut"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(date) => {
                  updateFilter("dateFrom", date)
                  setDateFromOpen(false)
                }}
                locale={fr}
              />
            </PopoverContent>
          </Popover>

          <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start text-left font-normal bg-transparent">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(filters.dateTo, "dd/MM/yy") : "Fin"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => {
                  updateFilter("dateTo", date)
                  setDateToOpen(false)
                }}
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Amount range */}
      <div className="space-y-2">
        <Label>Montant (DH)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.amountMin ?? ""}
            onChange={(e) => updateFilter("amountMin", e.target.value ? Number(e.target.value) : undefined)}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={filters.amountMax ?? ""}
            onChange={(e) => updateFilter("amountMax", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button variant="outline" className="w-full bg-transparent" onClick={clearFilters}>
          <X className="mr-2 h-4 w-4" />
          Effacer les filtres
        </Button>
      )}
    </div>
  )

  // Mobile layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          {/* Filters sheet */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex-1 gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filtres
                {activeFiltersCount > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh]">
              <SheetHeader>
                <SheetTitle>Filtres</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <FiltersContent />
              </div>
            </SheetContent>
          </Sheet>

          {/* Export */}
          <Select onValueChange={(v) => onExport(v as "csv" | "excel" | "pdf")}>
            <SelectTrigger className="w-auto">
              <Download className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par numero, fournisseur..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Supplier filter */}
        <Select value={filters.supplier} onValueChange={(v) => updateFilter("supplier", v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Fournisseur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier} value={supplier}>
                {supplier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="VERIFY">À vérifier</SelectItem>
            <SelectItem value="READY_TO_TREAT">Prêt à traiter</SelectItem>
            <SelectItem value="READY_TO_VALIDATE">Prêt à valider</SelectItem>
            <SelectItem value="VALIDATED">Validé</SelectItem>
            <SelectItem value="REJECTED">Rejeté</SelectItem>
          </SelectContent>
        </Select>

        {/* Date from */}
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-start text-left font-normal bg-transparent">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Date debut"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => {
                updateFilter("dateFrom", date)
                setDateFromOpen(false)
              }}
              locale={fr}
            />
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-start text-left font-normal bg-transparent">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "Date fin"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => {
                updateFilter("dateTo", date)
                setDateToOpen(false)
              }}
              locale={fr}
            />
          </PopoverContent>
        </Popover>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Effacer
          </Button>
        )}

        {/* Export dropdown */}
        <Select onValueChange={(v) => onExport(v as "csv" | "excel" | "pdf")}>
          <SelectTrigger className="w-[130px]">
            <Download className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Exporter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="excel">Excel</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Amount range */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Montant:</span>
        <Input
          type="number"
          placeholder="Min"
          value={filters.amountMin ?? ""}
          onChange={(e) => updateFilter("amountMin", e.target.value ? Number(e.target.value) : undefined)}
          className="w-24"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max"
          value={filters.amountMax ?? ""}
          onChange={(e) => updateFilter("amountMax", e.target.value ? Number(e.target.value) : undefined)}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">DH</span>
      </div>
    </div>
  )
}
