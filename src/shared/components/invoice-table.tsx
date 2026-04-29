"use client";

import { useState, useMemo, useEffect, type ComponentType } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Eye,
  Scan,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Sparkles,
  Zap,
  CheckCircle2,
  BookOpenCheck,
  Search,
  Filter,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DynamicInvoice } from "@/lib/types";
import { cn, formatAmount, formatDate, toWorkflowStatus } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  variant?: "default" | "destructive";
  confirmMessage?: (count: number) => string;
  disabled?: (selected: DynamicInvoice[]) => boolean;
  onAction: (selected: DynamicInvoice[]) => void | Promise<void>;
}

export interface InvoiceTableProps {
  invoices: DynamicInvoice[];
  onView: (invoice: DynamicInvoice) => void;
  onProcessOcr: (invoice: DynamicInvoice) => void;
  onProcessInline: (invoice: DynamicInvoice) => void;
  onDelete?: (invoiceId: number) => void;
  onConfirm?: (invoice: DynamicInvoice) => void;
  onFinalValidate?: (invoice: DynamicInvoice) => void;
  onAccount?: (invoice: DynamicInvoice) => void;
  onClientValidate?: (invoice: DynamicInvoice) => void;
  showDeleteAction?: boolean;
  columnPreset?: string;
  bulkActions?: BulkAction[];
  itemsPerPage?: number;
  userRole?: string | undefined;
  isDateOutOfRange?: (invoice: DynamicInvoice) => boolean;
  checkInvoiceDuplicate?: (params: {
    invoiceNumber?: string;
    filename?: string;
    partner: string;
  }) => Promise<{ exists: boolean; duplicate: any }>;
}

