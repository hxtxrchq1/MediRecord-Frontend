import { useEffect, useState, type FormEvent, useRef } from "react"
import { FileUp, FileText, X, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MedicalDocument } from "@/types/document"
import { validateSelectedFile, formatFileSize } from "@/utils/documents"

interface RegisterDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegister: (
    input: Omit<MedicalDocument, "id" | "uploadedAt" | "status" | "documentHash">,
    file: File
  ) => Promise<any>
  currentUser: { id: string; fullName: string }
}

type FieldErrors = Partial<Record<"name" | "category" | "file" | "description", string>>

const documentCategories = [
  "Consulta",
  "Constancia",
  "Informe",
  "Seguimiento",
  "Verificación",
  "Receta",
  "Resultado de examen",
  "Informe médico",
  "Otro",
]

export function RegisterDocumentDialog({
  open,
  onOpenChange,
  onRegister,
  currentUser,
}: RegisterDocumentDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setSelectedFile(null)
      setName("")
      setCategory("")
      setDescription("")
      setErrors({})
      setIsSubmitting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }, [open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (!file) return

    const validation = validateSelectedFile(file)
    if (!validation.isValid) {
      setErrors((prev) => ({ ...prev, file: validation.error }))
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else {
      setSelectedFile(file)
      setErrors((prev) => ({ ...prev, file: undefined }))
      if (!name) {
        const baseName = file.name.replace(/\.[^/.]+$/, "")
        setName(baseName)
      }
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setErrors((prev) => ({ ...prev, file: undefined }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    const nextErrors: FieldErrors = {}
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()

    if (!selectedFile) {
      nextErrors.file = "Debe seleccionar un archivo PDF."
    }

    if (!trimmedName) {
      nextErrors.name = "El nombre del documento es obligatorio."
    } else if (trimmedName.length < 3 || trimmedName.length > 100) {
      nextErrors.name = "El nombre debe tener entre 3 y 100 caracteres."
    }

    if (!category) {
      nextErrors.category = "Selecciona una categoría."
    }

    if (trimmedDescription && trimmedDescription.length > 500) {
      nextErrors.description = "La descripción no puede superar los 500 caracteres."
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    onRegister(
      {
        name: trimmedName,
        category,
        description: trimmedDescription || "Sin descripción adicional.",
        ownerId: currentUser.id,
        ownerName: currentUser.fullName,
      },
      selectedFile!
    )
      .then(() => {
        onOpenChange(false)
      })
      .catch((err) => {
        setErrors((prev) => ({ ...prev, description: err.message || "Error al registrar" }))
        setIsSubmitting(false)
      })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v) }}>
      <DialogContent className="w-full max-w-sm sm:max-w-md rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Top visual bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-emerald-500" />

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Registrar nuevo documento
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registra y encripta tus metadatos médicos en la blockchain Sepolia.
            </DialogDescription>
          </DialogHeader>

          {/* Secure note */}
          <div className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-950/20 px-3 py-2.5 text-xs text-teal-800 dark:text-teal-400 flex items-start gap-2.5 mb-4">
            <ShieldCheck className="size-4 text-teal-600 shrink-0 mt-0.5" />
            <p>
              El archivo será almacenado de manera encriptada y su hash criptográfico se registrará on-chain.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* File Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Archivo PDF
              </label>
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-5 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 transition"
                >
                  <FileUp className="size-6 text-slate-400 mb-1.5" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Seleccionar o arrastrar PDF</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Formato PDF hasta 10 MB</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-lg bg-teal-50 dark:bg-teal-950/40 p-2 text-teal-600 shrink-0">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={selectedFile.name}>
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
              {errors.file && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.file}</p>
              )}
            </div>

            {/* Document Name */}
            <div className="space-y-1.5">
              <label htmlFor="document-name" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Nombre del documento
              </label>
              <Input
                id="document-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Resumen de atención o Diagnóstico..."
                className="bg-white dark:bg-slate-800 h-9 text-sm"
              />
              {errors.name && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.name}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label htmlFor="document-category" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Categoría
              </label>
              <Select value={category} onValueChange={(val) => { if (val) setCategory(val) }}>
                <SelectTrigger id="document-category" className="w-full bg-white dark:bg-slate-800 h-9 text-sm">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {documentCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.category}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="document-description" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Descripción (Opcional)
              </label>
              <textarea
                id="document-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Detalles sobre el documento..."
                className="flex min-h-[60px] w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-white dark:bg-slate-800 resize-none h-16"
              />
              {errors.description && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1 h-9 text-xs font-semibold" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 h-9 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white" disabled={isSubmitting}>
                {isSubmitting ? "Registrando..." : "Registrar documento"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
