"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X } from "lucide-react"
import { type DynamicInvoice, DEFAULT_FIELDS } from "@/lib/types"

interface AddInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileAdded: (file: File) => void
  onViewInvoice: (invoice: DynamicInvoice, file: File) => void
}

export function AddInvoiceDialog({ open, onOpenChange, onFileAdded, onViewInvoice }: AddInvoiceDialogProps) {
  const [files, setFiles] = useState<File[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    maxSize: 10 * 1024 * 1024,
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddFiles = () => {
    files.forEach((file) => {
      onFileAdded(file)
    })
    setFiles([])
    onOpenChange(false)
  }

  const handleViewAndProcess = (file: File) => {
    const tempInvoice: DynamicInvoice = {
      id: Date.now(),
      filename: file.name,
      fileUrl: URL.createObjectURL(file),
      fields: DEFAULT_FIELDS.map((f) => ({ ...f })),
      fileSize: file.size,
      status: "pending",
      filePath: "",
      isProcessing: false,
      createdAt: new Date(),
    }
    onViewInvoice(tempInvoice, file)
    setFiles([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter des factures</DialogTitle>
          <DialogDescription>Telechargez une ou plusieurs factures au format PDF ou image.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-muted/50"
              }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              {isDragActive ? (
                <p className="font-medium text-primary">Deposez les fichiers ici...</p>
              ) : (
                <>
                  <p className="font-medium">Glissez-deposez vos fichiers</p>
                  <p className="text-sm text-muted-foreground">ou cliquez pour selectionner</p>
                  <p className="text-xs text-muted-foreground">PDF, PNG, JPG jusqu'a 10MB</p>
                </>
              )}
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {files.length} fichier{files.length > 1 ? "s" : ""} selectionne
                {files.length > 1 ? "s" : ""}
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAndProcess(file)}
                        className="h-7 text-xs"
                      >
                        Traiter
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddFiles} disabled={files.length === 0}>
              Ajouter {files.length > 0 ? `(${files.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
