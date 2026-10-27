import { Loader2, CheckCircle2, XCircle, AlertCircle, ShieldAlert, ExternalLink, Copy, Check } from "lucide-react"
import { useState, useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

export type TxStepStatus = "AWAITING_SIGNATURE" | "SUBMITTED" | "CONFIRMING" | "CONFIRMED" | "REJECTED" | "FAILED"

interface TransactionStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionName: string
  status?: TxStepStatus // Opcional para mantener retrocompatibilidad
  txHash?: string | null
  errorMessage?: string | null
  onClose?: () => void
  onConfirmed?: (txRecord: any) => void
  onRejected?: () => void
}

export function TransactionStatusDialog({
  open,
  onOpenChange,
  actionName,
  status: externalStatus,
  txHash: externalTxHash,
  errorMessage: externalErrorMessage,
  onClose,
  onConfirmed,
  onRejected,
}: TransactionStatusDialogProps) {
  const [copied, setCopied] = useState(false)
  
  // Estado local para simulaciones retrocompatibles
  const [internalStatus, setInternalStatus] = useState<TxStepStatus>("AWAITING_SIGNATURE")
  const [internalTxHash, setInternalTxHash] = useState<string | null>(null)
  
  const timerRef1 = useRef<any>(null)
  const timerRef2 = useRef<any>(null)

  const isSimulated = !externalStatus
  const status = externalStatus || internalStatus
  const txHash = externalTxHash || internalTxHash
  const errorMessage = externalErrorMessage

  useEffect(() => {
    if (open && isSimulated) {
      setInternalStatus("AWAITING_SIGNATURE")
      setInternalTxHash(null)
    } else {
      if (timerRef1.current) clearTimeout(timerRef1.current)
      if (timerRef2.current) clearTimeout(timerRef2.current)
    }
  }, [open, isSimulated])

  const handleConfirmSimulation = () => {
    setInternalStatus("SUBMITTED")
    const mockHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
    setInternalTxHash(mockHash)

    timerRef1.current = setTimeout(() => {
      setInternalStatus("CONFIRMING")
      timerRef2.current = setTimeout(() => {
        setInternalStatus("CONFIRMED")
        if (onConfirmed) {
          onConfirmed({
            transactionHash: mockHash,
            blockNumber: Math.floor(Math.random() * 500000) + 9000000,
            gasUsed: "42103",
          })
        }
      }, 1200)
    }, 1200)
  }

  const handleRejectSimulation = () => {
    setInternalStatus("REJECTED")
    if (onRejected) onRejected()
  }

  const handleCopyHash = () => {
    if (!txHash) return
    navigator.clipboard.writeText(txHash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleClose = () => {
    onOpenChange(false)
    if (onClose) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (status === "SUBMITTED" || status === "CONFIRMING") {
        return
      }
      onOpenChange(val)
      if (!val && onClose) onClose()
    }}>
      <DialogContent className="w-full max-w-sm sm:max-w-md rounded-3xl p-0 overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        
        <div className={`h-1.5 w-full transition-colors duration-500 ${
          status === "CONFIRMED" ? "bg-emerald-500" :
          status === "REJECTED" || status === "FAILED" ? "bg-rose-500" :
          "bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500 animate-pulse"
        }`} />

        <div className="px-6 py-6 sm:p-8 space-y-6">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-bold text-slate-950 dark:text-white mx-auto">
              Procesando: {actionName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mx-auto max-w-xs">
              {isSimulated 
                ? "Trazabilidad técnica de la firma digital de demostración."
                : "Pasarela de verificación y auditoría en la red Ethereum Sepolia."}
            </DialogDescription>
          </DialogHeader>

          {/* ── 1. AWAITING SIGNATURE ── */}
          {status === "AWAITING_SIGNATURE" && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-600 animate-bounce">
                <ShieldAlert className="size-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Firma requerida en MetaMask</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {isSimulated 
                    ? "En la integración final, MetaMask solicitará tu firma digital para autorizar la transacción en Sepolia."
                    : "Abre tu extensión de MetaMask y confirma la transacción para registrar esta operación on-chain."}
                </p>
              </div>

              {isSimulated && (
                <div className="flex gap-2 justify-center pt-2">
                  <Button variant="outline" size="sm" className="rounded-xl text-xs h-8" onClick={handleRejectSimulation}>
                    Rechazar simulación
                  </Button>
                  <Button size="sm" className="rounded-xl text-xs h-8 bg-teal-600 hover:bg-teal-500 text-white" onClick={handleConfirmSimulation}>
                    Confirmar simulación
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── 2. SUBMITTED & CONFIRMING ── */}
          {(status === "SUBMITTED" || status === "CONFIRMING") && (
            <div className="space-y-5 text-center py-2">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                <Loader2 className="size-10 text-teal-600 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {status === "SUBMITTED" ? "Transacción Enviada" : "Confirmando bloque en Sepolia..."}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {status === "SUBMITTED" 
                    ? "Esperando la inclusión en la blockchain..." 
                    : "Validando y auditando la transacción con los nodos de la red..."}
                </p>
              </div>

              {txHash && (
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tx Hash</span>
                    <p className="font-mono text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {txHash.slice(0, 8)}...{txHash.slice(-8)}
                    </p>
                  </div>
                  <button 
                    onClick={handleCopyHash} 
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition shrink-0 ml-2"
                    title="Copiar hash completo"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-slate-400" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 3. CONFIRMED ── */}
          {status === "CONFIRMED" && (
            <div className="space-y-5">
              <div className="text-center py-2 space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-600">
                  <CheckCircle2 className="size-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">¡Transacción Exitosa!</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">La operación se ha verificado e inscrito correctamente.</p>
                </div>
              </div>

              {txHash && (
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Estado</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                      {isSimulated ? "Simulado" : "Verificado"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Hash de auditoría</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-600 dark:text-slate-300">{txHash.slice(0, 8)}...{txHash.slice(-8)}</span>
                      <button onClick={handleCopyHash} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition">
                        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                {txHash && !isSimulated && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition"
                  >
                    Ver en Sepolia Etherscan
                    <ExternalLink className="size-3" />
                  </a>
                )}
                <Button size="sm" className="h-9 w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold" onClick={handleClose}>
                  Finalizar
                </Button>
              </div>
            </div>
          )}

          {/* ── 4. REJECTED ── */}
          {status === "REJECTED" && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600">
                <XCircle className="size-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Firma Cancelada</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Rechazaste firmar la transacción en tu wallet. No se realizaron cambios on-chain.
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" className="h-9 w-full rounded-xl text-xs font-semibold" onClick={handleClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}

          {/* ── 5. FAILED ── */}
          {status === "FAILED" && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600">
                <AlertCircle className="size-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Transacción Fallida</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {errorMessage || "La blockchain revirtió la ejecución. Verifica si cuentas con suficientes fondos (ETH Sepolia) o los permisos adecuados."}
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" className="h-9 w-full rounded-xl text-xs font-semibold" onClick={handleClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