export function InvoiceTable({
  invoices,
  onView,
  onDelete,
  onProcessInline,
  onConfirm,
  onFinalValidate,
  onAccount,
  onClientValidate,
  showDeleteAction = true,
  itemsPerPage = 10,
  userRole,
  isDateOutOfRange,
  checkInvoiceDuplicate,
}: InvoiceTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const getFieldValue = (invoice: DynamicInvoice, key: string): string => {
    const fieldValue = invoice.fields?.find(
      (field) => field.key === key,
    )?.value;
    if (
      fieldValue !== undefined &&
      fieldValue !== null &&
      String(fieldValue).trim() !== ""
    ) {
      return String(fieldValue);
    }

    const rawValue = (
      invoice.fieldsData as Record<string, unknown> | undefined
    )?.[key];
    const normalizedRawValue =
      rawValue &&
      typeof rawValue === "object" &&
      !Array.isArray(rawValue) &&
      "value" in rawValue
        ? rawValue.value
        : rawValue;
    if (
      normalizedRawValue !== undefined &&
      normalizedRawValue !== null &&
      String(normalizedRawValue).trim() !== ""
    ) {
      return String(normalizedRawValue);
    }

    return "-";
  };
  const getAmountValue = (invoice: DynamicInvoice, key: string): string => {
    const value = getFieldValue(invoice, key);
    return value === "-" ? "-" : formatAmount(value);
  };
  const isComputedAmountField = (
    invoice: DynamicInvoice,
    key: string,
  ): boolean =>
    Array.isArray(invoice.fieldsData?.computedAmountFields) &&
    invoice.fieldsData.computedAmountFields.some(
      (field: unknown) => String(field) === key,
    );
  const hasComputedAmounts = (invoice: DynamicInvoice): boolean =>
    Array.isArray(invoice.fieldsData?.computedAmountFields) &&
    invoice.fieldsData.computedAmountFields.length > 0;
  const pickDisplayValue = (...values: Array<unknown>): string => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized !== "" && normalized !== "-") {
        return normalized;
      }
    }
    return "-";
  };
  const getComparableFilename = (invoice: DynamicInvoice): string => {
    const filename = pickDisplayValue(invoice.originalName, invoice.filename);
    return filename === "-" ? "" : filename.trim().toLowerCase();
  };

  const isClient = userRole === "CLIENT";
  const isSupplierLike = userRole === "FOURNISSEUR";
  const showActions = !isClient;
  const emptyColSpan = showActions ? 12 : 11;
  const [currentPage, setCurrentPage] = useState(1);
  const [accountedInvoiceKeys, setAccountedInvoiceKeys] = useState<Set<string>>(
    new Set(),
  );

  // Check for accounted duplicates in database
  useEffect(() => {
    if (!checkInvoiceDuplicate) return;

    const checkDuplicates = async () => {
      const keysToCheck = new Set<string>();

      // Collect unique invoiceNumber + supplier/customer combinations
      invoices.forEach((invoice) => {
        const invoiceNumber = getFieldValue(invoice, "invoiceNumber");
        const filename = getComparableFilename(invoice);
        // Support both supplier (achat) and customer (vente)
        const supplier = getFieldValue(invoice, "supplier");
        const customer = getFieldValue(invoice, "customer");
        const partner = supplier || customer;

        if (!partner || partner === "-") {
          return;
        }

        if (invoiceNumber && invoiceNumber !== "-") {
          keysToCheck.add(`invoiceNumber|||${invoiceNumber}|||${partner}`);
        }

        if (filename) {
          keysToCheck.add(`filename|||${filename}|||${partner}`);
        }
      });

      // Check each combination
      const accountedKeys = new Set<string>();
      for (const key of keysToCheck) {
        const [field, value, partner] = key.split("|||");
        try {
          const result = await checkInvoiceDuplicate(
            field === "filename"
              ? { filename: value, partner }
              : { invoiceNumber: value, partner },
          );
          if (result.exists) {
            accountedKeys.add(key);
          }
        } catch (error) {
          console.error("Error checking duplicate:", error);
        }
      }
      setAccountedInvoiceKeys(accountedKeys);
    };

    checkDuplicates();
  }, [invoices, checkInvoiceDuplicate]);

  // Filter and search logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // Text search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const invoiceNumber = getFieldValue(
          invoice,
          "invoiceNumber",
        ).toLowerCase();
        const supplier = getFieldValue(invoice, "supplier").toLowerCase();
        const designation = getFieldValue(invoice, "designation").toLowerCase();
        const customer = getFieldValue(invoice, "customer").toLowerCase();

        if (
          !invoiceNumber.includes(query) &&
          !supplier.includes(query) &&
          !designation.includes(query) &&
          !customer.includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const status = toWorkflowStatus(invoice.status);
        if (status !== statusFilter) {
          return false;
        }
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const invoiceDateStr = invoice.fieldsData?.invoiceDate;
        if (invoiceDateStr) {
          try {
            const [day, month, year] = invoiceDateStr.split("/").map(Number);
            const invoiceDate = new Date(year, month - 1, day);

            if (dateFrom) {
              const [fromDay, fromMonth, fromYear] = dateFrom
                .split("/")
                .map(Number);
              const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
              if (invoiceDate < fromDate) return false;
            }

            if (dateTo) {
              const [toDay, toMonth, toYear] = dateTo.split("/").map(Number);
              const toDate = new Date(toYear, toMonth - 1, toDay);
              if (invoiceDate > toDate) return false;
            }
          } catch {
            return false;
          }
        } else {
          return false;
        }
      }

      // Amount range filter
      if (amountMin || amountMax) {
        const amountTTC = getFieldValue(invoice, "amountTTC");
        const amount = parseFloat(amountTTC.replace(",", "."));

        if (!isNaN(amount)) {
          if (amountMin && amount < parseFloat(amountMin)) return false;
          if (amountMax && amount > parseFloat(amountMax)) return false;
        } else {
          return false;
        }
      }

      return true;
    });
  }, [
    invoices,
    searchQuery,
    statusFilter,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    getFieldValue,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFrom, dateTo, amountMin, amountMax]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Find duplicate invoice numbers across ALL invoices
  const duplicateInvoiceNumbers = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((invoice) => {
      const invoiceNumber = getFieldValue(invoice, "invoiceNumber");
      if (invoiceNumber && invoiceNumber !== "-") {
        counts[invoiceNumber] = (counts[invoiceNumber] || 0) + 1;
      }
    });
    return new Set(
      Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .map(([number]) => number),
    );
  }, [invoices]);

  const duplicateFilenames = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((invoice) => {
      const filename = getComparableFilename(invoice);
      if (filename) {
        counts[filename] = (counts[filename] || 0) + 1;
      }
    });
    return new Set(
      Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .map(([filename]) => filename),
    );
  }, [invoices]);

  // Group invoices by invoice number and assign alternating colors
  const invoiceNumberGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    let groupIndex = 0;
    paginatedInvoices.forEach((invoice) => {
      const invoiceNumber = getFieldValue(invoice, "invoiceNumber");
      if (!(invoiceNumber in groups)) {
        groups[invoiceNumber] = groupIndex++;
      }
    });
    return groups;
  }, [paginatedInvoices]);

  const getInvoiceDate = (invoice: DynamicInvoice): string => {
    const value = getFieldValue(invoice, "invoiceDate");
    if (value !== "-") {
      if (value.includes("/")) return value;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return formatDate(date);
      }
      return value;
    }
    return formatDate(invoice.createdAt);
  };

  const handleDelete = (invoice: DynamicInvoice) => {
    if (!onDelete) {
      return;
    }

    if (
      !confirm(`Êtes-vous sûr de vouloir supprimer "${invoice.filename}" ?`)
    ) {
      return;
    }
    onDelete(invoice.id);
  };

  const isImage = (filename: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  };

  const isOutOfAccountingRange = (invoice: DynamicInvoice) => {
    const canAccount = (invoice as any)?.canAccount;
    if (canAccount === false) {
      return true;
    }

    const message = String((invoice as any)?.accountingMessage || "").toLowerCase();
    return (
      message.includes("hors de la periode") ||
      message.includes("hors de la période") ||
      message.includes("out of range") ||
      message.includes("invoice_date_out_of_range")
    );
  };

  const hasRequiredAccountingFields = (invoice: DynamicInvoice): boolean => {
    const invoiceNumber = getFieldValue(invoice, "invoiceNumber");
    const supplier = getFieldValue(invoice, "supplier");
    const customer = getFieldValue(invoice, "customer");
    const invoiceDate = getFieldValue(invoice, "invoiceDate");
    const amountHT = getAmountValue(invoice, "amountHT");
    const amountTTC = getAmountValue(invoice, "amountTTC");
    const tierNumber =
      getFieldValue(invoice, "tierNumber") ||
      getFieldValue(invoice, "collectifAccount") ||
      invoice.tier?.tierNumber ||
      invoice.tier?.collectifAccount;
    const chargeAccount =
      getFieldValue(invoice, "chargeAccount") ||
      getFieldValue(invoice, "comptht") ||
      invoice.tier?.defaultChargeAccount;
    const tvaAccount =
      getFieldValue(invoice, "tvaAccount") ||
      getFieldValue(invoice, "comptTva") ||
      invoice.tier?.tvaAccount;
    const ttcAccount = getFieldValue(invoice, "comptTier");

    const requiredFields = [
      invoiceNumber,
      supplier || customer,
      invoiceDate,
      amountHT,
      amountTTC,
      tierNumber,
      chargeAccount,
      tvaAccount,
    ];

    return requiredFields.every(
      (field) =>
        field !== "" && field !== "-" && field !== null && field !== undefined,
    );
  };

  // Detect if this is a sales (vente) or purchase (achat) flow
  const isVente = invoices.some((inv) => getFieldValue(inv, "customer"));
  const partnerLabel = "Fournisseur";

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in">
      <CardHeader className="border-b border-border/50 p-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-foreground">
              Factures
            </CardTitle>
            <CardDescription className="text-xs">
              Référence couleur des lignes et statuts affichés dans la liste.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-green-300 bg-green-50 text-green-700"
            >
              Validée
            </Badge>
            <Badge
              variant="outline"
              className="border-sky-300 bg-sky-50 text-sky-700"
            >
              Re-Calculé
            </Badge>
            <Badge
              variant="outline"
              className="border-yellow-300 bg-yellow-50 text-yellow-700"
            >
              Champs manquants
            </Badge>
            <Badge
              variant="outline"
              className="border-red-300 bg-red-50 text-red-700"
            >
              Doublon
            </Badge>
            <Badge
              variant="outline"
              className="border-orange-300 bg-orange-50 text-orange-700"
            >
              Hors période
            </Badge>
            <Badge
              variant="outline"
              className="border-violet-300 bg-violet-50 text-violet-700"
            >
              Déjà comptabilisée
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-10 w-20 items-center justify-center rounded-2xl bg-muted/50">
              <FileText className="h-8 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-foreground">
              Aucune facture
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              Commencez par uploader vos premières factures pour les traiter
              avec l'OCR.
            </p>
          </div>
        ) : (
          <>
            {/* Search and Filters */}
            <div className="border-b border-border/50 bg-accent/30 p-4">
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par N° facture, fournisseur, désignation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="shrink-0"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filtres
                  </Button>
                  {(searchQuery ||
                    statusFilter !== "ALL" ||
                    dateFrom ||
                    dateTo ||
                    amountMin ||
                    amountMax) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("ALL");
                        setDateFrom("");
                        setDateTo("");
                        setAmountMin("");
                        setAmountMax("");
                      }}
                      className="shrink-0"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Réinitialiser
                    </Button>
                  )}
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Status Filter */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Statut
                      </label>
                      <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tous les statuts" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Tous</SelectItem>
                          <SelectItem value="READY_TO_VALIDATE">
                            À valider
                          </SelectItem>
                          <SelectItem value="VALIDATED">Validées</SelectItem>
                          <SelectItem value="TREATED">Traitées</SelectItem>
                          <SelectItem value="PENDING">En attente</SelectItem>
                          <SelectItem value="ERROR">Erreur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date From */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Date début
                      </label>
                      <Input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>

                    {/* Date To */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Date fin
                      </label>
                      <Input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>

                    {/* Amount Range */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Montant TTC (min - max)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={amountMin}
                          onChange={(e) => setAmountMin(e.target.value)}
                          className="h-9"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={amountMax}
                          onChange={(e) => setAmountMax(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Filters Summary */}
                {(searchQuery ||
                  statusFilter !== "ALL" ||
                  dateFrom ||
                  dateTo ||
                  amountMin ||
                  amountMax) && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {searchQuery && (
                      <Badge variant="secondary" className="gap-1">
                        Recherche: "{searchQuery}"
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSearchQuery("")}
                        />
                      </Badge>
                    )}
                    {statusFilter !== "ALL" && (
                      <Badge variant="secondary" className="gap-1">
                        Statut: {statusFilter}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setStatusFilter("ALL")}
                        />
                      </Badge>
                    )}
                    {dateFrom && (
                      <Badge variant="secondary" className="gap-1">
                        Depuis: {dateFrom}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setDateFrom("")}
                        />
                      </Badge>
                    )}
                    {dateTo && (
                      <Badge variant="secondary" className="gap-1">
                        Jusqu'à: {dateTo}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setDateTo("")}
                        />
                      </Badge>
                    )}
                    {(amountMin || amountMax) && (
                      <Badge variant="secondary" className="gap-1">
                        Montant: {amountMin || "0"} - {amountMax || "∞"}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => {
                            setAmountMin("");
                            setAmountMax("");
                          }}
                        />
                      </Badge>
                    )}
                  </div>
                )}

                {/* Results Count */}
                <div className="text-xs text-muted-foreground">
                  {filteredInvoices.length} résultat(s) sur {invoices.length}{" "}
                  facture(s)
                </div>
              </div>
            </div>

            {isClient ? (
              <div className="space-y-3">
                {paginatedInvoices.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Aucun résultat</p>
                      <p className="text-xs">Essayez de modifier vos critères de recherche</p>
                    </div>
                  </div>
                ) : (
                  paginatedInvoices.map((invoice) => {
                    const invoiceNumber = getFieldValue(invoice, "invoiceNumber")
                    const supplier = getFieldValue(invoice, "supplier")
                    const customer = getFieldValue(invoice, "customer")
                    const partner = supplier || customer
                    const validated = Boolean(invoice.clientValidated)
                    const workflowStatus = toWorkflowStatus(invoice.status).replace(/_/g, " ")

                    return (
                      <div
                        key={invoice.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <p className="truncate font-medium text-foreground">
                              {pickDisplayValue(invoice.originalName, invoice.filename)}
                            </p>
                            <Badge variant="outline" className="border-border/60 bg-muted/30 text-muted-foreground">
                              {workflowStatus}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {invoiceNumber !== "-" ? `N° ${invoiceNumber}` : "Sans numéro"}
                            {partner !== "-" ? ` · ${partner}` : ""}
                            {` · ${getInvoiceDate(invoice)}`}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => onView(invoice)}
                            title="Voir"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {onClientValidate && !validated && (
                            <Button
                              size="sm"
                              className="gap-2"
                              onClick={() => onClientValidate(invoice)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Valider
                            </Button>
                          )}

                          {showDeleteAction && onDelete && !validated && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
                              onClick={() => handleDelete(invoice)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="h-9 w-16 py-2 text-xs text-muted-foreground">
                      Aperçu
                    </TableHead>

                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      N° Facture
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      {partnerLabel}
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      Date Facture
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      Désignation
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      Montant HT
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      TVA
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      Montant TTC
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      Compte Tier
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      Cpt HT
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs text-muted-foreground">
                      Cpt TVA
                    </TableHead>

                    {showActions && (
                      <TableHead className="h-9 py-2 text-right text-xs text-muted-foreground">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={emptyColSpan}
                        className="py-12 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Search className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">Aucun résultat</p>
                          <p className="text-xs">
                            Essayez de modifier vos critères de recherche
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={emptyColSpan}
                        className="py-12 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            Aucune facture sur cette page
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedInvoices.map((invoice, index) => {
                      const invoiceNumber = getFieldValue(
                        invoice,
                        "invoiceNumber",
                      );
                      const supplier = getFieldValue(invoice, "supplier");
                      const customer = getFieldValue(invoice, "customer");
                      const partner = supplier || customer;
                      const comparableFilename = getComparableFilename(invoice);
                      const groupIndex =
                        invoiceNumberGroups[invoiceNumber] || 0;
                      const isGreenGroup = groupIndex % 2 === 1;
                      const isOutOfRange = isDateOutOfRange
                        ? !isDateOutOfRange(invoice)
                        : isOutOfAccountingRange(invoice);
                      const isDuplicateInvoiceNumber =
                        duplicateInvoiceNumbers.has(invoiceNumber);
                      const isDuplicateFilename =
                        duplicateFilenames.has(comparableFilename);
                      const isDuplicate =
                        isDuplicateInvoiceNumber || isDuplicateFilename;
                      const isAlreadyAccountedByNumber =
                        accountedInvoiceKeys.has(
                          `invoiceNumber|||${invoiceNumber}|||${partner}`,
                        );
                      const isAlreadyAccountedByFilename =
                        accountedInvoiceKeys.has(
                          `filename|||${comparableFilename}|||${partner}`,
                        );
                      const isAlreadyAccounted =
                        isAlreadyAccountedByNumber ||
                        isAlreadyAccountedByFilename;
                      const hasMissingFields =
                        !hasRequiredAccountingFields(invoice);
                      const hasRecalculatedAmounts =
                        hasComputedAmounts(invoice);
                      const tva2Value = getAmountValue(invoice, "tva2");
                      const invoicePresenceText = getFieldValue(
                        invoice,
                        "invoicePresenceText",
                      );

                      return (
                        <TableRow
                          key={invoice.id}
                          className={cn(
                            "cursor-pointer border-border/50 transition-colors animate-fade-in",
                            isOutOfRange &&
                              "border-red-500/35 bg-red-500/7 hover:bg-red-500/12",
                            !isOutOfRange &&
                              !isDuplicate &&
                              !isAlreadyAccounted &&
                              !hasMissingFields &&
                              !hasRecalculatedAmounts &&
                              (isGreenGroup
                                ? "bg-green-100/50 hover:bg-green-200/60"
                                : ""),
                            isDuplicate &&
                              !isAlreadyAccounted &&
                              !hasMissingFields &&
                              "border-red-500 bg-red-100 hover:bg-red-200",
                            isAlreadyAccounted &&
                              "border-violet-400/60 bg-violet-50 hover:bg-violet-100",
                            hasRecalculatedAmounts &&
                              !isAlreadyAccounted &&
                              !isDuplicate &&
                              "border-sky-300/70 bg-sky-50 hover:bg-sky-100",
                            hasMissingFields &&
                              !isAlreadyAccounted &&
                              "border-yellow-500/50 bg-yellow-50 hover:bg-yellow-100",
                          )}
                          style={{ animationDelay: `${index * 50}ms` }}
                          onClick={() => onView(invoice)}
                        >
                          <TableCell className="py-2">
                            <div className="h-10 w-10 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center overflow-hidden relative">
                              {invoice.isProcessing && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                              {invoice.fileUrl && isImage(invoice.filename) ? (
                                <img
                                  src={invoice.fileUrl || "/placeholder.svg"}
                                  alt={invoice.filename}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <FileText className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2 text-sm font-medium text-foreground",
                              isOutOfAccountingRange(invoice) && "text-red-600",
                              isDuplicate &&
                                !isAlreadyAccounted &&
                                "text-red-600 font-semibold",
                              isAlreadyAccounted &&
                                "text-violet-700 font-semibold",
                              hasMissingFields &&
                                !isAlreadyAccounted &&
                                "text-yellow-700 font-semibold",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>
                                {getFieldValue(invoice, "invoiceNumber")}
                              </span>
                              {hasComputedAmounts(invoice) ? (
                                <Badge
                                  variant="outline"
                                  className="border-sky-300 bg-sky-50 text-sky-700 text-xs"
                                >
                                  Re-Calculé
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2 text-sm text-foreground",
                              isOutOfAccountingRange(invoice) && "text-red-600",
                            )}
                          >
                            {partner || "-"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2 text-sm text-muted-foreground",
                              isOutOfRange && "font-medium text-red-600",
                            )}
                          >
                            {getInvoiceDate(invoice)}
                          </TableCell>
                          <TableCell className="py-2 text-sm text-foreground min-w-[220px] max-w-[320px] truncate">
                            <div className="flex flex-col">
                              <span className="truncate">
                                {getFieldValue(invoice, "designation") || "-"}
                              </span>
                              {invoicePresenceText !== "-" ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {invoicePresenceText}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2 text-sm font-semibold",
                              isComputedAmountField(invoice, "amountHT")
                                ? "text-sky-700"
                                : "text-foreground",
                            )}
                          >
                            {getAmountValue(invoice, "amountHT")}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2 text-sm font-semibold",
                              isComputedAmountField(invoice, "tva")
                                ? "text-sky-700"
                                : "text-muted-foreground",
                            )}
                          >
                            <div className="flex flex-col">
                              <span>{getAmountValue(invoice, "tva")}</span>
                              {tva2Value !== "-" ? (
                                <span
                                  className={cn(
                                    "text-xs",
                                    isComputedAmountField(invoice, "tva2")
                                      ? "text-sky-700"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {tva2Value}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2 text-sm font-semibold",
                              isComputedAmountField(invoice, "amountTTC")
                                ? "text-sky-700"
                                : "text-primary",
                            )}
                          >
                            {getAmountValue(invoice, "amountTTC")}
                          </TableCell>
                          <TableCell className="py-2 text-xs font-mono">
                            {pickDisplayValue(
                              invoice.tier?.displayAccount,
                              invoice.tier?.tierNumber,
                              invoice.tier?.collectifAccount,
                              getFieldValue(invoice, "tierNumber"),
                              getFieldValue(invoice, "comptTier"),
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-xs font-mono">
                            {pickDisplayValue(
                              getFieldValue(invoice, "comptht"),
                              invoice.tier?.defaultChargeAccount,
                              getFieldValue(invoice, "chargeAccount"),
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-xs font-mono">
                            {pickDisplayValue(
                              getFieldValue(invoice, "comptTva"),
                              invoice.tier?.tvaAccount,
                              getFieldValue(invoice, "tvaAccount"),
                            )}
                          </TableCell>

                          {showActions && (
                            <TableCell className="py-2">
                              <div
                                className="flex items-center justify-end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-40"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => onView(invoice)}
                                      className="gap-2"
                                    >
                                      <Eye className="h-4 w-4" />
                                      Voir détails
                                    </DropdownMenuItem>

                                    {isSupplierLike &&
                                      onConfirm &&
                                      toWorkflowStatus(invoice.status) ===
                                        "READY_TO_TREAT" && (
                                        <DropdownMenuItem
                                          onClick={() => onConfirm(invoice)}
                                          className="gap-2 text-indigo-500 focus:text-indigo-600"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                          Confirmer l&apos;exactitude
                                        </DropdownMenuItem>
                                      )}

                                    {!isSupplierLike && (
                                      <DropdownMenuItem
                                        onClick={() => onProcessInline(invoice)}
                                        className="gap-2"
                                        disabled={invoice.isProcessing}
                                      >
                                        <Scan className="h-4 w-4" />
                                        {invoice.isProcessing
                                          ? "Traitement..."
                                          : "Traiter OCR"}
                                      </DropdownMenuItem>
                                    )}

                                    {!isSupplierLike &&
                                      onAccount &&
                                      [
                                        "READY_TO_VALIDATE",
                                        "READY_TO_TREAT",
                                      ].includes(
                                        toWorkflowStatus(invoice.status),
                                      ) &&
                                      !isOutOfRange &&
                                      !invoice.accounted &&
                                      !invoice.accountedAt &&
                                      !isAlreadyAccounted &&
                                      hasRequiredAccountingFields(invoice) && (
                                        <DropdownMenuItem
                                          onClick={() => onAccount(invoice)}
                                          className="gap-2 text-emerald-600 focus:text-emerald-700 font-medium"
                                        >
                                          <BookOpenCheck className="h-4 w-4" />
                                          Comptabiliser
                                        </DropdownMenuItem>
                                      )}

                                    {showDeleteAction && onDelete && (
                                      <DropdownMenuItem
                                        onClick={() => handleDelete(invoice)}
                                        className="gap-2 text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Affichage{" "}
                  <span className="font-medium text-foreground">
                    {startIndex + 1}
                  </span>
                  -
                  <span className="font-medium text-foreground">
                    {Math.min(
                      startIndex + itemsPerPage,
                      filteredInvoices.length,
                    )}
                  </span>{" "}
                  sur{" "}
                  <span className="font-medium text-foreground">
                    {filteredInvoices.length}
                  </span>
                  {filteredInvoices.length !== invoices.length && (
                    <span className="ml-1 text-xs">
                      (filtré de {invoices.length})
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="bg-transparent border-border/50 hover:bg-accent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum ? "default" : "ghost"
                          }
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={
                            currentPage === pageNum
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="bg-transparent border-border/50 hover:bg-accent"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
