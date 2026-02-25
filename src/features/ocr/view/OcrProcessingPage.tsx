"use client";

import type React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  FileText,
  Save,
  Target,
  X,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Download,
  ZoomIn,
  ZoomOut,
  Lightbulb,
  Check,
  Scan,
  Building2,
  Settings,
  MousePointer2,
  Crosshair,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DynamicInvoice,
  LocalTemplate,
  DynamicInvoiceField,
  Tier,
  Account,
} from "@/lib/types";
import { api } from "@/lib/api";
import { formatDate, normalizeStatus, toWorkflowStatus } from "@/lib/utils";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { dynamicInvoiceDtoToLocal, ParseBackendFieldsData } from "@/lib/utils";
import { TierCreationModal } from "@/components/tier-creation-modal";
import { TierSelectionModal } from "@/components/tier-selection-modal";
import { CreateTemplateModal } from "@/components/create-template-modal";
import { DynamicTemplateWizard } from "@/components/dynamic-template-wizard";

// CSS pour react-pdf
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Import dynamique de react-pdf
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false },
);

const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
});

interface OcrProcessingPageProps {
  invoice: DynamicInvoice;
  file: File | null;
  templates: LocalTemplate[];
  onBack: () => void;
  onSave: (invoice: DynamicInvoice, template?: LocalTemplate) => void;
  isDemoMode?: boolean;
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface Warning {
  field: string;
  message: string;
  suggestion?: string;
}

export function OcrProcessingPage({
  invoice,
  file,
  templates,
  onBack,
  onSave,
  isDemoMode = false,
}: OcrProcessingPageProps) {
  const router = useRouter();
  const [fields, setFields] = useState<DynamicInvoiceField[]>(invoice.fields);
  const allFields = fields;
  const [extractedText, setExtractedText] = useState(
    invoice.rawOcrText || invoice.extractedText || "",
  );
  const [headerText, setHeaderText] = useState(invoice.headerText || "");
  const [footerText, setFooterText] = useState(invoice.footerText || "");
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSelectingPosition, setIsSelectingPosition] = useState<string | null>(
    null,
  );
  const [selectionMode, setSelectionMode] = useState<"VALUE" | "PATTERN">(
    "VALUE",
  );
  const [fieldPatterns, setFieldPatterns] = useState<Record<string, string>>(
    {},
  );
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [pendingFields, setPendingFields] = useState<string[]>(
    invoice.pendingFields || [],
  );
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [showOcrText, setShowOcrText] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState<DynamicInvoice["status"]>(
    invoice.status || "pending",
  );
  const [missingFields, setMissingFields] = useState<string[]>(
    invoice.missingFields || [],
  );
  const [extractionMethod, setExtractionMethod] = useState<string | undefined>(
    invoice.extractionMethod,
  );
  const [templateDetected, setTemplateDetected] = useState<boolean>(
    invoice.templateDetected || false,
  );
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [documentRendered, setDocumentRendered] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [isTierLinking, setIsTierLinking] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<
    "ice" | "ifNumber" | null
  >(null);
  const [canCreateTemplate, setCanCreateTemplate] = useState<boolean>(
    invoice.canCreateTemplate || false,
  );
  const [tier, setTier] = useState<Tier | null>(invoice.tier || null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>(
    invoice.autoFilledFields || [],
  );
  const [hasShownTierToast, setHasShownTierToast] = useState(false);
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [isTierSelectionModalOpen, setIsTierSelectionModalOpen] =
    useState(false);
  const [selectedTierForUpdate, setSelectedTierForUpdate] = useState<
    Tier | undefined
  >(undefined);
  const [isLinkingTier, setIsLinkingTier] = useState(false);
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] =
    useState(false);
  const [isExistingSupplier, setIsExistingSupplier] = useState(false);

  // Tracking for failed lookups to avoid console noise
  const lookupCache = useRef<Set<string>>(new Set());

