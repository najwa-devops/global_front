"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Search,
  Eye,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { DynamicInvoice } from "@/lib/types";
import { api } from "@/lib/api";

interface InvoiceHistoryProps {
  invoices: DynamicInvoice[];
  onViewInvoice: (invoice: DynamicInvoice) => void;
  onInvoiceDeleted: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function InvoiceHistory({
  invoices,
  onViewInvoice,
  onInvoiceDeleted,
  isLoading,
  error,
}: InvoiceHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredInvoices = invoices.filter((invoice) => {
    const invoiceNumber =
      invoice.fields.find((f) => f.key === "invoiceNumber")?.value || "";
    const supplier =
      invoice.fields.find((f) => f.key === "supplier")?.value || "";
    const searchLower = searchTerm.toLowerCase();
    return (
      String(invoiceNumber).toLowerCase().includes(searchLower) ||
      String(supplier).toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: DynamicInvoice["status"]) => {
    switch (status) {
      case "validated":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
            <CheckCircle className="mr-1 h-3 w-3" />
            Validé
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            En attente
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Erreur
          </Badge>
        );
    }
  };

  const handleDelete = async (invoice: DynamicInvoice) => {
    if (!invoice.id) return;

    const invoiceNumber =
      invoice.fields.find((f) => f.key === "invoiceNumber")?.value ||
      invoice.filename;

    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer la facture ${invoiceNumber} ?`,
      )
    ) {
      return;
    }

    setDeletingId(String(invoice.id));
    try {
      await api.deleteDynamicInvoice(invoice.id);
      onInvoiceDeleted();
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      alert("Erreur lors de la suppression de la facture");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historique des factures
            </CardTitle>
            <CardDescription>
              {invoices.length} facture{invoices.length !== 1 ? "s" : ""}{" "}
              enregistrée
              {invoices.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Chargement des factures...
            </p>
          </div>
        ) : error ? (
          /* Show error state */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Erreur de connexion
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-4 bg-transparent"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Aucune facture
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Commencez par télécharger une facture pour la traiter.
            </p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Aucun résultat
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune facture ne correspond à votre recherche.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro facture</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const invoiceNumber =
                    invoice.fields.find((f) => f.key === "invoiceNumber")
                      ?.value || "";
                  const rawDate =
                    invoice.fields.find(
                      (f) =>
                        f.key === "invoiceDate" ||
                        f.key === "date" ||
                        f.key === "invoice_date",
                    )?.value || "";
                  const date = rawDate ? String(rawDate) : "-";
                  const supplier =
                    invoice.fields.find((f) => f.key === "supplier")?.value ||
                    "";
                  const amountTTC =
                    invoice.fields.find((f) => f.key === "amountTTC")?.value ||
                    "0";

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {String(invoiceNumber) || invoice.filename}
                      </TableCell>
                      <TableCell>{String(date)}</TableCell>
                      <TableCell>{String(supplier)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {Number.parseFloat(String(amountTTC)).toLocaleString(
                          "fr-FR",
                          {
                            style: "currency",
                            currency: "EUR",
                          },
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewInvoice(invoice)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            Voir
                          </Button>
                          {invoice.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(invoice)}
                              disabled={deletingId === String(invoice.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              {deletingId === String(invoice.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
