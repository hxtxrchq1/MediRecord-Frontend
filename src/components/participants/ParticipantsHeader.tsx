import { RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ParticipantsHeaderProps {
  onRegister: () => void
  onRefresh: () => void
  isRefreshing?: boolean
}

export function ParticipantsHeader({ onRegister, onRefresh, isRefreshing }: ParticipantsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
            Administración
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Participantes</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Consulta y gestiona los usuarios registrados en el sistema. Puedes registrar nuevos participantes y actualizar su información.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 sm:items-center">
        <Button
          id="btn-refresh-participants"
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Actualizando…" : "Actualizar lista"}
        </Button>
        <Button
          id="btn-register-participant"
          type="button"
          onClick={onRegister}
          size="sm"
        >
          + Registrar participante
        </Button>
      </div>
    </div>
  )
}
