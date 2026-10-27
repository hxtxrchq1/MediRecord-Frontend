import { useCallback, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Wallet,
  Wifi,
  UserCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDemoSession } from "@/hooks/use-demo-session"
import { cn } from "@/lib/utils"

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  PATIENT: "Paciente",
  DOCTOR: "Médico",
  CLINIC: "Clínica",
  INSURANCE: "Aseguradora",
}

const errorMessages: Record<string, { title: string; body: string }> = {
  METAMASK_NOT_INSTALLED: {
    title: "MetaMask no encontrada",
    body: "Instala la extensión de MetaMask en tu navegador para continuar.",
  },
  WRONG_NETWORK: {
    title: "Red incorrecta",
    body: "Tu wallet está en una red diferente. Cámbia a la red Ethereum Sepolia.",
  },
  UNREGISTERED_USER: {
    title: "Cuenta no registrada",
    body: "Esta wallet no está registrada en el sistema MediRecord. Contacta al administrador.",
  },
  CONNECTION_REJECTED: {
    title: "Conexión rechazada",
    body: "Rechazaste la solicitud en MetaMask. Inténtalo de nuevo cuando estés listo.",
  },
  UNKNOWN_ERROR: {
    title: "Error inesperado",
    body: "Ocurrió un problema durante la conexión. Intenta nuevamente.",
  },
}

export function ConnectPage() {
  const navigate = useNavigate()
  const { currentUser, walletState, isConnected, connectDemoUser } = useDemoSession()
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = useCallback(async () => {
    if (isConnecting || isConnected) return
    setIsConnecting(true)
    try {
      await connectDemoUser(currentUser.id)
    } finally {
      setIsConnecting(false)
    }
  }, [connectDemoUser, currentUser.id, isConnecting, isConnected])

  const handleContinue = useCallback(() => {
    if (isConnected) navigate("/app/dashboard")
  }, [isConnected, navigate])

  const shortAddress = walletState.address
    ? `${walletState.address.slice(0, 6)}...${walletState.address.slice(-4)}`
    : null

  const errorInfo = walletState.errorMessage
    ? errorMessages[walletState.errorMessage] ?? errorMessages.UNKNOWN_ERROR
    : null

  const detectedRole = roleLabels[currentUser.role] ?? currentUser.role

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-br from-slate-50 via-white to-teal-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20">

      {/* Logo pill */}
      <Link to="/" className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm hover:shadow transition">
        <ShieldCheck className="size-4 text-teal-600" />
        MediRecord
      </Link>

      {/* Main card */}
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 shadow-2xl shadow-slate-200/60 dark:shadow-slate-950/60 backdrop-blur-sm overflow-hidden">

          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500" />

          <div className="px-8 pt-8 pb-6 space-y-6">

            {/* Header */}
            <div className="space-y-2 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/30">
                <Wallet className="size-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {isConnected ? "Bienvenido de vuelta" : "Conecta tu wallet"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {isConnected
                  ? "Tu cuenta está verificada y lista para usar."
                  : "Usa MetaMask para identificarte de forma segura en la red Sepolia."}
              </p>
            </div>

            {/* Status pills */}
            <div className="grid grid-cols-3 gap-2">
              <StatusPill
                icon={<Wallet className="size-3.5" />}
                label="Wallet"
                active={isConnected || isConnecting}
              />
              <StatusPill
                icon={<Wifi className="size-3.5" />}
                label="Red Sepolia"
                active={isConnected}
              />
              <StatusPill
                icon={<UserCheck className="size-3.5" />}
                label="Rol verificado"
                active={isConnected}
              />
            </div>

            {/* Connected state — info box */}
            {isConnected && (
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span className="text-sm font-semibold">Cuenta verificada en blockchain</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <InfoRow label="Wallet" value={shortAddress ?? "—"} />
                  <InfoRow label="Rol" value={detectedRole} />
                  <InfoRow label="Red" value="Ethereum Sepolia" />
                  <InfoRow label="Estado" value="Activo" />
                </div>
              </div>
            )}

            {/* Error message */}
            {errorInfo && !isConnected && (
              <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 flex gap-3">
                <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">{errorInfo.title}</p>
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-500 leading-relaxed">{errorInfo.body}</p>
                </div>
              </div>
            )}

            {/* Idle state hint */}
            {!isConnected && !errorInfo && (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Al conectar, MetaMask te pedirá firmar un mensaje de verificación.<br />
                  <span className="font-medium text-slate-700 dark:text-slate-300">No se realizará ninguna transacción.</span>
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3 pt-1">
              {!isConnected ? (
                <Button
                  id="btn-connect-metamask"
                  size="lg"
                  className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-lg shadow-teal-500/25 border-0 transition-all duration-200"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Conectando con MetaMask…
                    </>
                  ) : (
                    <>
                      <Wallet className="size-4 mr-2" />
                      Conectar con MetaMask
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  id="btn-continue-dashboard"
                  size="lg"
                  className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-lg shadow-teal-500/25 border-0 transition-all duration-200"
                  onClick={handleContinue}
                >
                  Entrar al panel
                  <ArrowRight className="size-4 ml-2" />
                </Button>
              )}

              <Link
                to="/"
                className="flex items-center justify-center gap-1.5 w-full h-10 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Volver al inicio
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Footer note */}
          <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="text-xs text-center text-slate-400 dark:text-slate-500">
              Seguridad garantizada por la red Ethereum Sepolia · MediRecord {new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* Steps below card */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {[
            { n: "1", label: "Abre MetaMask" },
            { n: "2", label: "Firma el mensaje" },
            { n: "3", label: "Accede al panel" },
          ].map((step) => (
            <div key={step.n} className="space-y-2">
              <div className="mx-auto size-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                {step.n}
              </div>
              <p>{step.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusPill({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-center transition-all duration-300",
        active
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50",
      )}
    >
      <div
        className={cn(
          "mx-auto mb-1 flex size-6 items-center justify-center rounded-full",
          active
            ? "bg-emerald-500 text-white"
            : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500",
        )}
      >
        {icon}
      </div>
      <p
        className={cn(
          "text-[10px] font-semibold leading-tight",
          active ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500",
        )}
      >
        {label}
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">{label}</p>
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{value}</p>
    </div>
  )
}
