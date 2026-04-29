"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { CreateDynamicTemplateRequest } from "@/lib/types";

interface AvailableSignature {
  type: "IF" | "ICE" | "RC";
  value: string;
  label: string;
  recommended: boolean;
  reason?: string;
}

interface CreateTemplateModalProps {
  invoiceId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (templateId: number) => void;
  initialSupplierName?: string;
}

export function CreateTemplateModal({
  invoiceId,
  isOpen,
  onClose,
  onSuccess,
  initialSupplierName,
}: CreateTemplateModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatures, setSignatures] = useState<AvailableSignature[]>([]);
  const [selectedSignature, setSelectedSignature] =
    useState<AvailableSignature | null>(null);
  const [templateName, setTemplateName] = useState(initialSupplierName || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSignatures();
    }
  }, [isOpen, invoiceId]);

  const fetchSignatures = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAvailableSignatures(invoiceId);
      setSignatures(data.signatures || []);

      // Select the recommended one by default
      const recommended = data.signatures?.find(
        (s: AvailableSignature) => s.recommended,
      );
      if (recommended) {
        setSelectedSignature(recommended);
      } else if (data.signatures?.length > 0) {
        setSelectedSignature(data.signatures[0]);
      }

      if (data.supplier && !templateName) {
        setTemplateName(data.supplier);
      }
    } catch (err: any) {
      console.error("Erreur fetch signatures:", err);
      setError(
        "Impossible de récupérer les signatures disponibles pour cette facture.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedSignature) {
      toast.error("Veuillez sélectionner une signature");
      return;
    }

    if (!templateName.trim()) {
      toast.error("Veuillez entrer un nom de template");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the invoice to have all data for fixedSupplierData
      const invoice = await api.getInvoiceById(invoiceId);
      const fields = invoice.fieldsData || {};

      const request: CreateDynamicTemplateRequest = {
        templateName: templateName.trim(),
        supplierType: templateName.trim().toUpperCase().replace(/\s+/g, "_"),
        signature: {
          type: selectedSignature.type,
          value: selectedSignature.value,
        },
        fieldDefinitions: [], // Start empty, will be learned or edited later
        fixedSupplierData: {
          ice: fields.ice?.toString(),
          ifNumber: fields.ifNumber?.toString(),
          rcNumber: fields.rcNumber?.toString(),
          supplier: fields.supplier?.toString(),
          address: fields.address?.toString(),
        },
        createdBy: "admin",
      };

      const result = await api.createDynamicTemplate(request);
      toast.success("Template créé avec succès !");
      onSuccess(result.id);
      onClose();
    } catch (err: any) {
      console.error("Erreur création template:", err);
      toast.error(err.message || "Erreur lors de la création du template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden p-0 bg-transparent border-none">
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          {/* Header avec gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">
                  Créer un Template
                </DialogTitle>
                <DialogDescription className="text-blue-100">
                  Identifiez ce fournisseur pour automatiser ses factures
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Nom du Template */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                Nom du Template (Nom du fournisseur)
              </Label>
              <Input
                placeholder="Ex: MAROC TELECOM"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="h-11 border-slate-200 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Section Signature */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-slate-500" />
                Choisir la Signature Unique
              </Label>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-sm text-slate-500 animate-pulse">
                    Analyse des données OCR...
                  </p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">
                    <p className="font-semibold">Erreur</p>
                    <p>{error}</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={fetchSignatures}
                      className="p-0 h-auto text-red-600 mt-1"
                    >
                      Réessayer
                    </Button>
                  </div>
                </div>
              ) : signatures.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">
                      Aucune signature détectée
                    </p>
                    <p className="text-xs text-slate-500 max-w-[250px] mx-auto">
                      L'OCR n'a pas trouvé d'IF, d'ICE ou de RC valide sur ce
                      document.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {signatures.map((sig) => (
                    <Card
                      key={`${sig.type}-${sig.value}`}
                      className={`cursor-pointer transition-all border-2 overflow-hidden ${
                        selectedSignature?.type === sig.type
                          ? "border-blue-600 bg-blue-50/50 shadow-md ring-1 ring-blue-600/20"
                          : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => setSelectedSignature(sig)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full ${
                                selectedSignature?.type === sig.type
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {sig.type}
                                </span>
                                {sig.recommended && (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] h-4">
                                    RECOMMANDÉ
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs font-mono text-slate-600 mt-0.5">
                                {sig.value}
                              </p>
                            </div>
                          </div>
                          {sig.reason && (
                            <div className="hidden sm:block text-[10px] text-slate-400 max-w-[150px] text-right italic">
                              {sig.reason}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-start gap-3 border border-slate-200 dark:border-slate-800">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed">
                <span className="font-bold text-blue-700">
                  Pourquoi une signature ?
                </span>{" "}
                Elle permet au système de reconnaître instantanément ce
                fournisseur sur ses prochaines factures, quel que soit le
                format.
              </p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50/50 border-t border-slate-100 dark:border-slate-900 mt-0">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 min-w-[140px]"
              disabled={
                isSubmitting ||
                isLoading ||
                !selectedSignature ||
                !templateName.trim()
              }
              onClick={handleCreate}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Créer Template
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
