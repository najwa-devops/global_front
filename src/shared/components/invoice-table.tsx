"use client";

import { useState, type ComponentType } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DynamicInvoice } from "@/lib/types";
import {
  formatAmount,
  formatDate,
  toWorkflowStatus,
  validateAmounts,
} from "@/lib/utils";

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
  onDelete: (invoiceId: number) => void;
  onConfirm?: (invoice: DynamicInvoice) => void;
  onFinalValidate?: (invoice: DynamicInvoice) => void;
  onAccount?: (invoice: DynamicInvoice) => void;
  onClientValidate?: (invoice: DynamicInvoice) => void;
  columnPreset?: string;
  bulkActions?: BulkAction[];
  itemsPerPage?: number;
  userRole?: string | undefined;
  highlightInvalidTotals?: boolean;
  highlightCalculatedTotals?: boolean;
}

export function InvoiceTable({
  invoices,
  onView,
  onDelete,
  onProcessInline,
  onConfirm,
  onFinalValidate,
  onAccount,
  itemsPerPage = 10,
  userRole,
  highlightInvalidTotals = false,
  highlightCalculatedTotals = false,
}: InvoiceTableProps) {
  const isSupplierLike = userRole === "FOURNISSEUR" || userRole === "CLIENT";
  const isAccountingRole =
    userRole === "ADMIN" || userRole === "COMPTABLE" || userRole === "SUPER_ADMIN";
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(invoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = invoices.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const normalizeKey = (value: string) => value.trim().toLowerCase();

  const getInvoiceNumberValue = (invoice: DynamicInvoice): string => {
    const numField = invoice.fields.find((f) => f.key === "invoiceNumber");
    return numField?.value ? String(numField.value) : "";
  };

  const getDuplicateReason = (() => {
    const nameCounts = new Map<string, number>();
    invoices.forEach((inv) => {
      const name = normalizeKey(inv.originalName || inv.filename || "");
      if (!name) return;
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    });
    const duplicateNameSet = new Set(
      Array.from(nameCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    );

    const numberCounts = new Map<string, number>();
    invoices.forEach((inv) => {
      const name = normalizeKey(inv.originalName || inv.filename || "");
      if (duplicateNameSet.has(name)) return;
      const num = normalizeKey(getInvoiceNumberValue(inv));
      if (!num) return;
      numberCounts.set(num, (numberCounts.get(num) || 0) + 1);
    });
    const duplicateNumberSet = new Set(
      Array.from(numberCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([num]) => num),
    );

    return (invoice: DynamicInvoice) => {
      const name = normalizeKey(invoice.originalName || invoice.filename || "");
      if (name && duplicateNameSet.has(name)) return "name";
      const num = normalizeKey(getInvoiceNumberValue(invoice));
      if (num && duplicateNumberSet.has(num)) return "number";
      return null;
    };
  })();

  const hasMissingData = (invoice: DynamicInvoice) =>
    Boolean(
      invoice.missingFields?.length ||
        invoice.pendingFields?.length ||
        invoice.allFieldsFound === false,
    );

  const getStatusBadge = (invoice: DynamicInvoice) => {
    const duplicateReason = getDuplicateReason(invoice);
    if (duplicateReason === "name") {
      return (
        <Badge
          className="bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
          title="Cette facture est doublon par nom"
        >
          fac-nom
        </Badge>
      );
    }
    if (duplicateReason === "number") {
      return (
        <Badge
          className="bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
          title="Cette facture est doublon par numero de facture"
        >
          fac-numF
        </Badge>
      );
    }
    if (invoice.accounted || invoice.accountedAt) {
      return (
        <Badge className="bg-teal-500/10 text-teal-600 border-teal-500/30 hover:bg-teal-500/20">
          Comptabilisee
        </Badge>
      );
    }

    const s = toWorkflowStatus(invoice.status);
    switch (s) {
      case "READY_TO_TREAT":
        return (
          <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20">
            En attente
          </Badge>
        );
      case "VERIFY":
        return (
          <Badge className="bg-indigo-400/10 text-indigo-400 border-indigo-400/30 hover:bg-indigo-400/20">
            À vérifier
          </Badge>
        );
      case "READY_TO_VALIDATE":
        return (
          <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/30 hover:bg-blue-400/20">
            {isAccountingRole ? "Prêt à comptabiliser" : "Prêt à valider"}
          </Badge>
        );
      case "VALIDATED":
        return (
          <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/20">
            Validé
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">
            Erreur
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20">
            En attente
          </Badge>
        );
    }
  };

  const getTemplateBadge = (invoice: DynamicInvoice) => {
    if (invoice.templateId) {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 gap-1 w-fit">
            <Zap className="h-3 w-3" />
            Template
          </Badge>
          {invoice.fields.find((f) => f.key === "supplier")?.value && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {String(invoice.fields.find((f) => f.key === "supplier")?.value)}
            </span>
          )}
        </div>
      );
    }

    return (
      <Badge variant="outline" className="gap-1 w-fit">
        <Sparkles className="h-3 w-3" />
        Nouveau
      </Badge>
    );
  };

  const getTypeBadge = (invoice: DynamicInvoice) => {
    if (invoice.isAvoir) {
      return (
        <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20 w-fit">
          Avoir
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="w-fit">
        Facture
      </Badge>
    );
  };

  const getInvoiceDate = (invoice: DynamicInvoice): string => {
    const dateField = invoice.fields.find(
      (f) => f.key === "invoiceDate" || f.key === "date" || f.key === "invoice_date",
    );
    const raw = dateField?.value;
    if (!raw) return "-";

    const rawStr = String(raw).trim();
    if (!rawStr) return "-";

    if (rawStr.includes("/") || rawStr.includes("-") || rawStr.includes(".")) {
      return rawStr;
    }
    try {
      const date = new Date(rawStr);
      if (!isNaN(date.getTime())) {
        return formatDate(date);
      }
    } catch {
      return rawStr;
    }
    return rawStr;
  };

  const getSupplier = (invoice: DynamicInvoice): string => {
    const supplierField = invoice.fields.find((f) => f.key === "supplier");
    return supplierField?.value ? String(supplierField.value) : "-";
  };

  const getHT = (invoice: DynamicInvoice): string => {
    const htField = invoice.fields.find((f) => f.key === "amountHT");
    return htField?.value ? formatAmount(htField.value) : "-";
  };

  const getTVA = (invoice: DynamicInvoice): string => {
    const tvaField = invoice.fields.find((f) => f.key === "tva");
    return tvaField?.value ? formatAmount(tvaField.value) : "-";
  };

  const getTTC = (invoice: DynamicInvoice): string => {
    const ttcField = invoice.fields.find((f) => f.key === "amountTTC");
    return ttcField?.value ? formatAmount(ttcField.value) : "-";
  };

  const getInvoiceNumber = (invoice: DynamicInvoice): string => {
    const num = getInvoiceNumberValue(invoice);
    return num ? num : "-";
  };

  const parseFieldNumber = (invoice: DynamicInvoice, key: string): number => {
    const value = invoice.fields.find((f) => f.key === key)?.value;
    if (value === null || value === undefined || value === "") {
      return Number.NaN;
    }
    const parsed =
      typeof value === "number"
        ? value
        : Number.parseFloat(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const hasInvalidTotals = (invoice: DynamicInvoice): boolean => {
    if (!highlightInvalidTotals) {
      return false;
    }
    const ht = parseFieldNumber(invoice, "amountHT");
    const tva = parseFieldNumber(invoice, "tva");
    const ttc = parseFieldNumber(invoice, "amountTTC");
    if (!Number.isFinite(ht) || !Number.isFinite(tva) || !Number.isFinite(ttc)) {
      return false;
    }
    return !validateAmounts(ht, tva, ttc).valid;
  };

  const hasCalculatedTotals = (invoice: DynamicInvoice): boolean => {
    if (!highlightCalculatedTotals) {
      return false;
    }
    const rawFlag = invoice.fieldsData?.totalsCalculated;
    return rawFlag === true || String(rawFlag).toLowerCase() === "true";
  };

  const getTierAccount = (invoice: DynamicInvoice): string => {
    if (invoice.tier?.displayAccount) return invoice.tier.displayAccount;
    if (invoice.tier?.tierNumber) return invoice.tier.tierNumber;
    if (invoice.tier?.collectifAccount) return invoice.tier.collectifAccount;

    const field = invoice.fields.find((f) => ["tierNumber"].includes(f.key));
    return field?.value ? String(field.value) : "-";
  };

  const getChargeAccount = (invoice: DynamicInvoice): string => {
    if (invoice.tier?.defaultChargeAccount)
      return invoice.tier.defaultChargeAccount;
    const field = invoice.fields.find((f) => f.key === "chargeAccount");
    return field?.value ? String(field.value) : "-";
  };

  const getTvaAccount = (invoice: DynamicInvoice): string => {
    if (invoice.tier?.tvaAccount) return invoice.tier.tvaAccount;
    const field = invoice.fields.find((f) => f.key === "tvaAccount");
    return field?.value ? String(field.value) : "-";
  };

  const handleDelete = (invoice: DynamicInvoice) => {
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

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              Factures
            </CardTitle>
            <CardDescription className="mt-1">
              {invoices.length} facture{invoices.length !== 1 ? "s" : ""}{" "}
              enregistrée{invoices.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
              <FileText className="h-10 w-10 text-muted-foreground" />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-16 text-muted-foreground">
                      Aperçu
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Statut
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      N° Facture
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Fournisseur
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Date Facture
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Montant HT
                    </TableHead>
                    <TableHead className="text-muted-foreground">TVA</TableHead>
                    <TableHead className="text-muted-foreground">
                      Montant TTC
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Numero Compte
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Cpt HT
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Cpt TVA
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice, index) => {
<<<<<<< HEAD
                    const duplicateReason = getDuplicateReason(invoice);
                    const isDuplicate = Boolean(duplicateReason);
                    const isMissing = hasMissingData(invoice);
                    const rowHoverClass = isDuplicate
                      ? "hover:bg-red-500/10"
                      : isMissing
                        ? "hover:bg-orange-500/10"
                        : "hover:bg-accent/50";
                    return (
                      <TableRow
                        key={invoice.id}
                        className={`border-border/50 cursor-pointer transition-colors ${rowHoverClass} animate-fade-in`}
=======
                    const invalidTotals = hasInvalidTotals(invoice);
                    const calculatedTotals = hasCalculatedTotals(invoice);
                    return (
                      <TableRow
                        key={invoice.id}
                        className={`border-border/50 cursor-pointer transition-colors animate-fade-in ${
                          invalidTotals
                            ? "bg-red-500/10 hover:bg-red-500/20"
                            : calculatedTotals
                              ? "bg-orange-500/10 hover:bg-orange-500/20"
                            : "hover:bg-accent/50"
                        }`}
>>>>>>> 1f3c3b80a0beedc18c8eae1e4094829593efdfd6
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => onView(invoice)}
                      >
                      <TableCell>
                        <div className="h-12 w-12 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center overflow-hidden relative">
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
                      <TableCell>{getStatusBadge(invoice)}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex flex-col gap-1">
                          {getInvoiceNumber(invoice)}
                          {getTypeBadge(invoice)}
                          {getTemplateBadge(invoice)}
                        </div>
                      </TableCell>
                      <TableCell
                        className={
                          invalidTotals
                            ? "text-red-600"
                            : calculatedTotals
                              ? "text-orange-700"
                              : "text-foreground"
                        }
                      >
                        {getSupplier(invoice)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getInvoiceDate(invoice)}
                      </TableCell>
                      <TableCell
                        className={
                          invalidTotals
                            ? "font-semibold text-red-700"
                            : calculatedTotals
                              ? "font-semibold text-orange-700"
                            : "font-semibold text-foreground"
                        }
                      >
                        {getHT(invoice)}
                      </TableCell>
                      <TableCell
                        className={
                          invalidTotals
                            ? "font-semibold text-red-700"
                            : calculatedTotals
                              ? "font-semibold text-orange-700"
                            : "font-semibold text-muted-foreground"
                        }
                      >
                        {getTVA(invoice)}
                      </TableCell>
                      <TableCell
                        className={
                          invalidTotals
                            ? "font-semibold text-red-700"
                            : calculatedTotals
                              ? "font-semibold text-orange-700"
                            : "font-semibold text-primary"
                        }
                      >
                        {getTTC(invoice)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {getTierAccount(invoice)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {getChargeAccount(invoice)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {getTvaAccount(invoice)}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
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
                                  disabled={invoice.isProcessing || isDuplicate}
                                >
                                  <Scan className="h-4 w-4" />
                                  {invoice.isProcessing
                                    ? "Traitement..."
                                    : "Traiter OCR"}
                                </DropdownMenuItem>
                              )}

                              {!isSupplierLike &&
                                !isAccountingRole &&
                                onFinalValidate &&
                                toWorkflowStatus(invoice.status) ===
                                  "READY_TO_VALIDATE" && (
                                  <DropdownMenuItem
                                    onClick={() => onFinalValidate(invoice)}
                                    className="gap-2 text-emerald-600 focus:text-emerald-700 font-medium"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Validation finale
                                  </DropdownMenuItem>
                                )}

                              {!isSupplierLike &&
                                onAccount &&
                                (toWorkflowStatus(invoice.status) ===
                                  "VALIDATED" ||
                                  (isAccountingRole &&
                                    toWorkflowStatus(invoice.status) ===
                                      "READY_TO_VALIDATE")) &&
                                !invoice.accounted &&
                                !invoice.accountedAt && (
                                  <DropdownMenuItem
                                    onClick={() => onAccount(invoice)}
                                    className="gap-2 text-emerald-600 focus:text-emerald-700 font-medium"
                                    disabled={isDuplicate}
                                  >
                                    <BookOpenCheck className="h-4 w-4" />
                                    Comptabiliser
                                  </DropdownMenuItem>
                                )}

                              {!invoice.accounted && !invoice.accountedAt && (
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
<<<<<<< HEAD
                    </TableRow>
=======
                      </TableRow>
>>>>>>> 1f3c3b80a0beedc18c8eae1e4094829593efdfd6
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Affichage{" "}
                  <span className="font-medium text-foreground">
                    {startIndex + 1}
                  </span>
                  -
                  <span className="font-medium text-foreground">
                    {Math.min(startIndex + itemsPerPage, invoices.length)}
                  </span>{" "}
                  sur{" "}
                  <span className="font-medium text-foreground">
                    {invoices.length}
                  </span>
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
