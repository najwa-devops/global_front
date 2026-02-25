"use client";

import type React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  Save,
  Target,
  X,
  Loader2,
  CheckCircle,
  ZoomIn,
  ZoomOut,
  Download,
  AlertTriangle,
  RefreshCw,
  Eye,
} from "lucide-react";
import type {
  BankStatementV2,
  BankTransactionV2,
  LocalBankStatement,
  BankStatementField,
} from "@/lib/types";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { BankTransactionTable } from "./bank-statement-table";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface OcrProcessingBankPageProps {
  statement: LocalBankStatement;
  file: File | null;
  onBack: () => void;
  onSave: (statement: LocalBankStatement) => void;
}

export function OcrProcessingBankPage({
  statement,
  file,
  onBack,
  onSave,
}: OcrProcessingBankPageProps) {
  const [fields, setFields] = useState<BankStatementField[]>(statement.fields);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [documentRendered, setDocumentRendered] = useState(false);
  const [isSelectingPosition, setIsSelectingPosition] = useState<string | null>(
    null,
  );
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);

  const isPdf = statement.filename.match(/\.pdf$/i);
  const isImage = statement.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const pdfFile = useMemo(() => {
    if (!documentUrl) return null;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const isRemoteHttp = /^https?:\/\//i.test(documentUrl);
    if (isRemoteHttp) {
      return {
        url: documentUrl,
        withCredentials: true,
        ...(token
          ? { httpHeaders: { Authorization: `Bearer ${token}` } }
          : {}),
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
    if (file) {
      const url = URL.createObjectURL(file);
      setDocumentUrl(url);
      setIsLoadingDocument(false);
    } else if (statement.fileUrl) {
      setDocumentUrl(statement.fileUrl);
      setIsLoadingDocument(false);
    }
  }, [file, statement.fileUrl]);

  const handleOcrExtract = async () => {
    setIsProcessingOcr(true);
    toast.loading("Traitement OCR du relevé en cours...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.dismiss();
      toast.success("Données extraites avec succès");
    } catch (error) {
      toast.dismiss();
      toast.error("Erreur lors de l'extraction");
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const updateFieldValue = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedStatement = {
        ...statement,
        fields,
        status: "validated" as const,
      };
      onSave(updatedStatement);
      toast.success("Relevé bancaire enregistré");
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const startSelection = (key: string) => {
    setIsSelectingPosition(key);
    setSelectedFieldKey(key);
    toast.info("Sélectionnez la zone dans le document");
  };

  const cancelPositionSelection = () => {
    setIsSelectingPosition(null);
    setSelectedFieldKey(null);
  };

  const clearFieldValue = (key: string) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: "" } : f)),
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Relevé Bancaire: {statement.filename}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span>Date: {formatDate(statement.createdAt)}</span>
              <span>
                Statut:{" "}
                {statement.status === "validated" ? "Validé" : "À traiter"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 bg-transparent border-primary/20 hover:bg-primary/5"
              >
                <Eye className="h-4 w-4" />
                Inspecter Texte OCR
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[50vw] sm:max-w-[50vw] w-full max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Inspection du Texte Extrait par OCR</DialogTitle>
              </DialogHeader>
              <Tabs
                defaultValue="cleaned"
                className="flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="mb-4">
                  <TabsTrigger value="cleaned">Texte Nettoyé</TabsTrigger>
                  <TabsTrigger value="raw">Texte Brut (Raw)</TabsTrigger>
                </TabsList>
                <TabsContent value="cleaned" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[60vh] w-full rounded-md border p-4 bg-muted/20">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {statement.cleanedOcrText ||
                        "Aucun texte nettoyé disponible."}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="raw" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[60vh] w-full rounded-md border p-4 bg-muted/20">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {statement.rawOcrText || "Aucun texte brut disponible."}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={handleOcrExtract}
            disabled={isProcessingOcr}
          >
            <RefreshCw
              className={`h-4 w-4 ${isProcessingOcr ? "animate-spin" : ""}`}
            />
            Reprocesser OCR
          </Button>
          <Button className="gap-2" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Valider le relevé
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        {/* Document view */}
        <Card className="h-[calc(100vh-200px)] overflow-hidden flex flex-col">
          <CardHeader className="py-3 px-4 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Document</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs w-8 text-center">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.min(200, z + 25))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4 bg-muted/30">
            <div
              ref={imageContainerRef}
              className="relative inline-block origin-top-left"
              style={{ transform: `scale(${zoom / 100}%)` }}
            >
              {isLoadingDocument && (
                <div className="flex h-96 w-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {documentUrl && isPdf && (
                <Document
                  file={pdfFile}
                  onLoadSuccess={({ numPages }) => {
                    setNumPages(numPages);
                    setDocumentRendered(true);
                    setIsLoadingDocument(false);
                  }}
                >
                  <Page pageNumber={pageNumber} width={600} />
                </Document>
              )}
              {documentUrl && isImage && (
                <img
                  src={documentUrl}
                  alt="Document"
                  className="max-w-full"
                  onLoad={() => setIsLoadingDocument(false)}
                />
              )}
            </div>
          </CardContent>
          {numPages > 1 && (
            <div className="p-2 border-t flex items-center justify-center gap-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber === 1}
              >
                Précédent
              </Button>
              <span className="text-xs">
                Page {pageNumber} sur {numPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber === numPages}
              >
                Suivant
              </Button>
            </div>
          )}
        </Card>

        {/* Fields form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Données extraites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={field.key} className="text-xs font-medium">
                      {field.label}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-[10px] ${isSelectingPosition === field.key ? "text-primary bg-primary/10" : ""}`}
                        onClick={() => startSelection(field.key)}
                      >
                        <Target className="h-3 w-3 mr-1" />
                        Pointer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                        onClick={() => clearFieldValue(field.key)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    id={field.key}
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "date"
                          ? "date"
                          : "text"
                    }
                    value={String(field.value || "")}
                    onChange={(e) =>
                      updateFieldValue(field.key, e.target.value)
                    }
                    className={
                      selectedFieldKey === field.key
                        ? "ring-2 ring-primary border-primary"
                        : ""
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Conseil</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vérifiez attentivement les dates et les montants avant de
                    valider le relevé pour assurer une comptabilité précise.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
