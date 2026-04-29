"use client";

import type React from "react";
import { useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  CloudUpload,
  Sparkles,
} from "lucide-react";
import type { DynamicInvoice } from "@/lib/types";

interface UploadPageProps {
  onUpload: (
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void,
  ) => Promise<
    | void
    | {
        failed?: Array<{ fileIndex: number; error?: string }>;
      }
  >;
  onViewInvoice: (invoice: DynamicInvoice, file: File) => void;
  isDemoMode?: boolean;
  uploadOptions?: React.ReactNode;
  headerActions?:
    | React.ReactNode
    | ((controls: {
        openFilePicker: () => void;
        uploadFiles: () => Promise<void>;
        pendingCount: number;
        isUploading: boolean;
      }) => React.ReactNode);
}

interface FileItem {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export function UploadPage({
  onUpload,
  onViewInvoice,
  isDemoMode,
  uploadOptions,
  headerActions,
}: UploadPageProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const acceptedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];
  const maxFileSize = 10 * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return "Format non supporte. Utilisez PDF, JPG, JPEG ou PNG.";
    }
    if (file.size > maxFileSize) {
      return "Fichier trop volumineux. Maximum 10 Mo.";
    }
    return null;
  };

  const createFileItems = useCallback((newFiles: FileList | File[]): FileItem[] => {
    const fileArray = Array.from(newFiles);
    return fileArray.map((file) => {
      const error = validateFile(file);
      return {
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        status: error ? "error" : "pending",
        progress: 0,
        error: error || undefined,
      };
    });
  }, []);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const newFileItems = createFileItems(newFiles);
      setFiles((prev) => [...prev, ...newFileItems]);
    },
    [createFileItems],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const uploadPendingFileItems = useCallback(
    async (pendingFileItems: FileItem[]) => {
      if (pendingFileItems.length === 0) return;

      setIsUploading(true);

      try {
        // Create a map of file IDs to their index in the pending list
        const fileIndexMap = new Map<string, number>();
        pendingFileItems.forEach((item, index) => {
          fileIndexMap.set(item.id, index);
        });

        // Progress callback
        const handleProgress = (fileIndex: number, progress: number) => {
          const fileId = pendingFileItems[fileIndex]?.id;
          if (fileId) {
            setFiles((prev) =>
              prev.map((file) =>
                file.id === fileId ? { ...file, progress } : file,
              ),
            );
          }
        };

        // Extract files array
        const filesToUpload = pendingFileItems.map((item) => item.file);

        try {
          // Set all to uploading state
          setFiles((prev) =>
            prev.map((file) =>
              fileIndexMap.has(file.id)
                ? {
                    ...file,
                    status: "uploading",
                    progress: 0,
                    error: undefined,
                  }
                : file,
            ),
          );

          // Upload with progress callback
          const uploadResult = await onUpload(filesToUpload, handleProgress);
          const failedItems = (uploadResult?.failed || []).filter(
            (item) =>
              item &&
              Number.isInteger(item.fileIndex) &&
              item.fileIndex >= 0 &&
              item.fileIndex < pendingFileItems.length,
          );

          if (failedItems.length === 0) {
            // All uploads succeeded - remove them immediately
            setFiles((prev) => prev.filter((file) => !fileIndexMap.has(file.id)));
          } else {
            const failedById = new Map<string, string | undefined>();
            for (const failure of failedItems) {
              const fileId = pendingFileItems[failure.fileIndex]?.id;
              if (fileId) {
                failedById.set(
                  fileId,
                  failure.error || "Erreur lors de l'upload",
                );
              }
            }

            setFiles((prev) =>
              prev
                .filter((file) => {
                  if (!fileIndexMap.has(file.id)) return true;
                  return failedById.has(file.id);
                })
                .map((file) =>
                  failedById.has(file.id)
                    ? {
                        ...file,
                        status: "error",
                        error: failedById.get(file.id),
                        progress: 0,
                      }
                    : file,
                ),
            );
          }
        } catch (err) {
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Erreur lors de l'upload";
          // Mark the failed file(s) as error
          setFiles((prev) =>
            prev.map((file) =>
              fileIndexMap.has(file.id) && file.status === "uploading"
                ? {
                    ...file,
                    status: "error",
                    error: message,
                    progress: 0,
                  }
                : file,
            ),
          );
        }
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    const validFiles = files.filter((f) => f.status === "pending");
    await uploadPendingFileItems(validFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  const isImage = (type: string) => type.startsWith("image/");
  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 glow-sm">
                  <CloudUpload className="h-5 w-5 text-primary" />
                </div>
                Uploader des factures
              </CardTitle>
              <CardDescription>
                Glissez-deposez vos factures ou cliquez pour selectionner des
                fichiers
              </CardDescription>
            </div>
            {headerActions ? (
              <div className="lg:max-w-sm lg:min-w-[320px]">
                {typeof headerActions === "function"
                  ? headerActions({
                      openFilePicker,
                      uploadFiles: handleUpload,
                      pendingCount,
                      isUploading,
                    })
                  : headerActions}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {uploadOptions ? <div className="mb-6">{uploadOptions}</div> : null}

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300 ${
              isDragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/50 hover:border-primary/50 hover:bg-accent/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-300 ${
                  isDragOver ? "bg-primary/20 scale-110" : "bg-primary/10"
                }`}
              >
                <Upload
                  className={`h-10 w-10 transition-all duration-300 ${isDragOver ? "text-primary scale-110" : "text-primary"}`}
                />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  Glissez vos factures ici
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ou{" "}
                  <span className="text-primary font-medium">
                    cliquez pour selectionner
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
                  JPG, PNG
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
                  Max 10 Mo
                </span>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Fichiers selectionnes ({files.length})
                </h4>
              </div>
              <div className="space-y-3">
                {files.map((fileItem, index) => (
                  <div
                    key={fileItem.id}
                    className="flex items-center gap-4 rounded-xl border border-border/50 bg-accent/30 p-4 animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/50 overflow-hidden">
                      {isImage(fileItem.file.type) ? (
                        <img
                          src={
                            URL.createObjectURL(fileItem.file) ||
                            "/placeholder.svg"
                          }
                          alt={fileItem.file.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {fileItem.file.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                        <span>{formatFileSize(fileItem.file.size)}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                        <span className="uppercase">
                          {fileItem.file.type.split("/")[1]}
                        </span>
                      </div>
                      {fileItem.status === "uploading" && (
                        <div className="mt-2 flex items-center gap-2">
                          <Progress
                            value={fileItem.progress}
                            className="h-1.5 flex-1"
                          />
                          <span className="text-xs font-medium text-muted-foreground tabular-nums">
                            {fileItem.progress}%
                          </span>
                        </div>
                      )}
                      {fileItem.error && (
                        <p className="mt-1 text-sm text-destructive">
                          {fileItem.error}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {fileItem.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(fileItem.id)}
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {fileItem.status === "uploading" && (
                        <div className="h-9 w-9 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                      {fileItem.status === "success" && (
                        <div className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-400/10">
                          <CheckCircle className="h-5 w-5 text-emerald-400" />
                        </div>
                      )}
                      {fileItem.status === "error" && (
                        <div className="h-9 w-9 flex items-center justify-center rounded-full bg-destructive/10">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={() => setFiles([])}
                  disabled={isUploading}
                  className="bg-transparent border-border/50"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={pendingCount === 0 || isUploading}
                  className="gap-2 glow-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Uploader ({pendingCount})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