  // États pour les comptes comptables (dropdowns)
  const [chargeAccounts, setChargeAccounts] = useState<Account[]>([]);
  const [tvaAccounts, setTvaAccounts] = useState<Account[]>([]);
  const [fournisseurAccounts, setFournisseurAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Synchroniser extractedText si la facture change (ex: après un rechargement parent)
  useEffect(() => {
    if (invoice.rawOcrText || invoice.extractedText) {
      setExtractedText(invoice.rawOcrText || invoice.extractedText || "");
    }
    if (invoice.headerText) setHeaderText(invoice.headerText);
    if (invoice.footerText) setFooterText(invoice.footerText);
  }, [
    invoice.rawOcrText,
    invoice.extractedText,
    invoice.headerText,
    invoice.footerText,
  ]);

  const isImage = invoice.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = invoice.filename.match(/\.pdf$/i);
  const pdfFile = useMemo(() => {
    if (!documentUrl) return null;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const isRemoteHttp = /^https?:\/\//i.test(documentUrl);
    if (isRemoteHttp) {
      return {
        url: documentUrl,
        withCredentials: true,
        ...(token ? { httpHeaders: { Authorization: `Bearer ${token}` } } : {}),
      };
    }
    return documentUrl;
  }, [documentUrl]);

  // Configuration PDF.js Worker
  useEffect(() => {
    (async () => {
      const { pdfjs } = await import("react-pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    })();
  }, []);

  useEffect(() => {
    if (!selectedSignature && canCreateTemplate) {
      const iceValue = fields.find((f) => f.key === "ice")?.value;
      const ifValue = fields.find((f) => f.key === "ifNumber")?.value;

      if (iceValue && !ifValue) setSelectedSignature("ice");
      else if (!iceValue && ifValue) setSelectedSignature("ifNumber");
    }
  }, [canCreateTemplate, fields, selectedSignature]);

  // Toast si Tier existe mais sans configuration comptable
  useEffect(() => {
    if (tier && !tier.hasAccountingConfig && !hasShownTierToast) {
      toast.warning(
        "Veuillez configurer les comptes comptables pour ce fournisseur",
        {
          duration: 5000,
          action: {
            label: "Plus tard",
            onClick: () => {},
          },
        },
      );
      setHasShownTierToast(true);
    }
  }, [tier, hasShownTierToast]);

  // Charger les comptes comptables au montage
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const [charges, tva, fournisseurs] = await Promise.all([
          api.getChargeAccounts(),
          api.getTvaAccounts(),
          api.getFournisseurAccounts(),
        ]);
        setChargeAccounts(charges);
        if (tva.length > 0) {
          setTvaAccounts(tva);
        } else {
          const accounts = await api.getAccounts(true);
          setTvaAccounts(
            accounts.filter(
              (a) => a.code.startsWith("345") || a.code.startsWith("445"),
            ),
          );
        }
        setFournisseurAccounts(fournisseurs);
      } catch (error) {
        try {
          const [charges, fournisseurs, accounts] = await Promise.all([
            api.getChargeAccounts(),
            api.getFournisseurAccounts(),
            api.getAccounts(true),
          ]);
          setChargeAccounts(charges);
          setFournisseurAccounts(fournisseurs);
          setTvaAccounts(
            accounts.filter(
              (a) => a.code.startsWith("345") || a.code.startsWith("445"),
            ),
          );
        } catch (fallbackError) {
          console.error(
            "Erreur lors du chargement des comptes:",
            error,
            fallbackError,
          );
          toast.error("Impossible de charger le plan comptable");
        }
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  // Fonction pour lier un Tier à la facture
  const handleLinkTier = async (selectedTierId: number) => {
    setIsTierLinking(true);
    const toastId = toast.loading("Liaison du fournisseur en cours...");

    try {
      const result = await api.linkTierToInvoice(invoice.id, selectedTierId);

      // On met à jour l'état local avec la nouvelle facture renvoyée
      if (result.invoice) {
        const updatedInvoice = dynamicInvoiceDtoToLocal(result.invoice);
        setFields(updatedInvoice.fields);
        setTier(updatedInvoice.tier || null);
        setStatus(updatedInvoice.status);
        setMissingFields(updatedInvoice.missingFields || []);
        setTemplateDetected(updatedInvoice.templateDetected || false);
        setAutoFilledFields(updatedInvoice.autoFilledFields || []);

        toast.success(
          `Fournisseur "${updatedInvoice.tier?.libelle}" lié avec succès`,
          { id: toastId },
        );
      }
    } catch (error: any) {
      console.error("Erreur liaison tier:", error);
      toast.error(error.message || "Erreur lors de la liaison du fournisseur", {
        id: toastId,
      });
    } finally {
      setIsTierLinking(false);
    }
  };

  // Fonction pour gérer la sélection d'un tier existant
  const handleTierSelect = (selectedTier: Tier) => {
    const ice = String(fields.find((f) => f.key === "ice")?.value || "");
    const ifNumber = String(
      fields.find((f) => f.key === "ifNumber")?.value || "",
    );
    const rcNumber = String(
      fields.find((f) => f.key === "rcNumber")?.value || "",
    );

    // Si le tier sélectionné n'a pas d'ICE, IF ou RC alors que l'OCR en a trouvé,
    // on ouvre le modal de création en mode "Update" pour compléter les infos.
    const needsUpdate =
      (!selectedTier.ice && ice) ||
      (!selectedTier.ifNumber && ifNumber) ||
      (!selectedTier.rcNumber && rcNumber);

    if (needsUpdate) {
      setSelectedTierForUpdate(selectedTier);
      setIsTierSelectionModalOpen(false);
      setIsTierModalOpen(true);
    } else {
      setIsTierSelectionModalOpen(false);
      handleLinkTier(selectedTier.id);
    }
  };

  // ADDED: Gestion de la sélection de texte automatique pour extraction
  // Cette fonction gère maintenant TOUT : la capture du texte ET la position
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Si on n'est pas en mode sélection, on ne fait rien
      if (!isSelectingPosition || !imageContainerRef.current) return;

      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (selectedText && selection && selection.rangeCount > 0) {
        const fieldKey = isSelectingPosition;

        console.log(`[OCR] Capture Text Selection: "${selectedText}"`);

        if (selectionMode === "VALUE") {
          setFields((prev) =>
            prev.map((f) =>
              f.key === fieldKey
                ? {
                    ...f,
                    value: selectedText,
                    detected: true,
                  }
                : f,
            ),
          );

          toast.success(`Valeur importée : "${selectedText}"`, {
            icon: "🎯",
          });
        } else {
          // PATTERN MODE
          setFieldPatterns((prev) => ({
            ...prev,
            [fieldKey]: selectedText,
          }));

          toast.info(`Pattern détecté: "${selectedText}"`, {
            icon: "🔍",
          });
        }

        // Reset selection mode
        setIsSelectingPosition(null);
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isSelectingPosition, selectionMode]);

  // Chargement du document
  useEffect(() => {
    const loadDocumentUrl = async () => {
      setIsLoadingDocument(true);
      setDocumentError(null);
      setDocumentRendered(false);
      setNumPages(0);
      setPageNumber(1);

      try {
        // CAS 1: Fichier local
        if (file) {
          const url = URL.createObjectURL(file);
          setDocumentUrl(url);
          setIsLoadingDocument(false);
          return;
        }

        // CAS 2: Fichier sur serveur
        if (invoice.filePath || invoice.filename) {
          const url = api.getFileUrl(
            invoice.filePath || invoice.filename,
            invoice.id,
          );
          setDocumentUrl(url);
          setIsLoadingDocument(false);
          return;
        }

        setDocumentError("Aucun fichier disponible");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Erreur inconnue";
        setDocumentError(`Erreur: ${errorMessage}`);
      } finally {
        setIsLoadingDocument(false);
      }
    };

    loadDocumentUrl();

    return () => {
      if (file && documentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [file, invoice.filePath, invoice.filename, isDemoMode]);

  const getStatusBadge = () => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500 text-white">En attente</Badge>;
      case "processing":
        return (
          <Badge className="bg-blue-500 text-white">
            En cours de traitement
          </Badge>
        );
      case "treated":
        return <Badge className="bg-purple-500 text-white">OCR terminé</Badge>;
      case "ready_to_validate":
        return <Badge className="bg-blue-600 text-white">Prêt à valider</Badge>;
      case "validated":
        return <Badge className="bg-green-600 text-white">Validé </Badge>;
      case "error":
        return <Badge className="bg-red-500 text-white">Erreur</Badge>;
      default:
        return <Badge className="bg-amber-500 text-white">En attente</Badge>;
    }
  };

  const checkWarnings = () => {
    const newWarnings: Warning[] = [];

    const ht = Number.parseFloat(
      String(fields.find((f) => f.key === "amountHT")?.value || "0"),
    );
    const tva = Number.parseFloat(
      String(fields.find((f) => f.key === "tva")?.value || "0"),
    );
    const ttc = Number.parseFloat(
      String(fields.find((f) => f.key === "amountTTC")?.value || "0"),
    );

    if (ht > 0 && ttc > 0) {
      const expectedTva = ht * 0.2;
      if (tva > 0 && Math.abs(tva - expectedTva) > 1) {
        newWarnings.push({
          field: "tva",
          message: `La TVA detectee (${tva} DH) semble incorrecte.`,
          suggestion: `${expectedTva.toFixed(2)}`,
        });
      }

      const expectedTtc = ht + (tva || expectedTva);
      if (Math.abs(ttc - expectedTtc) > 1) {
        newWarnings.push({
          field: "amountTTC",
          message: `Le TTC detecte (${ttc} DH) semble incorrect.`,
          suggestion: `${expectedTtc.toFixed(2)}`,
        });
      }
    }

    setWarnings(newWarnings);
  };

  const handleOcrExtract = async (forcedTemplateId?: number) => {
    setIsProcessingOcr(true);
    setStatus("processing");

    const loadingToast = toast.loading(
      forcedTemplateId
        ? "Extraction avec le nouveau template..."
        : "Traitement OCR en cours...",
      { description: "Cela peut prendre 10-30 secondes" },
    );

    try {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const demoText = `FACTURE N FAC-2026-001...`;
        setExtractedText("M. Abdelkarim Nabil\r\nargan golf\r\n...");
        setHeaderText("ARCANES\nTECHNOLOGIES\nFACTURE N° 328974-25-DHJ\n...");
        setFooterText(
          "=== FOOTER ===\nN° ICE: 003153509000014\nN° RC: 129189\nPATENTE N°: 64004501\nIF N°: 52675350",
        );

        const updatedFields = fields.map((f) => {
          switch (f.key) {
            case "invoiceNumber":
              return { ...f, value: "FAC-2026-001", detected: true };
            case "invoiceDate":
              return { ...f, value: "08/01/2026", detected: true };
            case "supplier":
              return { ...f, value: "EVOLEO SARL", detected: true };
            case "ice":
              return { ...f, value: "003501940000019", detected: true };
            case "amountHT":
              return { ...f, value: "23000.00", detected: true };
            case "tva":
              return { ...f, value: "4600.00", detected: true };
            case "amountTTC":
              return { ...f, value: "27600.00", detected: true };
            default:
              return f;
          }
        });
        setFields(updatedFields);
        setPendingFields([]);
        setStatus("treated"); //NOUVEAU: TREATED après OCR
        setTimeout(checkWarnings, 100);
        toast.dismiss(loadingToast);
        toast.success("OCR terminé (Mode Démo)", {
          description: "Données extraites avec succès",
          duration: 4000,
        });
        return;
      }

      console.log(
        "Extraction pour Facture ID:",
        invoice.id,
        "Template:",
        forcedTemplateId || invoice.templateId,
      );

      let result: any;
      if (forcedTemplateId) {
        // Version avec template forcé
        console.log(
          "Appel extractWithTemplate pour templateId:",
          forcedTemplateId,
        );
        const extractionResponse = await api.extractWithTemplate(
          invoice.id,
          forcedTemplateId,
        );

        // Comme extractWithTemplate renvoie un format spécifique, on récupère le DTO complet pour la mise à jour UI
        // car le backend met à jour la facture en base lors de l'extraction
        result = await api.getDynamicInvoiceById(invoice.id);
      } else {
        // Mode Reprocess standard (nouvel endpoint V2)
        console.log("Appel processDynamicInvoice (Reprocess)...");
        const currentWorkflowStatus = toWorkflowStatus(
          status || invoice.status,
        );
        if (currentWorkflowStatus === "VERIFY") {
          await api.updateInvoiceStatus(invoice.id, "READY_TO_TREAT");
        }
        result = await api.processDynamicInvoice(invoice.id);
      }

      console.log("=== DYNAMIC OCR RESULT (V2 - Corrected Endpoint) ===");
      console.log("Template:", result.templateName);
      console.log("Status:", result.status);
      console.log("Confidence:", result.overallConfidence);
      console.log("===============================");

      // Si Result n'a pas le texte OCR, on garde l'ancien texte s'il existe
      const newText = result.rawOcrText || result.extractedText;
      if (newText) {
        setExtractedText(newText);
      }

      // Map Header/Footer texts from result (backend returns headerRawText/footerRawText)
      const res = result as any;
      if (res.headerRawText) setHeaderText(res.headerRawText);
      if (res.footerRawText) setFooterText(res.footerRawText);

      // Mettre à jour les alertes techniques
      setMissingFields(result.missingFields || []);
      setExtractionMethod(
        result.extractionMethod ||
          (result.templateId ? "DYNAMIC_TEMPLATE" : "PATTERNS"),
      );
      setTemplateDetected(!!result.templateId);

      const normalizedStatus = normalizeStatus(result.status || "treated");
      setStatus(normalizedStatus);

      // DynamicInvoiceDto uses fieldsData
      const extractionFields = result.fieldsData;

      if (extractionFields) {
        const updatedFields = ParseBackendFieldsData(
          extractionFields,
          fields,
          result,
          newText,
        );
        setFields(updatedFields);
        setAutoFilledFields(result.autoFilledFields || []);
      }

      toast.dismiss(loadingToast);

      if (result.templateId) {
        toast.success(`Template "${result.templateName}" appliqué`, {
          description: `Confiance: ${((result.overallConfidence || 0) * 100).toFixed(0)}%`,
          duration: 5000,
        });
      } else {
        toast.success("Extraction dynamique terminée", {
          description: `Confiance: ${((result.overallConfidence || 0) * 100).toFixed(0)}%`,
          duration: 4000,
        });
      }

      setTimeout(checkWarnings, 100);
    } catch (err: any) {
      console.error("OCR Extraction Error:", err);
      toast.dismiss(loadingToast);
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors de l'extraction OCR";

      const is500 =
        errorMessage.includes("500") || errorMessage.includes("EXTRACTION_500");
      const isMissingOcr =
        errorMessage.includes("Texte OCR non disponible") ||
        errorMessage.includes("EXTRACTION_400");

      if (isMissingOcr) {
        toast.error("Données OCR manquantes", {
          description:
            "Ce document ne contient pas de texte numérisé exploitable. Il est peut-être mal scanné ou l'upload a échoué.",
          duration: 6000,
          action: {
            label: "Compris",
            onClick: () => toast.dismiss(),
          },
        });
      } else {
        toast.error(is500 ? "Erreur Serveur (500)" : "Erreur Extraction", {
          description: is500
            ? `Échec du traitement pour la facture #${invoice.id}. Le service d'extraction est indisponible.`
            : errorMessage,
          duration: is500 ? 8000 : 5000,
          action: {
            label: "Réessayer",
            onClick: () => handleOcrExtract(forcedTemplateId),
          },
        });
      }
      setStatus("error");
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const updateFieldValue = (key: string, value: string | number) => {
    const valueStr = String(value);
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: valueStr } : f)),
    );
    setPendingFields((prev) => prev.filter((f) => f !== key));
    setWarnings((prev) => prev.filter((w) => w.field !== key));

    if (key === "amountHT" || key === "tva" || key === "amountTTC") {
      setTimeout(() => {
        const ht = Number.parseFloat(
          key === "amountHT"
            ? String(value)
            : String(fields.find((f) => f.key === "amountHT")?.value || "0"),
        );
        const tva = Number.parseFloat(
          key === "tva"
            ? String(value)
            : String(fields.find((f) => f.key === "tva")?.value || "0"),
        );

        if (key === "amountHT" && ht > 0) {
          const newTva = ht * 0.2;
          const newTtc = ht + newTva;
          setFields((prev) =>
            prev.map((f) => {
              if (f.key === "tva") return { ...f, value: newTva.toFixed(2) };
              if (f.key === "amountTTC")
                return { ...f, value: newTtc.toFixed(2) };
              return f;
            }),
          );
        }
      }, 500);
    }
  };

  const updateTierField = (key: keyof Tier, value: string) => {
    setTier((prev) => {
      if (!prev) {
        return {
          id: 0,
          libelle: "Fournisseur manuel",
          tierNumber: key === "tierNumber" ? value : "40110001",
          defaultChargeAccount: key === "defaultChargeAccount" ? value : "",
          tvaAccount: key === "tvaAccount" ? value : "",
          active: true,
          hasAccountingConfig: true,
          auxiliaireMode: true,
          [key]: value,
        } as Tier;
      }
      return { ...prev, [key]: value };
    });

    // Synchroniser avec l'état 'fields' pour l'enregistrement
    const fieldMapping: Record<string, string> = {
      tierNumber: "tierNumber",
      collectifAccount: "collectifAccount",
      defaultChargeAccount: "chargeAccount",
      tvaAccount: "tvaAccount",
      defaultTvaRate: "tvaRate",
    };

    if (fieldMapping[key]) {
      updateFieldValue(fieldMapping[key], value);
    }
  };

  useEffect(() => {
    const checkExistingSupplier = async () => {
      // Ne rien faire si déjà lié ou si pas de données de recherche
      if (tier) {
        setIsExistingSupplier(true);
        return;
      }

      const iceField = fields.find((f) => f.key === "ice")?.value;
      const ifField = fields.find((f) => f.key === "ifNumber")?.value;

      const iceValue = iceField ? String(iceField).trim() : "";
      const ifValue = ifField ? String(ifField).trim() : "";

      // Need at least 8 chars for ICE/IF to be worth searching (avoid noise on partial typing)
      if (iceValue.length < 8 && ifValue.length < 8) return;

      // Use cache to avoid redundant 404s
      const lookupKey = `ice:${iceValue}|if:${ifValue}`;
      if (lookupCache.current.has(lookupKey)) return;

      try {
        let foundTier: Tier | null = null;
        // On cherche par ICE d'abord
        if (iceValue.length >= 8) {
          foundTier = await api.getTierByIce(iceValue);
        }
        // Sinon par IF
        if (!foundTier && ifValue.length >= 8) {
          foundTier = await api.getTierByIfNumber(ifValue);
        }

        if (foundTier) {
          setIsExistingSupplier(true);
          setTier(foundTier);

          // FORCER le libellé fournisseur avec celui du Tier identifié (Correction demandée)
          updateFieldValue("supplier", foundTier.libelle);

          // Auto-remplissage des comptes depuis le Tier (Plan Tier)
          if (foundTier.collectifAccount)
            updateFieldValue("collectifAccount", foundTier.collectifAccount);
          if (foundTier.tierNumber)
            updateFieldValue("tierNumber", foundTier.tierNumber);
          if (foundTier.defaultChargeAccount)
            updateFieldValue("chargeAccount", foundTier.defaultChargeAccount);
          if (foundTier.tvaAccount)
            updateFieldValue("tvaAccount", foundTier.tvaAccount);
          if (foundTier.defaultTvaRate)
            updateFieldValue("tvaRate", foundTier.defaultTvaRate);
        } else {
          setIsExistingSupplier(false);
          // Mark as tried to avoid spamming 404s
          lookupCache.current.add(lookupKey);
        }
      } catch (error) {
        console.error(
          "Erreur lors de la vérification du fournisseur existant:",
          error,
        );
        // Also mark as tried on error to avoid looping on 500s or persistent issues
        lookupCache.current.add(lookupKey);
      }
    };

    checkExistingSupplier();
  }, [fields, tier]);

  // NOUVEAU: Synchronisation de la sélection native avec le champ actif
  // Simplified to only handle "PASSIVE" focus updates (when checking fields)
  // The active selection logic is now in the main useEffect at the top
  useEffect(() => {
    const handleMouseUpSelection = () => {
      // Si on est en mode sélection active (target), on laisse l'autre useEffect gérer
      if (isSelectingPosition) return;

      const selection = window.getSelection()?.toString().trim();
      if (!selection) return;

      if (focusedFieldKey) {
        // Mode passif (juste un champ focalisé dans le formulaire)
        const standardField = fields.find((f) => f.key === focusedFieldKey);
        if (standardField) {
          updateFieldValue(focusedFieldKey, selection);
          toast.success(
            `Valeur capturée : ${selection.length > 20 ? selection.substring(0, 20) + "..." : selection}`,
          );
        } else if (focusedFieldKey.startsWith("tier_")) {
          // ... tier logic
          const tierKey = focusedFieldKey.replace("tier_", "") as keyof Tier;
          updateTierField(tierKey, selection);
          toast.success(`Compte mis à jour : ${selection}`);
        }
      }
    };

    document.addEventListener("mouseup", handleMouseUpSelection);
    return () =>
      document.removeEventListener("mouseup", handleMouseUpSelection);
  }, [focusedFieldKey, isSelectingPosition, updateFieldValue, fields]);

  const clearFieldValue = (key: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.key === key
          ? { ...f, value: "", detected: false, position: undefined }
          : f,
      ),
    );
    setPendingFields((prev) => prev.filter((f) => f !== key));
    setWarnings((prev) => prev.filter((w) => w.field !== key));
    toast.info(`Champ "${fields.find((f) => f.key === key)?.label}" vidé`);
  };

  const applySuggestion = (warning: Warning) => {
    if (warning.suggestion) {
      updateFieldValue(warning.field, warning.suggestion);
    }
  };

  const startSelection = (key: string, mode: "VALUE" | "PATTERN" = "VALUE") => {
    setIsSelectingPosition(key);
    setSelectionMode(mode);
    setSelectionBox(null);
    toast.info(
      mode === "PATTERN"
        ? "Sélectionnez le pattern (label) dans le document"
        : "Sélectionnez la valeur dans le document",
    );
  };

  const cancelPositionSelection = () => {
    setIsSelectingPosition(null);
    setSelectionBox(null);
  };

  // Manual extraction features removed as they are not supported by the new backend controllers

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // 1. Préparer les données pour le backend (V2 attend un Map<String, String>)
      const fieldsForBackend: Record<string, string> = {};

      fields.forEach((field) => {
        fieldsForBackend[field.key] = String(field.value || "");
      });

      // 2. Pour le Wizard et le state local, on garde la structure complète
      const updatedInvoice: DynamicInvoice = {
        ...invoice,
        status: status === "validated" ? "validated" : "ready_to_validate",
      };

      console.log("handleSave called - isDemoMode:", isDemoMode);

      if (!isDemoMode) {
        console.log(
          "Sending fields and patterns to backend:",
          fieldsForBackend,
          fieldPatterns,
        );
        // Enregistrer les champs avec patterns (V2) pour apprentissage immédiat
        const savedInvoice = await api.updateDynamicInvoiceFields(
          invoice.id,
          fieldsForBackend,
        );
        console.log("Facture enregistrée:", savedInvoice);

        // Mettre à jour l'état local avec les métadonnées V2 (confiance, champs manquants)
        if (savedInvoice.missingFields)
          setMissingFields(savedInvoice.missingFields);
        if (savedInvoice.autoFilledFields)
          setAutoFilledFields(savedInvoice.autoFilledFields);

        // Mettre à jour le statut (devient READY_TO_VALIDATE)
        const normalizedStatus = normalizeStatus(savedInvoice.status);
        setStatus(normalizedStatus);

        if (canCreateTemplate && !templateDetected) {
          console.log(
            "Ouverture du Wizard de template (Nouveau fournisseur détecté)",
          );
          setIsCreatingTemplate(true);
          toast.info(
            "Nouveau fournisseur détecté : configurez votre template",
            {
              duration: 5000,
            },
          );
        }
      }

      // 4. Notifier le parent du changement
      onSave(updatedInvoice);
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (status !== "ready_to_validate") {
      toast.error("Veuillez d'abord enregistrer les données");
      return;
    }

    setIsValidating(true);

    try {
      if (!isDemoMode) {
        await api.validateInvoice(invoice.id);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setStatus("validated");

      const updatedInvoice: DynamicInvoice = {
        ...invoice,
        status: "validated",
      };

      onSave(updatedInvoice);

      toast.success("Facture validée avec succès");
    } catch (err) {
      console.error("Validation failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur lors de la validation: ${errorMessage}`);
    } finally {
      setIsValidating(false);
    }
  };

  // --- NOUVEAUX HANDLERS POUR LA SÉLECTION MANUELLE ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // OLD MANUAL DRAWING DISABLED
    // We now rely on native text selection in the useEffect above
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // OLD MANUAL DRAWING DISABLED
  };

  const handleMouseUp = () => {
    // OLD MANUAL DRAWING DISABLED
  };
  // --------------------------------------------------

  const getSelectionBoxStyle = () => {
    if (!selectionBox) return {};
    const minX = Math.min(selectionBox.startX, selectionBox.endX);
    const minY = Math.min(selectionBox.startY, selectionBox.endY);
    const width = Math.abs(selectionBox.endX - selectionBox.startX);
    const height = Math.abs(selectionBox.endY - selectionBox.startY);
    return {
      left: `${minX}%`,
      top: `${minY}%`,
      width: `${width}%`,
      height: `${height}%`,
    };
  };

  const isValidated = status === "validated";

  // Fonction pour rendre la carte d'informations Tier
  // const renderTierCard = () => {
  //   if (!tier) return null

  //   return (
  //     <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
  //       <CardHeader className="pb-3">
  //         <div className="flex items-center justify-between">
  //           <CardTitle className="text-base flex items-center gap-2">
  //             <Building2 className="h-4 w-4 text-blue-600" />
  //             Fournisseur Identifié
  //           </CardTitle>
  //           <Badge variant={tier.hasAccountingConfig ? "default" : "secondary"}>
  //             {tier.hasAccountingConfig ? "Comptes configurés" : "Configuration requise"}
  //           </Badge>
  //         </div>
  //       </CardHeader>
  //       <CardContent className="space-y-3">
  //         <div className="grid grid-cols-2 gap-3 text-sm">
  //           <div>
  //             <span className="text-muted-foreground text-xs">Libellé:</span>
  //             <p className="font-medium">{tier.libelle}</p>
  //           </div>
  //           <div>
  //             <span className="text-muted-foreground text-xs">N° Tier:</span>
  //             <p className="font-medium font-mono text-xs">{tier.nTier || "N/A"}</p>
  //           </div>
  //           <div>
  //             <span className="text-muted-foreground text-xs">ICE:</span>
  //             <p className="font-mono text-xs">{tier.ice || "N/A"}</p>
  //           </div>
  //           <div>
  //             <span className="text-muted-foreground text-xs">IF:</span>
  //             <p className="font-mono text-xs">{tier.ifNumber || "N/A"}</p>
  //           </div>
  //         </div>

  //         {tier.hasAccountingConfig && (
  //           <div className="pt-2 border-t">
  //             <p className="text-xs text-muted-foreground mb-2">Comptes comptables:</p>
  //             <div className="grid grid-cols-3 gap-2 text-xs">
  //               <div>
  //                 <span className="text-muted-foreground">Frs:</span>
  //                 <p className="font-mono font-medium">{tier.supplierAccount}</p>
  //               </div>
  //               <div>
  //                 <span className="text-muted-foreground">Charge:</span>
  //                 <p className="font-mono font-medium">{tier.defaultChargeAccount || "N/A"}</p>
  //               </div>
  //               <div>
  //                 <span className="text-muted-foreground">TVA:</span>
  //                 <p className="font-mono font-medium">{tier.tvaAccount || "N/A"}</p>
  //               </div>
  //             </div>
  //           </div>
  //         )}

  //         {!tier.hasAccountingConfig && (
  //           <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
  //             Les comptes comptables doivent être configurés manuellement pour ce fournisseur
  //           </p>
  //         )}
  //       </CardContent>
  //     </Card>
  //   )
  // }

  // Fonction pour rendre une carte de champ OCR (avec boutons de sélection)
  const renderFieldCard = (
    field: DynamicInvoiceField | undefined,
    isCustom: boolean = false,
  ) => {
    if (!field) return null;

    const isPending = pendingFields.includes(field.key);
    const hasWarning = warnings.some((w) => w.field === field.key);

    return (
      <Card
        key={field.key}
        className="shadow-sm hover:shadow-md transition-shadow"
      >
        <CardContent className="p-2 space-y-1.5">
          {/* Header avec label et badges */}
          <div className="flex items-center justify-between">
            <Label
              htmlFor={field.key}
              className={`text-sm font-medium flex items-center gap-2 ${isPending ? "text-amber-500" : ""}`}
            >
              {field.label}
              {isCustom && (
                <Badge variant="outline" className="text-xs">
                  Personnalisé
                </Badge>
              )}
              {autoFilledFields?.includes(field.key) && (
                <Badge className="text-[10px] px-1.5 py-0.5 bg-green-500 text-white">
                  <Sparkles className="h-2 w-2 mr-1" />
                  Auto
                </Badge>
              )}
              {field.detected && (
                <CheckCircle className="h-3 w-3 text-green-500" />
              )}
              {isPending && (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              )}
            </Label>

            {/* Boutons d'action */}
            <div className="flex items-center gap-1">
              {isSelectingPosition === field.key ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 px-2 text-[10px] animate-pulse ${
                    selectionMode === "PATTERN"
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  }`}
                  onClick={cancelPositionSelection}
                  title="Annuler la sélection"
                >
                  Annuler
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-blue-50 text-blue-600"
                    onClick={() => startSelection(field.key, "PATTERN")}
                    title="Détecter pattern (ancrage)"
                  >
                    <MousePointer2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-emerald-50 text-emerald-600"
                    onClick={() => startSelection(field.key, "VALUE")}
                    title="Détecter valeur"
                  >
                    <Crosshair className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                    onClick={() => clearFieldValue(field.key)}
                    title="Vider la valeur"
                    disabled={!field.value || String(field.value).trim() === ""}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Badge Pattern */}
          {fieldPatterns[field.key] && (
            <Badge
              variant="outline"
              className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100"
              onClick={() => {
                setFieldPatterns((prev) => {
                  const newPatterns = { ...prev };
                  delete newPatterns[field.key];
                  return newPatterns;
                });
                toast.info("Pattern supprimé");
              }}
              title="Cliquer pour supprimer le pattern"
            >
              Pattern:{" "}
              {fieldPatterns[field.key].length > 20
                ? fieldPatterns[field.key].substring(0, 20) + "..."
                : fieldPatterns[field.key]}{" "}
              ✕
            </Badge>
          )}

          {/* Label descriptif */}
          <p className="text-xs text-muted-foreground font-medium">
            Valeur extraite
          </p>

          {/* Input */}
          <Input
            id={field.key}
            value={String(field.value || "")}
            onChange={(e) => updateFieldValue(field.key, e.target.value)}
            className={`bg-white transition-all ${
              isPending ? "border-amber-500 bg-amber-50/10" : ""
            } ${hasWarning ? "border-red-500" : ""}`}
            disabled={status === "validated"}
            onFocus={() => {
              setFocusedFieldKey(field.key);
            }}
            onBlur={() => {
              setTimeout(() => {
                setFocusedFieldKey(null);
              }, 200);
            }}
          />
        </CardContent>
      </Card>
    );
  };

  // Fonction pour rendre une carte de champ comptable (avec auto-remplissage depuis Tier)
  const renderAccountFieldCard = (
    key: string,
    label: string,
    tierFieldName?: keyof Tier,
  ) => {
    // Récupérer la valeur depuis le Tier si disponible
    const tierValue = tier && tierFieldName ? tier[tierFieldName] : null;

    // LOGIC: No longer merging Collectif + Tier Number here
    let displayValue = tierValue;

    const hasValue =
      displayValue !== null &&
      displayValue !== undefined &&
      displayValue !== "";
    const isAutoFilled = hasValue && tier?.hasAccountingConfig;

    return (
      <Card key={key} className="shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-2 space-y-1.5">
          {/* Header avec label et badges */}
          <div className="flex items-center justify-between">
            <Label
              htmlFor={key}
              className="text-sm font-medium flex items-center gap-2"
            >
              {label}
              <Badge
                variant="outline"
                className="text-xs bg-purple-50 text-purple-700 border-purple-200"
              >
                Comptable
              </Badge>
              {autoFilledFields?.includes(key) && (
                <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white">
                  <Building2 className="h-2 w-2 mr-1" />
                  Tier (Auto)
                </Badge>
              )}
            </Label>
          </div>

          {/* Label descriptif */}
          <p className="text-xs text-muted-foreground font-medium">
            Numéro de compte
          </p>

          {/* Input */}
          <Input
            id={`tier_${key}`} // Prefixé pour identification dans handleMouseUpSelection
            value={displayValue?.toString() || ""}
            onChange={(e) =>
              updateTierField(tierFieldName as keyof Tier, e.target.value)
            }
            className="bg-white"
            placeholder={hasValue ? "" : "Ex: 401000"}
            //disabled={status === "validated" || isAutoFilled}
            onFocus={() => setFocusedFieldKey(`tier_${key}`)}
            onBlur={() => setTimeout(() => setFocusedFieldKey(null), 200)}
          />

          {/* Note explicative */}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">
                Facture #
                {String(
                  fields.find((f) => f.key === "invoiceNumber")?.value ||
                    invoice.filename,
                )}
              </h1>
              {getStatusBadge()}
              {templateDetected ? (
                <Badge
                  variant="outline"
                  className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50"
                >
                  <Target className="h-3 w-3" />
                  Template: {invoice.templateName || "Détecté"}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-muted-foreground border-muted-foreground/20 bg-muted/50"
                >
                  Sans template
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span>Upload: {formatDate(invoice.createdAt)}</span>
              <span>Fichier: {invoice.filename}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Bouton Reprocesser OCR */}
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => handleOcrExtract()}
            disabled={isProcessingOcr}
          >
            {isProcessingOcr ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Reprocesser OCR
              </>
            )}
          </Button>

          {/* Bouton Enregistrer */}
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => {
              const updatedInvoice: DynamicInvoice = {
                ...invoice,
                fields: allFields,
                status,
                pendingFields,
                missingFields,
              };
              onSave(updatedInvoice);
              toast.success("Facture enregistrée");
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enregistrer
              </>
            )}
          </Button>

          {/* Bouton Valider */}
          <Button
            className="gap-2"
            onClick={() => {
              setIsValidating(true);
              const updatedInvoice: DynamicInvoice = {
                ...invoice,
                fields: allFields,
                status: "validated",
                pendingFields: [],
                missingFields: [],
              };
              onSave(updatedInvoice);
              setStatus("validated");
              setIsValidating(false);
              toast.success("Facture validée avec succès");
            }}
            disabled={isValidating || status === "validated"}
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validation...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Valider
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Viewer + Full Text */}
        <div className="space-y-6">
          {/* Document Viewer */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Visualiseur de document
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-transparent"
                    onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground w-12 text-center">
                    {zoom}%
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-transparent"
                    onClick={() => setZoom((z) => Math.min(200, z + 25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  {documentUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-transparent"
                      asChild
                    >
                      <a href={documentUrl} download={invoice.filename}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              {isSelectingPosition && (
                <p className="text-sm text-primary mt-2">
                  {selectionMode === "PATTERN"
                    ? `Sélectionnez la zone du PATTERN (Label) pour "${allFields.find((f) => f.key === isSelectingPosition)?.label}"`
                    : `Sélectionnez la VALEUR pour "${allFields.find((f) => f.key === isSelectingPosition)?.label}"`}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-lg border border-border">
                {isLoadingDocument && (
                  <div className="flex aspect-[3/4] items-center justify-center bg-muted">
                    <div className="text-center">
                      <Loader2 className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
                      <p className="mt-4 text-sm text-muted-foreground">
                        Chargement du document...
                      </p>
                    </div>
                  </div>
                )}

                {!isLoadingDocument && documentError && (
                  <div className="flex aspect-[3/4] items-center justify-center bg-muted">
                    <div className="text-center">
                      <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
                      <p className="mt-4 text-sm text-muted-foreground">
                        {documentError}
                      </p>
                    </div>
                  </div>
                )}

                {!isLoadingDocument && !documentError && documentUrl && (
                  <div
                    ref={imageContainerRef}
                    className={`relative ${
                      isSelectingPosition && selectionMode === "VALUE"
                        ? "cursor-crosshair"
                        : isSelectingPosition
                          ? "cursor-text"
                          : ""
                    } select-text overflow-visible`}
                  >
                    {/* Affichage IMAGE */}
                    {isImage && (
                      <div
                        className="relative origin-top-left transition-all duration-200"
                        style={{ width: `${zoom}%` }}
                      >
                        <img
                          src={documentUrl}
                          alt="Document"
                          className="w-full"
                          draggable={false}
                          onLoad={() => setDocumentRendered(true)}
                          onError={() =>
                            setDocumentError("Impossible de charger l'image")
                          }
                        />
                        {/* Calque de texte transparent pour images pour permettre la sélection */}
                        {allFields
                          .filter((f) => f.position)
                          .map((field) => (
                            <span
                              key={`text-${field.key}`}
                              className="absolute select-text text-transparent outline-none cursor-text transition-colors hover:bg-primary/5"
                              style={{
                                left: `${field.position!.x}%`,
                                top: `${field.position!.y}%`,
                                width: `${field.position!.width}%`,
                                height: `${field.position!.height}%`,
                                zIndex: 2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "transparent",
                                fontSize: "10px",
                              }}
                            >
                              {String(field.value || "")}
                            </span>
                          ))}
                      </div>
                    )}

                    {/* Affichage PDF - UNE SEULE PAGE */}
                    {isPdf && (
                      <div className="relative" style={{ minHeight: "500px" }}>
                        <Document
                          file={pdfFile}
                          onLoadSuccess={({ numPages }) => {
                            console.log(
                              "PDF loaded successfully, pages:",
                              numPages,
                            );
                            setNumPages(numPages);
                            setDocumentRendered(true);
                            setPageNumber((prev) =>
                              prev > numPages ? 1 : prev,
                            );
                          }}
                          onLoadError={(error) => {
                            console.error("Erreur PDF:", error);
                            setDocumentRendered(false);
                            setNumPages(0);
                            setDocumentError(
                              "Impossible de charger le PDF: " +
                                (error.message || "Erreur inconnue"),
                            );
                          }}
                          loading={
                            <div className="flex items-center justify-center h-[600px]">
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                          }
                        >
                          {documentRendered && numPages > 0 && (
                            <Page
                              key={`page-${pageNumber}-${zoom}`}
                              pageNumber={pageNumber}
                              renderTextLayer={true}
                              renderAnnotationLayer={false}
                              scale={zoom / 100}
                              width={
                                imageContainerRef.current?.clientWidth || 800
                              }
                              onLoadError={(error) =>
                                console.error("Page load error:", error)
                              }
                              className="shadow-md"
                            />
                          )}
                        </Document>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation pages PDF - Separated with z-index to avoid overlap */}
              {isPdf && numPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 py-4 border-t border-muted relative z-50 bg-background">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    disabled={pageNumber === 1}
                    className="pointer-events-auto"
                  >
                    Précédent
                  </Button>
                  <span className="text-sm font-medium">
                    Page {pageNumber} / {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPageNumber((p) => Math.min(numPages, p + 1))
                    }
                    disabled={pageNumber === numPages}
                    className="pointer-events-auto"
                  >
                    Suivant
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Extraction Form */}
        <div className="space-y-4">
          {/* Warnings */}
          {warnings.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    {warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {warning.message}
                        </p>
                        {warning.suggestion && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 bg-transparent"
                            onClick={() => applySuggestion(warning)}
                          >
                            <Lightbulb className="h-3 w-3" />
                            Appliquer: {warning.suggestion} DH
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Template Detection Banner */}
          {invoice.templateDetected && invoice.templateName && (
            <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Template détecté
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {invoice.templateName}
                          {invoice.templateVersion &&
                            ` (v${invoice.templateVersion})`}
                        </p>
                      </div>
                      <Badge className="bg-green-600 text-white">
                        {invoice.extractionMethod === "DYNAMIC_TEMPLATE"
                          ? "Extraction Dynamique"
                          : "Patterns"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerte : Fournisseur Non Identifié (Design demandé) */}
          {!invoice.templateDetected && !tier && !isExistingSupplier && (
            <Card className="border-indigo-600/30 bg-indigo-50/50 dark:bg-indigo-950/10 shadow-sm border-2 overflow-hidden">
              <div className="bg-indigo-600 px-4 py-1.5 flex items-center justify-between">
                <p className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Action Requise
                </p>
                <Badge
                  variant="outline"
                  className="text-[9px] border-indigo-400 text-indigo-100 uppercase py-0 px-1.5 font-bold"
                >
                  Nouveau
                </Badge>
              </div>
              <CardContent className="pt-4 pb-5">
                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cette facture provient d'un nouveau fournisseur ou n'est pas
                    encore reliée à un compte tiers.
                  </p>

                  <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-900/50 p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                        ICE détecté 🤖
                      </p>
                      <p className="text-[13px] font-mono font-bold text-slate-900 dark:text-slate-100">
                        {fields.find((f) => f.key === "ice")?.value ||
                          "Non détecté"}
                      </p>
                    </div>
                    <div className="space-y-1 border-l pl-4 border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                        Fournisseur (OCR)
                      </p>
                      <p className="text-[13px] font-bold uppercase text-slate-900 dark:text-slate-100 truncate">
                        {fields.find((f) => f.key === "supplier")?.value ||
                          "Non détecté"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 h-10 font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                      onClick={() => setIsTierModalOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer Nouveau Fournisseur
                    </Button>
                    <Button
                      variant="outline"
                      className="border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex-1 h-10 font-bold transition-all active:scale-95"
                      onClick={() => setIsTierSelectionModalOpen(true)}
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      Lier à l'existant
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Missing Fields Alert */}
          {missingFields.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Champs requis manquants</AlertTitle>
              <AlertDescription>
                Les champs suivants n'ont pas été détectés :{" "}
                {missingFields.join(", ")}
              </AlertDescription>
            </Alert>
          )}

          {/* Tier Information Card */}
          {/* {renderTierCard()} */}

          {/* Main Form */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Formulaire d'extraction
                </CardTitle>
                <div className="flex items-center gap-2"></div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Grid Layout - 2 colonnes */}
              <div className="grid grid-cols-2 gap-4">
                {/* Ligne 1: Date | N° Facture */}
                {renderFieldCard(
                  fields.find((f) => f.key === "invoiceDate") || fields[1],
                )}
                {renderFieldCard(
                  fields.find((f) => f.key === "invoiceNumber") || fields[0],
                )}

                {/* Ligne 2: Fournisseur | Compte Tiers */}
                {renderFieldCard(
                  fields.find((f) => f.key === "supplier") || {
                    ...fields[2],
                    key: "supplier",
                    label: "Fournisseur",
                  },
                )}
                {renderAccountFieldCard(
                  "tierNumber",
                  "Compte Tiers",
                  "tierNumber",
                )}

                {/* Ligne 3: Montant HT | Compte HT */}
                {renderFieldCard(
                  fields.find((f) => f.key === "amountHT") || fields[3],
                )}
                {renderAccountFieldCard(
                  "chargeAccount",
                  "Compte HT",
                  "defaultChargeAccount",
                )}

                {/* Ligne 4: TVA | Compte TVA */}
                {renderFieldCard(
                  fields.find((f) => f.key === "tva") || fields[4],
                )}
                {renderAccountFieldCard(
                  "tvaAccount",
                  "Compte TVA",
                  "tvaAccount",
                )}

                {/* Ligne 5: Montant TTC | ICE */}
                {renderFieldCard(
                  fields.find((f) => f.key === "amountTTC") || fields[5],
                )}
                {renderFieldCard(
                  fields.find((f) => f.key === "ice") || fields[7],
                )}

                {/* Ligne 6: RC | IF */}
                {renderFieldCard(
                  fields.find((f) => f.key === "rcNumber") || fields[8],
                )}
                {renderFieldCard(
                  fields.find((f) => f.key === "ifNumber") || fields[6],
                )}
              </div>
            </CardContent>
          </Card>

          {/* Nouveau: Selection de Signature pour Template Automatique */}
          {canCreateTemplate && !templateDetected && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Créer un Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4 px-4">
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Un ICE ou IF a été détecté. Choisissez la signature pour créer
                  le template automatiquement lors de l'enregistrement.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {fields.find((f) => f.key === "ice")?.value ? (
                    <Button
                      variant={
                        selectedSignature === "ice" ? "default" : "outline"
                      }
                      size="sm"
                      className="text-[10px] h-8 gap-1 p-1"
                      onClick={() =>
                        setSelectedSignature(
                          selectedSignature === "ice" ? null : "ice",
                        )
                      }
                    >
                      ICE:{" "}
                      {String(fields.find((f) => f.key === "ice")?.value).slice(
                        -4,
                      )}
                    </Button>
                  ) : null}
                  {fields.find((f) => f.key === "ifNumber")?.value ? (
                    <Button
                      variant={
                        selectedSignature === "ifNumber" ? "default" : "outline"
                      }
                      size="sm"
                      className="text-[10px] h-8 gap-1 p-1"
                      onClick={() =>
                        setSelectedSignature(
                          selectedSignature === "ifNumber" ? null : "ifNumber",
                        )
                      }
                    >
                      IF:{" "}
                      {String(
                        fields.find((f) => f.key === "ifNumber")?.value,
                      ).slice(-4)}
                    </Button>
                  ) : null}
                </div>
                {selectedSignature && (
                  <p className="text-[10px] text-primary font-medium text-center bg-primary/10 py-1 rounded">
                    ✓ Template auto avec{" "}
                    {selectedSignature === "ifNumber" ? "IF" : "ICE"}
                  </p>
                )}
                <div className="pt-2 border-t border-primary/10">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[11px] text-primary w-full justify-center gap-1"
                    onClick={() => setIsCreatingTemplate(true)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Configuration avancée (Wizard)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {/* BOUTON ENREGISTRER (toujours disponible sauf si validé) */}
            <Button
              variant="outline"
              className="flex-1 gap-2 bg-transparent"
              onClick={handleSave}
              disabled={isSaving || isValidated}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>

            {/*  BOUTON VALIDER (disponible uniquement si READY_TO_VALIDATE) */}
            <Button
              className="flex-1 gap-2"
              onClick={handleValidate}
              disabled={
                isValidating ||
                isValidated ||
                status === "pending" ||
                status === "processing" ||
                status === "treated" // Pas encore enregistré
              }
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validation...
                </>
              ) : isValidated ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Validée
                </>
              ) : status === "ready_to_validate" ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Valider
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Enregistrer d'abord
                </>
              )}
            </Button>
          </div>
          {status === "treated" && (
            <p className="text-sm text-muted-foreground text-center">
              Enregistrez les données avant de pouvoir valider
            </p>
          )}

          {status === "ready_to_validate" && !isValidated && (
            <p className="text-sm text-emerald-600 text-center">
              Facture prête à être validée
            </p>
          )}
        </div>
      </div>

      {/* Wizard Création Template */}
      <DynamicTemplateWizard
        open={isCreatingTemplate}
        onOpenChange={setIsCreatingTemplate}
        invoice={invoice}
        ice={fields.find((f) => f.key === "ice")?.value as string}
        ifNumber={fields.find((f) => f.key === "ifNumber")?.value as string}
        supplier={fields.find((f) => f.key === "supplier")?.value as string}
        onSuccess={(templateId) => {
          setTemplateDetected(true);
          handleOcrExtract(templateId);
          toast.success("Template créé et appliqué !");
        }}
      />
      <TierCreationModal
        isOpen={isTierModalOpen}
        onClose={() => {
          setIsTierModalOpen(false);
          setSelectedTierForUpdate(undefined);
        }}
        onCreated={(newTier) => {
          setIsTierModalOpen(false);
          setSelectedTierForUpdate(undefined);
          handleLinkTier(newTier.id);
        }}
        tierId={selectedTierForUpdate?.id}
        existingTier={selectedTierForUpdate}
        initialData={{
          libelle: String(
            fields.find((f) => f.key === "supplier")?.value || "",
          ),
          ice: String(fields.find((f) => f.key === "ice")?.value || ""),
          ifNumber: String(
            fields.find((f) => f.key === "ifNumber")?.value || "",
          ),
          rcNumber: String(
            fields.find((f) => f.key === "rcNumber")?.value || "",
          ),
        }}
        chargeAccounts={chargeAccounts}
        tvaAccounts={tvaAccounts}
        fournisseurAccounts={fournisseurAccounts}
        isLoadingAccounts={isLoadingAccounts}
      />

      <TierSelectionModal
        isOpen={isTierSelectionModalOpen}
        onClose={() => setIsTierSelectionModalOpen(false)}
        onSelect={handleTierSelect}
        initialSearch={String(
          fields.find((f) => f.key === "supplier")?.value ||
            fields.find((f) => f.key === "ice")?.value ||
            "",
        )}
      />

      {/* MODAL : CRÉATION DE TEMPLATE (CHOIX SIGNATURE) */}
      <CreateTemplateModal
        isOpen={isCreateTemplateModalOpen}
        onClose={() => setIsCreateTemplateModalOpen(false)}
        invoiceId={invoice.id}
        initialSupplierName={String(
          fields.find((f) => f.key === "supplier")?.value || "",
        )}
        onSuccess={(templateId) => {
          setIsCreateTemplateModalOpen(false);
          setTemplateDetected(true);
          handleOcrExtract(templateId);
        }}
      />
    </div>
  );
}
