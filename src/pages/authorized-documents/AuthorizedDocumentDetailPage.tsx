import { useMemo, useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, AlertTriangle, EyeOff, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useDemoSession } from "@/hooks/use-demo-session"
import { useDemoPermissions } from "@/hooks/use-demo-permissions"
import { useDemoDocuments } from "@/hooks/use-demo-documents"
import { useDemoAccessRecords } from "@/hooks/use-demo-access-records"
import { useDemoTransactions } from "@/hooks/use-demo-transactions"
import { getEffectivePermissionStatus } from "@/utils/permissions"
import { getActionTypeByRole, getActionLabel } from "@/utils/access-records"
import { formatLongDate } from "@/utils/dashboard"
import { TransactionStatusDialog, type TxStepStatus } from "@/components/transactions/TransactionStatusDialog"
import { getToken } from "@/services/api"

export function AuthorizedDocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const { currentUser } = useDemoSession()
  const { permissions } = useDemoPermissions()
  const { documents } = useDemoDocuments()
  const { accessRecords, registerAccess } = useDemoAccessRecords()
  const { registerTransaction } = useDemoTransactions()

  const [isTxOpen, setIsTxOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<TxStepStatus>("AWAITING_SIGNATURE")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [hasRegisteredAccess, setHasRegisteredAccess] = useState(false)

  // Find all permissions received by the current user for this document
  const relatedPermissions = useMemo(() => {
    if (!documentId) return []
    return permissions.filter(
      (p) => p.documentId === documentId && p.authorizedUserId.toLowerCase() === currentUser.id.toLowerCase(),
    )
  }, [documentId, permissions, currentUser.id])

  // Get active permission if it exists
  const activePermission = useMemo(() => {
    return relatedPermissions.find((p) => getEffectivePermissionStatus(p) === "ACTIVE") || null
  }, [relatedPermissions])

  // Get expired or revoked permission for status display if no active one exists
  const historicalPermission = useMemo(() => {
    if (activePermission) return null
    if (relatedPermissions.length === 0) return null
    return relatedPermissions[0]
  }, [activePermission, relatedPermissions])

  const documentItem = useMemo(() => {
    if (!documentId) return null
    return documents.find((d) => d.id === documentId) || null
  }, [documentId, documents])

  // Security checks
  const hasNoPermissionAtAll = relatedPermissions.length === 0
  const isExp = historicalPermission && getEffectivePermissionStatus(historicalPermission) === "EXPIRED"
  const isRev = historicalPermission && getEffectivePermissionStatus(historicalPermission) === "REVOKED"

  // Check if we already registered access in local history
  const actorHistory = useMemo(() => {
    if (!documentId) return []
    return accessRecords.filter(
      (rec) => rec.documentId === documentId && rec.actorId.toLowerCase() === currentUser.id.toLowerCase(),
    )
  }, [documentId, accessRecords, currentUser.id])

  useEffect(() => {
    if (actorHistory.length > 0) {
      setHasRegisteredAccess(true)
    }
  }, [actorHistory])

  if (hasNoPermissionAtAll) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-3xl items-center justify-center px-4 py-8">
        <Card className="w-full border-rose-200 bg-white shadow-sm text-center p-6 dark:border-rose-900 dark:bg-slate-900">
          <CardHeader className="flex flex-col items-center gap-2">
            <div className="rounded-full border border-rose-200 bg-rose-50 p-4 text-rose-800 mb-2">
              <EyeOff className="size-6" />
            </div>
            <CardTitle className="text-rose-950 dark:text-rose-400">Acceso restringido</CardTitle>
            <CardDescription>No tienes autorización para acceder a este documento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/dashboard" className={buttonVariants({ variant: "default" }) + " rounded-lg"}>
              Volver al inicio
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isExp) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-3xl items-center justify-center px-4 py-8">
        <Card className="w-full border-amber-200 bg-white shadow-sm text-center p-6 dark:border-amber-900 dark:bg-slate-900">
          <CardHeader className="flex flex-col items-center gap-2">
            <div className="rounded-full border border-amber-200 bg-amber-50 p-4 text-amber-800 mb-2">
              <AlertTriangle className="size-6" />
            </div>
            <CardTitle className="text-amber-950 dark:text-amber-400">Permiso expirado</CardTitle>
            <CardDescription>La credencial de acceso temporal de este documento ha expirado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/authorized-documents" className={buttonVariants({ variant: "default" }) + " rounded-lg"}>
              Volver a documentos autorizados
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isRev) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-3xl items-center justify-center px-4 py-8">
        <Card className="w-full border-rose-200 bg-white shadow-sm text-center p-6 dark:border-rose-900 dark:bg-slate-900">
          <CardHeader className="flex flex-col items-center gap-2">
            <div className="rounded-full border border-rose-200 bg-rose-50 p-4 text-rose-800 mb-2">
              <AlertTriangle className="size-6" />
            </div>
            <CardTitle className="text-rose-950 dark:text-rose-400">Permiso revocado</CardTitle>
            <CardDescription>El paciente revocó la autorización de acceso para este documento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/authorized-documents" className={buttonVariants({ variant: "default" }) + " rounded-lg"}>
              Volver a documentos autorizados
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!documentItem || !activePermission) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-3xl items-center justify-center px-4 py-8">
        <Card className="w-full border-slate-200 bg-white shadow-sm text-center p-6 dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-col items-center gap-2">
            <div className="rounded-full border border-slate-200 bg-slate-50 p-4 text-slate-500 mb-2">
              <EyeOff className="size-6" />
            </div>
            <CardTitle className="text-slate-900 dark:text-white">Documento no encontrado</CardTitle>
            <CardDescription>El documento médico solicitado no existe o tu autorización no está activa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/authorized-documents" className={buttonVariants({ variant: "default" }) + " rounded-lg"}>
              Volver a documentos autorizados
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const actionText =
    currentUser.role === "DOCTOR"
      ? "Registrar consulta"
      : currentUser.role === "CLINIC"
      ? "Registrar acceso institucional"
      : "Registrar verificación"

  // MetaMask transaction to audit access on-chain
  const handleStartAuditRecord = async () => {
    setIsTxOpen(true)
    setTxStatus("AWAITING_SIGNATURE")
    setTxHash(null)
    setTxError(null)

    try {
      const ethereum = (window as any).ethereum
      if (!ethereum) throw new Error("MetaMask is not installed.")

      const { ethers, BrowserProvider } = await import("ethers")
      const { CONTRACT_ADDRESSES } = await import("@/contracts/contract-addresses")
      const { default: MediRecordRegistryABI } = await import("@/contracts/MediRecordRegistryABI.json")

      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.MediRecordRegistry,
        MediRecordRegistryABI,
        signer
      )

      // Call validateAccess(address requester, bytes32 documentId) on-chain
      const tx = await contract.validateAccess(currentUser.walletAddress, documentItem.id)
      
      setTxHash(tx.hash)
      setTxStatus("SUBMITTED")
      setTxStatus("CONFIRMING")

      const receipt = await tx.wait()
      if (receipt.status === 0) throw new Error("La transacción fue revertida.")

      // Complete audit log registry
      const actionType = getActionTypeByRole(currentUser.role as any)
      registerAccess({
        permissionId: activePermission.id,
        documentId: documentItem.id,
        documentName: documentItem.name,
        patientId: activePermission.patientId,
        patientName: activePermission.patientName,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorWallet: currentUser.walletAddress,
        actorRole: currentUser.role as any,
        actionType,
        result: "GRANTED",
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber || 0,
        gasUsed: String(receipt.gasUsed) || "0",
      })

      // Sync backend audit logs
      let operationType: any = "MEDICAL_CONSULTATION_REGISTERED"
      let operationLabel = "Registro de consulta médica"

      if (currentUser.role === "CLINIC") {
        operationType = "INSTITUTIONAL_ACCESS_REGISTERED"
        operationLabel = "Registro de acceso institucional"
      } else if (currentUser.role === "INSURANCE") {
        operationType = "COVERAGE_VERIFICATION_REGISTERED"
        operationLabel = "Registro de verificación de cobertura"
      }

      registerTransaction({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        operationType,
        operationLabel,
        relatedDocumentId: documentItem.id,
        relatedPermissionId: activePermission.id,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber || 0,
        gasUsed: String(receipt.gasUsed) || "0",
        status: "CONFIRMED",
      })

      setTxStatus("CONFIRMED")
      setHasRegisteredAccess(true)
      toast.success("Consulta registrada e inscrita con éxito.")

    } catch (err: any) {
      console.error(err)
      const errStr = err?.message || err?.reason || ""
      if (errStr.toLowerCase().includes("user rejected") || err.code === 4001) {
        setTxStatus("REJECTED")
      } else {
        setTxError(err.message || "Error al registrar consulta en la blockchain.")
        setTxStatus("FAILED")
      }
    }
  }

  // Real backend PDF download URL using auth token
  const token = getToken()
  const pdfUrl = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1"}/documents/${documentItem.id}/file?token=${token}`

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/app/authorized-documents"
              className="mr-1 rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 transition animate-in fade-in"
              aria-label="Volver a documentos autorizados"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white truncate max-w-[200px] sm:max-w-xs">{documentItem.name}</h1>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 shrink-0">
              Autorización Activa
            </Badge>
          </div>
          <p className="text-[10px] font-mono text-slate-500">ID Técnico: {documentItem.id}</p>
        </div>

        {!hasRegisteredAccess && (
          <Button onClick={handleStartAuditRecord} className="inline-flex items-center gap-2 self-start rounded-xl text-xs bg-teal-600 hover:bg-teal-500 text-white">
            <FileText className="size-4" />
            <span>{actionText}</span>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side: Document Preview & Validation Card */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Real interactive PDF Viewer (visible only after auditing access) */}
          {hasRegisteredAccess ? (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden h-[500px] sm:h-[600px] flex flex-col">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Visor de Documento Autorizado</span>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-500 font-semibold"
                >
                  Abrir en pestaña nueva
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <iframe
                src={pdfUrl}
                className="w-full flex-1 border-0"
                title={`Visualización de ${documentItem.name}`}
              />
            </Card>
          ) : (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8 text-center flex flex-col items-center justify-center min-h-[300px] gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-4 text-slate-400 shrink-0">
                <FileText className="size-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{documentItem.name}</h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider font-bold">
                  Acceso bloqueado en blockchain
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Para poder visualizar y descargar este documento, debes hacer clic en **"{actionText}"** arriba para registrar tu firma de auditoría on-chain en Sepolia.
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Right Side: Metadata & Local Access Logs */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Detalles de la credencial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paciente</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{activePermission.patientName}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Categoría</span>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-[10px]">
                  {documentItem.category}
                </Badge>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vencimiento</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatLongDate(activePermission.expiresAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Access Logs */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tus accesos auditados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-64 overflow-y-auto">
              {actorHistory.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-4">No has registrado accesos para este documento.</p>
              ) : (
                actorHistory.map((rec) => (
                  <div key={rec.id} className="text-xs space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{getActionLabel(rec.actionType)}</span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px]">
                        Autorizado
                      </Badge>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{new Date(rec.occurredAt).toLocaleString()}</span>
                      <span>Tx: {rec.transactionHash.slice(0, 8)}...</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TransactionStatusDialog
        open={isTxOpen}
        onOpenChange={setIsTxOpen}
        actionName={actionText}
        status={txStatus}
        txHash={txHash}
        errorMessage={txError}
      />
    </div>
  )
}
