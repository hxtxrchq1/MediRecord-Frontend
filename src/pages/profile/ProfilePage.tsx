import { useState, useMemo, useCallback } from "react"
import { User, Pencil, Check, X, ShieldCheck, Stethoscope, Building2, Lock } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDemoSession } from "@/hooks/use-demo-session"
import { useDemoDocuments } from "@/hooks/use-demo-documents"
import { useDemoPermissions } from "@/hooks/use-demo-permissions"
import { useDemoAccessRecords } from "@/hooks/use-demo-access-records"
import { api } from "@/services/api"
import { abbreviateWalletAddress } from "@/utils/wallet"

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN: { label: "Administrador", color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300", icon: <ShieldCheck className="size-4" /> },
  PATIENT: { label: "Paciente", color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300", icon: <User className="size-4" /> },
  DOCTOR: { label: "Médico", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: <Stethoscope className="size-4" /> },
  CLINIC: { label: "Clínica", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300", icon: <Building2 className="size-4" /> },
  INSURANCE: { label: "Aseguradora", color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300", icon: <Lock className="size-4" /> },
}

export function ProfilePage() {
  const { currentUser, walletState } = useDemoSession()
  const { documents } = useDemoDocuments()
  const { permissions } = useDemoPermissions()
  const { accessRecords } = useDemoAccessRecords()

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // The display name is derived from fullName (which may include "(0x...)" suffix if not custom)
  const displayName = currentUser.fullName

  const role = ROLE_CONFIG[currentUser.role] ?? ROLE_CONFIG.PATIENT
  const shortWallet = walletState.address
    ? abbreviateWalletAddress(walletState.address)
    : "—"

  const stats = useMemo(() => {
    const id = currentUser.id.toLowerCase()
    return {
      ownDocs: documents.filter((d) => d.ownerId.toLowerCase() === id).length,
      ownPerms: permissions.filter((p) => p.patientId.toLowerCase() === id).length,
      activePerms: permissions.filter((p) => p.patientId.toLowerCase() === id && p.status === "ACTIVE").length,
      revokedPerms: permissions.filter((p) => p.patientId.toLowerCase() === id && p.status === "REVOKED").length,
      receivedPerms: permissions.filter((p) => p.authorizedUserId.toLowerCase() === id && p.status === "ACTIVE").length,
      actorAccesses: accessRecords.filter((r) => r.actorId.toLowerCase() === id).length,
    }
  }, [documents, permissions, accessRecords, currentUser.id])

  const handleStartEdit = () => {
    setEditName(displayName)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName("")
  }

  const handleSaveName = useCallback(async () => {
    const trimmed = editName.trim()
    if (trimmed.length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres.")
      return
    }
    setIsSaving(true)
    try {
      await api.updateProfile(trimmed)
      // Force page reload to update currentUser name everywhere
      toast.success("Nombre actualizado correctamente.", {
        description: "Tu nombre de perfil ha sido guardado.",
      })
      setIsEditing(false)
      // Refresh profile
      window.location.reload()
    } catch (err: any) {
      toast.error("No se pudo actualizar el nombre.", {
        description: err.message || "Intenta de nuevo.",
      })
    } finally {
      setIsSaving(false)
    }
  }, [editName])

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-2 sm:px-0">

      {/* ── Header Card ─────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Cover gradient */}
        <div className="h-20 sm:h-28 bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-500" />

        <CardContent className="p-4 sm:p-6 relative pt-10 sm:pt-14">
          {/* Avatar */}
          <div className="absolute -top-9 sm:-top-12 left-4 sm:left-6 flex size-16 sm:size-20 items-center justify-center rounded-2xl border-4 border-white dark:border-slate-900 bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg">
            <User className="size-8 sm:size-10 text-white" />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              {/* Name row */}
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="profile-name-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 text-lg font-bold max-w-xs dark:bg-slate-800"
                    placeholder="Tu nombre completo"
                    maxLength={60}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName()
                      if (e.key === "Escape") handleCancelEdit()
                    }}
                  />
                  <Button
                    id="btn-save-name"
                    size="icon"
                    className="h-9 w-9 bg-teal-600 hover:bg-teal-500 shrink-0"
                    onClick={handleSaveName}
                    disabled={isSaving}
                  >
                    <Check className="size-4 text-white" />
                  </Button>
                  <Button
                    id="btn-cancel-edit-name"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    onClick={handleCancelEdit}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                    {displayName}
                  </h1>
                  <button
                    id="btn-edit-name"
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Pencil className="size-3" />
                    Editar
                  </button>
                </div>
              )}

              {/* Role + wallet */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${role.color}`}>
                  {role.icon}
                  {role.label}
                </span>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{shortWallet}</span>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] py-0">
                  Activo
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {currentUser.role === "PATIENT" && (
          <>
            <StatCard label="Mis documentos" value={stats.ownDocs} color="text-teal-700 dark:text-teal-400" />
            <StatCard label="Autorizaciones" value={stats.ownPerms} color="text-indigo-700 dark:text-indigo-400" />
            <StatCard label="Activas" value={stats.activePerms} color="text-emerald-700 dark:text-emerald-400" />
          </>
        )}
        {currentUser.role === "DOCTOR" && (
          <>
            <StatCard label="Permisos vigentes" value={stats.receivedPerms} color="text-blue-700 dark:text-blue-400" />
            <StatCard label="Consultas registradas" value={stats.actorAccesses} color="text-indigo-700 dark:text-indigo-400" />
          </>
        )}
        {(currentUser.role === "CLINIC" || currentUser.role === "INSURANCE") && (
          <>
            <StatCard label="Permisos recibidos" value={stats.receivedPerms} color="text-orange-700 dark:text-orange-400" />
            <StatCard label="Accesos auditados" value={stats.actorAccesses} color="text-indigo-700 dark:text-indigo-400" />
          </>
        )}
        {currentUser.role === "ADMIN" && (
          <StatCard label="Rol" value="Admin" color="text-purple-700 dark:text-purple-400" />
        )}
      </div>

      {/* ── Technical Details Card ─────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Datos técnicos de la cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
          <TechRow label="Wallet completa" value={walletState.address ?? "—"} mono />
          <TechRow label="Rol en el sistema" value={role.label} />
          <TechRow label="Red blockchain" value="Ethereum Sepolia" />
          <TechRow label="Estado" value="Activo" />
        </CardContent>
      </Card>

      {currentUser.role === "ADMIN" && (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center pb-4">
          Como administrador puedes editar el nombre de cualquier participante desde el panel de participantes.
        </p>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 text-center">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  )
}

function TechRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3">
      <span className="w-full sm:w-44 shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm text-slate-700 dark:text-slate-300 break-all ${mono ? "font-mono" : "font-semibold"}`}>{value}</span>
    </div>
  )
}
