import { useState, useCallback } from "react"
import { Check, Copy, Pencil, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RoleBadge } from "@/components/common/RoleBadge"
import type { User, UserRole } from "@/types/user"
import { abbreviateWalletAddress } from "@/utils/wallet"
import {
  getParticipantScopeDescription,
  getParticipantStatusClassName,
  getParticipantStatusLabel,
} from "@/utils/participants"
import { api } from "@/services/api"
import { useDemoParticipants } from "@/hooks/use-demo-participants"

interface ParticipantDetailsDialogProps {
  participant: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "PATIENT", label: "Paciente" },
  { value: "DOCTOR", label: "Médico" },
  { value: "CLINIC", label: "Clínica" },
  { value: "INSURANCE", label: "Aseguradora" },
]

export function ParticipantDetailsDialog({ participant, open, onOpenChange }: ParticipantDetailsDialogProps) {
  const { refreshParticipants } = useDemoParticipants()

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editRole, setEditRole] = useState<UserRole>("PATIENT")
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // All callbacks defined unconditionally before any early return
  const handleStartEdit = useCallback(() => {
    if (!participant) return
    setEditName(participant.fullName)
    setEditRole(participant.role)
    setIsEditing(true)
  }, [participant])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleCopyWallet = useCallback(() => {
    if (!participant) return
    navigator.clipboard.writeText(participant.walletAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [participant])

  const handleSave = useCallback(async () => {
    if (!participant) return
    const trimmedName = editName.trim()
    if (trimmedName.length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres.")
      return
    }
    setIsSaving(true)
    try {
      await api.updateUserName(participant.walletAddress, trimmedName)
      toast.success("Participante actualizado correctamente.")
      setIsEditing(false)
      await refreshParticipants()
      onOpenChange(false)
    } catch (err: any) {
      toast.error("No se pudo actualizar el participante.", {
        description: err.message || "Intenta de nuevo.",
      })
    } finally {
      setIsSaving(false)
    }
  }, [editName, participant, refreshParticipants, onOpenChange])

  // Early return AFTER all hooks
  if (!participant) return null

  const shortWallet = abbreviateWalletAddress(participant.walletAddress)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setIsEditing(false); onOpenChange(v) }}>
      <DialogContent className="w-full max-w-sm sm:max-w-md rounded-2xl p-0 overflow-hidden">

        {/* Color accent top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-emerald-500" />

        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Detalle del participante
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {isEditing ? "Edita los datos del participante. La wallet no puede modificarse." : "Revisa y edita la información del usuario registrado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">

            {/* Wallet row — always read-only */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                Wallet (no editable)
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-600 dark:text-slate-300 truncate flex-1">
                  {shortWallet}
                </span>
                <button
                  onClick={handleCopyWallet}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="Copiar wallet completa"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>
              <p className="mt-1 font-mono text-[10px] text-slate-400 break-all leading-relaxed">
                {participant.walletAddress}
              </p>
            </div>

            {/* Editable fields */}
            {isEditing ? (
              <div className="space-y-3">
                {/* Name input */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 block mb-1.5">
                    Nombre o razón social
                  </label>
                  <Input
                    id="participant-edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre del participante"
                    maxLength={60}
                    className="h-9 text-sm dark:bg-slate-800"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave()
                      if (e.key === "Escape") handleCancel()
                    }}
                  />
                </div>

                {/* Role selector */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 block mb-1.5">
                    Rol
                  </label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                    <SelectTrigger className="h-9 text-sm dark:bg-slate-800" id="participant-edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                    ⚠️ Cambiar el rol requiere una transacción en la blockchain.
                  </p>
                </div>
              </div>
            ) : (
              /* Read-only info grid */
              <div className="grid grid-cols-2 gap-3">
                <InfoCell label="Nombre" value={participant.fullName} truncate />
                <InfoCell
                  label="Rol"
                  value={<RoleBadge role={participant.role} />}
                />
                <InfoCell
                  label="Estado"
                  value={
                    <Badge variant="outline" className={`text-xs ${getParticipantStatusClassName(participant.status)}`}>
                      {getParticipantStatusLabel(participant.status)}
                    </Badge>
                  }
                />
              </div>
            )}

            {/* Scope description */}
            {!isEditing && (
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Alcance del rol</p>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {getParticipantScopeDescription(participant.role)}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {isEditing ? (
                <>
                  <Button
                    id="btn-save-participant"
                    size="sm"
                    className="flex-1 h-9 bg-teal-600 hover:bg-teal-500 text-white text-sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    <Check className="size-4 mr-1.5" />
                    {isSaving ? "Guardando…" : "Guardar cambios"}
                  </Button>
                  <Button
                    id="btn-cancel-participant-edit"
                    size="sm"
                    variant="outline"
                    className="h-9 px-4"
                    onClick={handleCancel}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    id="btn-edit-participant"
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9 text-sm"
                    onClick={handleStartEdit}
                  >
                    <Pencil className="size-3.5 mr-1.5" />
                    Editar información
                  </Button>
                  <Button
                    id="btn-close-participant-dialog"
                    size="sm"
                    variant="ghost"
                    className="h-9 px-4 text-sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Cerrar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoCell({
  label,
  value,
  truncate = false,
}: {
  label: string
  value: React.ReactNode
  truncate?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      {typeof value === "string" ? (
        <p className={`text-sm font-semibold text-slate-700 dark:text-slate-300 ${truncate ? "truncate" : ""}`} title={truncate ? value : undefined}>
          {value}
        </p>
      ) : (
        <div className="mt-0.5">{value}</div>
      )}
    </div>
  )
}
