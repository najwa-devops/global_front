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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { DynamicInvoice } from "@/lib/types";

interface TemplateSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: DynamicInvoice;
  ice?: string | null;
  ifNumber?: string | null;
  supplier?: string | null;
  onSuccess?: () => void;
}

export function TemplateSignatureDialog({
  open,
  onOpenChange,
  invoice,
  ice,
  ifNumber,
  supplier,
  onSuccess,
}: TemplateSignatureDialogProps) {
  const [selectedSignature, setSelectedSignature] = useState<
    "ice" | "if" | null
  >(null);
  const [isCreating, setIsCreating] = useState(false);

  const hasIce = !!ice?.trim();
  const hasIf = !!ifNumber?.trim();

  useEffect(() => {
    if (!selectedSignature) {
      if (hasIce) setSelectedSignature("ice");
      else if (hasIf) setSelectedSignature("if");
    }
  }, [hasIce, hasIf, selectedSignature]);

  const handleCreate = async () => {
    if (!selectedSignature) {
      toast.error("Veuillez sélectionner une signature (ICE ou IF)");
      return;
    }

    try {
      setIsCreating(true);

      // Déterminer la valeur de signature selon le type sélectionné
      const signatureValue =
        selectedSignature === "ice"
          ? ice || ""
          : selectedSignature === "if"
            ? ifNumber || ""
            : supplier || "";

      if (!signatureValue || signatureValue.trim() === "") {
        toast.error("La valeur de signature est vide");
        setIsCreating(false);
        return;
      }

      console.log("CREATE TEMPLATE:", {
        invoiceId: invoice.id,
        signatureType: selectedSignature,
        signatureValue,
      });

      // Appel API simplifié - le backend extrait les données depuis la facture
      const result = await api.createDynamicTemplate({
        templateName: `Template ${signatureValue}`,
        supplierType: "GENERAL", // Paramètre requis par le nouveau backend
        signature: {
          type: selectedSignature.toUpperCase() as "ICE" | "IF",
          value: signatureValue,
        },
        fieldDefinitions: [],
      });

      console.log("Template créé:", result);

      toast.success(
        `Template créé avec succès!\n\n` + `Nom: ${result.templateName}`,
        { duration: 6000 },
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";

      console.error("Erreur création template:", message);

      // Cas spécifique: ICE invalide
      if (message.includes("ICE invalide")) {
        const hasIfAlternative = ifNumber && ifNumber.trim() !== "";

        if (hasIfAlternative) {
          toast.error(
            `ICE invalide\n\n` +
              `L'ICE "${ice}" a échoué la validation.\n\n` +
              `Suggestion: Utilisez IF à la place`,
            {
              duration: 8000,
              action: {
                label: "Utiliser IF",
                onClick: () => {
                  setSelectedSignature("if");
                },
              },
            },
          );
        } else {
          toast.error(
            `ICE invalide\n\n` +
              `L'ICE "${ice}" a échoué la validation (somme de contrôle invalide).\n\n` +
              `L'OCR a peut-être mal lu ce champ.`,
            { duration: 8000 },
          );
        }
      }
      // Cas: Template existe déjà
      else if (message.includes("existe déjà")) {
        toast.error("Un template existe déjà pour ce fournisseur", {
          duration: 5000,
        });
      }
      // Autres erreurs
      else {
        toast.error(`Erreur: ${message}`, { duration: 5000 });
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Créer un template fournisseur
          </DialogTitle>
          <DialogDescription>
            Ce template accélérera le traitement des prochaines factures de{" "}
            <span className="font-semibold">
              {supplier || "ce fournisseur"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">
                La signature (ICE ou IF) permet d’identifier automatiquement ce
                fournisseur.
              </p>
            </div>
          </div>

          <RadioGroup
            value={selectedSignature ?? ""}
            onValueChange={(v) => setSelectedSignature(v as "ice" | "if")}
            className="space-y-3"
          >
            {hasIce && (
              <div
                onClick={() => setSelectedSignature("ice")}
                className={`cursor-pointer rounded-lg border-2 p-4 transition ${
                  selectedSignature === "ice"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="ice" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="text-base font-semibold">
                        ICE (Identifiant Commun de l'Entreprise)
                      </Label>
                      {selectedSignature === "ice" && (
                        <Badge className="bg-primary">✓ Sélectionné</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Valeur:
                      </span>
                      <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                        {ice}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasIf && (
              <div
                onClick={() => setSelectedSignature("if")}
                className={`cursor-pointer rounded-lg border-2 p-4 transition ${
                  selectedSignature === "if"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="if" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="text-base font-semibold">
                        IF (Identifiant Fiscal)
                      </Label>
                      {selectedSignature === "if" && (
                        <Badge className="bg-primary">✓ Sélectionné</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Valeur:
                      </span>
                      <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                        {ifNumber}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedSignature || isCreating}
          >
            {isCreating ? "Création..." : "Créer le template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
