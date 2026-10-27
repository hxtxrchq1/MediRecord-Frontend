import { useMemo, useState } from "react"
import { toast } from "sonner"

import { DocumentsEmptyState } from "@/components/documents/DocumentsEmptyState"
import { DocumentsFilters } from "@/components/documents/DocumentsFilters"
import { DocumentsHeader } from "@/components/documents/DocumentsHeader"
import { DocumentsStats } from "@/components/documents/DocumentsStats"
import { DocumentsList } from "@/components/documents/DocumentsList"
import { DocumentHashDialog } from "@/components/documents/DocumentHashDialog"
import { RegisterDocumentDialog } from "@/components/documents/RegisterDocumentDialog"
import { TransactionStatusDialog, type TxStepStatus } from "@/components/transactions/TransactionStatusDialog"
import { useDemoDocuments } from "@/hooks/use-demo-documents"
import { useDemoSession } from "@/hooks/use-demo-session"
import {
  filterAndSortDocuments,
  getDocumentsStats,
  type DocumentFilters,
} from "@/utils/documents"
import type { MedicalDocument } from "@/types/document"

const initialFilters: DocumentFilters = {
  search: "",
  category: "ALL",
  status: "ALL",
  sort: "NEWEST",
}

export function DocumentsPage() {
  const { currentUser } = useDemoSession()
  const {
    documents,
    refreshDocuments,
  } = useDemoDocuments()

  const [filters, setFilters] = useState<DocumentFilters>(initialFilters)
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false)
  const [selectedDocForHash, setSelectedDocForHash] = useState<MedicalDocument | null>(null)

  // Transaction States
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<TxStepStatus>("AWAITING_SIGNATURE")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const patientDocuments = useMemo(() => {
    return documents.filter((doc) => doc.ownerId.toLowerCase() === currentUser.id.toLowerCase())
  }, [documents, currentUser.id])

  const stats = useMemo(() => getDocumentsStats(patientDocuments), [patientDocuments])

  const filteredDocuments = useMemo(() => {
    return filterAndSortDocuments(patientDocuments, filters)
  }, [patientDocuments, filters])

  // Custom step-by-step MetaMask loader tracking for document uploads
  const handleRegister = async (input: Omit<MedicalDocument, "id" | "uploadedAt" | "status" | "documentHash">, file: File) => {
    setIsRegisterDialogOpen(false) // Close modal form
    setTxStatus("AWAITING_SIGNATURE")
    setTxHash(null)
    setTxError(null)
    setIsTxDialogOpen(true) // Open transaction status gateway popup

    try {
      const ethereum = (window as any).ethereum
      if (!ethereum) throw new Error("MetaMask is not installed.")

      // 1. Upload to backend first
      const { api } = await import("@/services/api")
      const uploadRes = await api.uploadDocument(file, input.category, input.description)

      // 2. Submit on-chain via MetaMask
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

      // registerDocument(bytes32 documentId, bytes32 documentHash)
      const tx = await contract.registerDocument(uploadRes.documentId, uploadRes.documentHash)
      
      setTxHash(tx.hash)
      setTxStatus("SUBMITTED")
      setTxStatus("CONFIRMING")

      const receipt = await tx.wait()
      if (receipt.status === 0) {
        throw new Error("Transacción revertida por la blockchain.")
      }

      setTxStatus("CONFIRMED")
      toast.success("Documento registrado e inscrito correctamente.")
      await refreshDocuments()

    } catch (err: any) {
      console.error(err)
      const errStr = err?.message || err?.reason || ""
      if (errStr.toLowerCase().includes("user rejected") || err.code === 4001) {
        setTxStatus("REJECTED")
      } else {
        setTxError(err.message || "Error al subir o registrar el archivo en blockchain.")
        setTxStatus("FAILED")
      }
    }
  }

  const handleClearFilters = () => setFilters(initialFilters)

  return (
    <div className="space-y-6">
      <DocumentsHeader onRegister={() => setIsRegisterDialogOpen(true)} />

      <DocumentsStats stats={stats} />

      <DocumentsFilters
        search={filters.search}
        category={filters.category}
        status={filters.status}
        sort={filters.sort}
        onSearchChange={(value) => setFilters((f) => ({ ...f, search: value }))}
        onCategoryChange={(value) => setFilters((f) => ({ ...f, category: value }))}
        onStatusChange={(value) => setFilters((f) => ({ ...f, status: value }))}
        onSortChange={(value) => setFilters((f) => ({ ...f, sort: value }))}
        onClearFilters={handleClearFilters}
      />

      {patientDocuments.length === 0 ? (
        <DocumentsEmptyState
          variant="empty"
          title="Aún no tienes documentos"
          description="Sube tu primer documento de salud para comenzar a gestionar tu historial médico seguro."
          actionLabel="Subir documento"
          onAction={() => setIsRegisterDialogOpen(true)}
        />
      ) : filteredDocuments.length === 0 ? (
        <DocumentsEmptyState
          variant="filtered"
          title="No hay coincidencias"
          description="Prueba con otro término de búsqueda o cambia los filtros de categoría."
          actionLabel="Limpiar filtros"
          onAction={handleClearFilters}
        />
      ) : (
        <DocumentsList
          documents={filteredDocuments}
          onViewHash={(doc) => setSelectedDocForHash(doc)}
        />
      )}

      {/* Upload Form */}
      <RegisterDocumentDialog
        open={isRegisterDialogOpen}
        onOpenChange={setIsRegisterDialogOpen}
        onRegister={handleRegister}
        currentUser={currentUser}
      />

      {/* Hash dialog */}
      <DocumentHashDialog
        open={Boolean(selectedDocForHash)}
        document={selectedDocForHash}
        onOpenChange={(open) => { if (!open) setSelectedDocForHash(null) }}
      />

      {/* Real Blockchain transaction gateway modal */}
      <TransactionStatusDialog
        open={isTxDialogOpen}
        onOpenChange={setIsTxDialogOpen}
        actionName="Registrar documento médico"
        status={txStatus}
        txHash={txHash}
        errorMessage={txError}
        onClose={refreshDocuments}
      />
    </div>
  )
}
