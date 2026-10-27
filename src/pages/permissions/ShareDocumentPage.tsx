import { useState, useMemo, type FormEvent, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Calendar, AlertTriangle, CheckCircle, Search, FileText } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDemoDocuments } from "@/hooks/use-demo-documents"
import { useDemoSession } from "@/hooks/use-demo-session"
import { useDemoPermissions } from "@/hooks/use-demo-permissions"
import { useDemoTransactions } from "@/hooks/use-demo-transactions"
import { TransactionStatusDialog, type TxStepStatus } from "@/components/transactions/TransactionStatusDialog"
import { hasActiveDuplicatePermission } from "@/utils/permissions"
import type { Permission, AccessType, PermissionRecipientRole } from "@/types/permission"
import { formatLongDate } from "@/utils/dashboard"
import { api } from "@/services/api"
import type { User, UserRole } from "@/types/user"

type FormErrors = Partial<Record<"recipient" | "expiryDate" | "accessType", string>>

export function ShareDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const { currentUser } = useDemoSession()
  const { findDocumentById } = useDemoDocuments()
  const { permissions, refreshPermissions } = useDemoPermissions()
  const { registerTransaction } = useDemoTransactions()

  const navigate = useNavigate()

  // Form states
  const [searchQuery, setSearchQuery] = useState("")
  const [recipientsList, setRecipientsList] = useState<User[]>([])
  const [selectedRecipientId, setSelectedRecipientId] = useState("")
  const [accessType, setAccessType] = useState<AccessType | "">("")
  const [expiryDate, setExpiryDate] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})

  // Real transaction states
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<TxStepStatus>("AWAITING_SIGNATURE")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [createdPermission, setCreatedPermission] = useState<Permission | null>(null)

  // Fetch recipients from database
  useEffect(() => {
    api.getRecipients()
      .then((data) => {
        const mapped: User[] = data.map((r) => ({
          id: r.wallet.toLowerCase(),
          fullName: r.displayName || `${roleLabel(r.role)} (${r.wallet.slice(0, 6)}...${r.wallet.slice(-4)})`,
          role: r.role as UserRole,
          walletAddress: r.wallet.toLowerCase(),
          status: r.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        }))
        setRecipientsList(mapped)
      })
      .catch((err) => {
        console.error("Failed to load recipients:", err)
      })
  }, [])

  const documentItem = useMemo(() => {
    if (!documentId) return null
    return findDocumentById(documentId) || null
  }, [documentId, findDocumentById])

  const isDocOwner = useMemo(() => {
    if (!documentItem) return false
    return documentItem.ownerId.toLowerCase() === currentUser.id.toLowerCase()
  }, [documentItem, currentUser.id])

  const filteredRecipients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return recipientsList.filter((r) => {
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.walletAddress.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
      )
    })
  }, [recipientsList, searchQuery])

  const selectedRecipient = useMemo(() => {
    return recipientsList.find((r) => r.walletAddress.toLowerCase() === selectedRecipientId.toLowerCase()) || null
  }, [recipientsList, selectedRecipientId])

  if (!documentItem) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-3xl items-center justify-center px-4 py-8">
        <Card className="w-full border-slate-200 bg-white shadow-sm text-center p-6 dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-col items-center gap-2">
            <div className="rounded-full border border-slate-200 bg-slate-50 p-4 text-slate-500 mb-2">
              <FileText className="size-6" />
            </div>
            <CardTitle className="text-slate-900 dark:text-white">Documento no encontrado</CardTitle>
            <CardDescription>El documento médico solicitado no existe o no tiene permisos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/documents" className={buttonVariants({ variant: "default" }) + " rounded-lg"}>
              Volver a mis documentos
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isDocOwner) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-3xl items-center justify-center px-4 py-8">
        <Card className="w-full border-rose-200 bg-white shadow-sm text-center p-6 dark:border-rose-900 dark:bg-slate-900">
          <CardHeader className="flex flex-col items-center gap-2">
            <div className="rounded-full border border-rose-200 bg-rose-50 p-4 text-rose-800 mb-2">
              <AlertTriangle className="size-6" />
            </div>
            <CardTitle className="text-rose-950 dark:text-rose-400">Acceso restringido</CardTitle>
            <CardDescription>Tu cuenta no tiene permisos para acceder a este módulo.</CardDescription>
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

  const handleValidateForm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nextErrors: FormErrors = {}

    if (!selectedRecipientId || !selectedRecipient) {
      nextErrors.recipient = "Debe seleccionar un destinatario registrado."
    }
    if (!accessType) {
      nextErrors.accessType = "Debe seleccionar un tipo de acceso."
    }
    if (!expiryDate) {
      nextErrors.expiryDate = "Debe seleccionar una fecha de expiración."
    } else {
      const selectedTime = new Date(`${expiryDate}T23:59:59`).getTime()
      if (selectedTime <= Date.now()) {
        nextErrors.expiryDate = "La fecha de expiración debe ser una fecha futura."
      }
    }

    if (selectedRecipient && !nextErrors.recipient) {
      const hasDuplicate = hasActiveDuplicatePermission(
        documentItem.id,
        selectedRecipient.walletAddress,
        permissions
      )
      if (hasDuplicate) {
        nextErrors.recipient = "Ya existe una autorización activa para este destinatario y documento."
      }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    // Trigger visual transaction popup
    handleEmitPermissionOnChain()
  }

  // Visual MetaMask tracking for permissions
  const handleEmitPermissionOnChain = async () => {
    if (!selectedRecipient || !accessType || !expiryDate) return

    setIsTxDialogOpen(true)
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

      // Normalize date to unix timestamp
      const unixExpiry = Math.floor(new Date(`${expiryDate}T23:59:59`).getTime() / 1000)

      // Call issuePermission(bytes32 documentId, address authorized, uint64 expiresAt)
      const tx = await contract.issuePermission(documentItem.id, selectedRecipient.walletAddress, unixExpiry)
      
      setTxHash(tx.hash)
      setTxStatus("SUBMITTED")
      setTxStatus("CONFIRMING")

      const receipt = await tx.wait()
      if (receipt.status === 0) throw new Error("La transacción fue revertida.")

      // Sincronizar en el backend de forma segura
      const syncPayload = {
        permissionId: ethers.keccak256(ethers.solidityPacked(
          ["bytes32", "address", "address"],
          [documentItem.id, currentUser.walletAddress, selectedRecipient.walletAddress]
        )),
        tokenId: 1, 
        documentId: documentItem.id,
        authorizedWallet: selectedRecipient.walletAddress,
        expiresAt: unixExpiry,
        txHash: tx.hash,
      }

      // Sincronizar con el backend
      const newPerm = await api.syncPermission(syncPayload)

      // Registrar transacciones locales para logs de auditoría
      registerTransaction({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        operationType: "PERMISSION_ISSUED",
        operationLabel: "Emisión de autorización",
        relatedDocumentId: documentItem.id,
        relatedPermissionId: newPerm.permissionId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber || 0,
        gasUsed: String(receipt.gasUsed) || "0",
        status: "CONFIRMED",
      })

      setTxStatus("CONFIRMED")
      setCreatedPermission({
        id: newPerm.permissionId,
        tokenId: String(newPerm.tokenId),
        documentId: documentItem.id,
        documentName: documentItem.name,
        patientId: currentUser.id,
        patientName: currentUser.fullName,
        authorizedUserId: selectedRecipient.id,
        authorizedUserName: selectedRecipient.fullName,
        authorizedWallet: selectedRecipient.walletAddress,
        authorizedRole: selectedRecipient.role as PermissionRecipientRole,
        accessType: accessType as AccessType,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(`${expiryDate}T23:59:59`).toISOString(),
        status: "ACTIVE",
        transactionHash: tx.hash,
      })

      toast.success("Autorización registrada con éxito.")
      await refreshPermissions()

    } catch (err: any) {
      console.error(err)
      const errStr = err?.message || err?.reason || ""
      if (errStr.toLowerCase().includes("user rejected") || err.code === 4001) {
        setTxStatus("REJECTED")
      } else {
        setTxError(err.message || "Error al emitir autorización en blockchain.")
        setTxStatus("FAILED")
      }
    }
  }

  const handleResetForm = () => {
    setSelectedRecipientId("")
    setAccessType("")
    setExpiryDate("")
    setSearchQuery("")
    setErrors({})
    setCreatedPermission(null)
  }


  if (createdPermission) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto px-2 sm:px-0">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Autorización emitida</h1>
          <p className="text-sm text-slate-500">Resumen técnico de la credencial digital autorizada.</p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-slate-100 dark:border-slate-800 p-5 flex flex-row items-center justify-between">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded dark:text-emerald-400 dark:bg-emerald-900/30">
                Credencial de acceso #{createdPermission.tokenId}
              </span>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white mt-1 truncate">
                Autorización emitida correctamente
              </CardTitle>
            </div>
            <CheckCircle className="size-8 text-emerald-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Documento</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{createdPermission.documentName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Destinatario</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                  {createdPermission.authorizedUserName}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Tipo de acceso</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">{createdPermission.accessType === "READ" ? "Lectura" : "Escritura"}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Expiración</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">{formatLongDate(createdPermission.expiresAt)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => navigate(`/app/permissions/${createdPermission.id}`)} variant="outline" className="flex-1 text-xs">
                Ver detalles
              </Button>
              <Button onClick={handleResetForm} className="flex-1 text-xs bg-teal-600 hover:bg-teal-500 text-white">
                Emitir otra
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-2 sm:px-0">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            to="/app/documents"
            className="mr-1 rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Compartir documento</h1>
        </div>
        <p className="text-sm text-slate-500">
          Emitirás una autorización de acceso técnico para una cuenta previamente registrada.
        </p>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <form className="space-y-5" onSubmit={handleValidateForm}>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Documento</span>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3">
                <FileText className="size-5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{documentItem.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">Hash: {documentItem.documentHash}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="recipient-search" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Destinatario autorizado
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="recipient-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, wallet..."
                  className="pl-9 bg-white dark:bg-slate-850"
                />
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecipients.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-6">No se encontraron destinatarios válidos.</p>
                ) : (
                  filteredRecipients.map((rec) => {
                    const isSelected = selectedRecipientId.toLowerCase() === rec.walletAddress.toLowerCase()
                    return (
                      <div
                        key={rec.walletAddress}
                        onClick={() => {
                          setSelectedRecipientId(rec.walletAddress)
                          setErrors((prev) => ({ ...prev, recipient: undefined }))
                        }}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors duration-150 ${
                          isSelected 
                            ? "bg-teal-50/70 dark:bg-teal-950/20 border-l-4 border-teal-500" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="radio"
                            name="recipient-selector"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedRecipientId(rec.walletAddress)
                              setErrors((prev) => ({ ...prev, recipient: undefined }))
                            }}
                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-350 shrink-0"
                          />
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{rec.fullName}</p>
                            <p className="font-mono text-[10px] text-slate-400 truncate">{rec.walletAddress}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-[10px] shrink-0 ml-2">
                          {rec.role === "DOCTOR" ? "Médico" : rec.role === "CLINIC" ? "Clínica" : "Aseguradora"}
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
              {errors.recipient && (
                <p className="text-xs text-rose-600 font-medium">{errors.recipient}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="access-type" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Tipo de acceso
              </label>
              <Select value={accessType} onValueChange={(val) => {
                if (val === "READ" || val === "WRITE") {
                  setAccessType(val)
                  setErrors((prev) => ({ ...prev, accessType: undefined }))
                }
              }}>
                <SelectTrigger id="access-type" className="bg-white dark:bg-slate-800 h-9 text-xs">
                  <SelectValue placeholder="Seleccionar tipo de acceso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="READ">Lectura (Sólo consulta)</SelectItem>
                  <SelectItem value="WRITE">Escritura (Permite registrar atenciones)</SelectItem>
                </SelectContent>
              </Select>
              {errors.accessType && (
                <p className="text-xs text-rose-600 font-medium">{errors.accessType}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="expiry-date" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Fecha de expiración
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => {
                    setExpiryDate(e.target.value)
                    setErrors((prev) => ({ ...prev, expiryDate: undefined }))
                  }}
                  className="pl-9 bg-white dark:bg-slate-800 h-9 text-xs"
                />
              </div>
              {errors.expiryDate && (
                <p className="text-xs text-rose-600 font-medium">{errors.expiryDate}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 h-9 text-xs font-semibold" onClick={() => navigate("/app/documents")}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 h-9 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white">
                Emitir autorización
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <TransactionStatusDialog
        open={isTxDialogOpen}
        onOpenChange={setIsTxDialogOpen}
        actionName="Emitir autorización de acceso"
        status={txStatus}
        txHash={txHash}
        errorMessage={txError}
        onClose={refreshPermissions}
      />
    </div>
  )
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Administrador",
    PATIENT: "Paciente",
    DOCTOR: "Médico",
    CLINIC: "Clínica",
    INSURANCE: "Aseguradora",
  }
  return labels[role] ?? role
}
