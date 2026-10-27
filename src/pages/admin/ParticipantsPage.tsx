import { useEffect, useMemo, useState, useCallback } from "react"
import { toast } from "sonner"

import { ParticipantsEmptyState } from "@/components/participants/ParticipantsEmptyState"
import { ParticipantsFilters } from "@/components/participants/ParticipantsFilters"
import { ParticipantsHeader } from "@/components/participants/ParticipantsHeader"
import { ParticipantsStats } from "@/components/participants/ParticipantsStats"
import { ParticipantsTable } from "@/components/participants/ParticipantsTable"
import { ParticipantDetailsDialog } from "@/components/participants/ParticipantDetailsDialog"
import { RegisterParticipantDialog } from "@/components/participants/RegisterParticipantDialog"
import { TransactionStatusDialog, type TxStepStatus } from "@/components/transactions/TransactionStatusDialog"
import { useDemoParticipants } from "@/hooks/use-demo-participants"
import type { User } from "@/types/user"
import {
  filterParticipants,
  getParticipantStats,
  type ParticipantFilters,
  type ParticipantRegistrationInput,
} from "@/utils/participants"

const initialFilters: ParticipantFilters = {
  search: "",
  role: "ALL",
  status: "ALL",
}

export function ParticipantsPage() {
  const {
    participants,
    findParticipantById,
    refreshParticipants,
  } = useDemoParticipants()

  const [filters, setFilters] = useState<ParticipantFilters>(initialFilters)
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false)
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Transaction Status States for the visual gateway popup
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<TxStepStatus>("AWAITING_SIGNATURE")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const stats = useMemo(() => getParticipantStats(participants), [participants])
  const filteredParticipants = useMemo(
    () => filterParticipants(participants, filters),
    [participants, filters],
  )
  const selectedParticipant = selectedParticipantId
    ? findParticipantById(selectedParticipantId) ?? null
    : null

  // Refresh list on mount & visibility change
  useEffect(() => {
    refreshParticipants()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshParticipants()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [refreshParticipants])

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshParticipants()
      toast.success("Lista actualizada correctamente.")
    } catch {
      toast.error("No se pudo actualizar la lista.")
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshParticipants])

  // Custom visual registration handler implementing real web3 receipt visual tracking
  const handleRegister = async (input: ParticipantRegistrationInput): Promise<User> => {
    setIsRegisterDialogOpen(false) // Close the creation form
    setTxStatus("AWAITING_SIGNATURE")
    setTxHash(null)
    setTxError(null)
    setIsTxDialogOpen(true) // Open the transaction status dialog (gateway)

    try {
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        throw new Error("MetaMask is not installed.")
      }

      // We handle the ethers transaction directly here so we can update states step-by-step
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

      const roleMap: Record<string, number> = {
        NONE: 0,
        ADMIN: 1,
        PATIENT: 2,
        DOCTOR: 3,
        CLINIC: 4,
        INSURANCE: 5,
      }
      const roleEnumVal = roleMap[input.role] ?? 0

      // Send transaction: MetaMask opens
      const tx = await contract.registerUser(input.walletAddress, roleEnumVal)
      
      // Transaction accepted in MetaMask, now submitted
      setTxHash(tx.hash)
      setTxStatus("SUBMITTED")
      
      // Simulating step update to block confirmation
      setTxStatus("CONFIRMING")

      // Wait for block receipt
      const receipt = await tx.wait()
      if (receipt.status === 0) {
        throw new Error("Transacción revertida por la blockchain.")
      }

      // Success
      setTxStatus("CONFIRMED")
      toast.success("Participante registrado e inscrito correctamente.")
      await refreshParticipants()

      return {
        id: input.walletAddress.toLowerCase(),
        fullName: input.fullName,
        role: input.role,
        walletAddress: input.walletAddress,
        status: "ACTIVE",
      }

    } catch (err: any) {
      console.error(err)
      const errStr = err?.message || err?.reason || ""
      
      if (errStr.includes("0x9e4a65f6") || errStr.toLowerCase().includes("notowner")) {
        setTxError("Solo el propietario (deployer) del contrato inteligente puede registrar usuarios.")
      } else if (errStr.toLowerCase().includes("alreadyregistered") || errStr.includes("already")) {
        setTxError("La wallet fue registrada ya anteriormente.")
      } else if (errStr.toLowerCase().includes("user rejected") || err.code === 4001) {
        setTxStatus("REJECTED")
        throw new Error("Transacción rechazada por el usuario en MetaMask.")
      } else {
        setTxError(err.message || "Error desconocido al procesar transacción.")
      }

      setTxStatus("FAILED")
      throw err
    }
  }


  const handleClearFilters = () => setFilters(initialFilters)

  return (
    <div className="space-y-6">
      <ParticipantsHeader
        onRegister={() => setIsRegisterDialogOpen(true)}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      <ParticipantsStats stats={stats} />

      <ParticipantsFilters
        search={filters.search}
        role={filters.role}
        status={filters.status}
        onSearchChange={(value) => setFilters((f) => ({ ...f, search: value }))}
        onRoleChange={(value) => setFilters((f) => ({ ...f, role: value }))}
        onStatusChange={(value) => setFilters((f) => ({ ...f, status: value }))}
        onClearFilters={handleClearFilters}
      />

      {participants.length === 0 ? (
        <ParticipantsEmptyState
          variant="empty"
          title="Aún no hay participantes"
          description="Registra la primera cuenta de usuario para comenzar a gestionar el panel administrativo."
          actionLabel="Registrar participante"
          onAction={() => setIsRegisterDialogOpen(true)}
        />
      ) : filteredParticipants.length === 0 ? (
        <ParticipantsEmptyState
          variant="filtered"
          title="No hay coincidencias"
          description="Prueba con otro nombre, wallet, rol o estado para encontrar participantes."
          actionLabel="Limpiar filtros"
          onAction={handleClearFilters}
        />
      ) : (
        <ParticipantsTable
          participants={filteredParticipants}
          onViewDetails={(participantId) => setSelectedParticipantId(participantId)}
        />
      )}

      {/* Dialogo: Formulario de Registro */}
      <RegisterParticipantDialog
        open={isRegisterDialogOpen}
        onOpenChange={setIsRegisterDialogOpen}
        onRegister={handleRegister}
        participants={participants}
      />

      {/* Dialogo: Detalles */}
      <ParticipantDetailsDialog
        open={Boolean(selectedParticipant)}
        participant={selectedParticipant}
        onOpenChange={(open) => {
          if (!open) setSelectedParticipantId(null)
        }}
      />

      {/* DIALOGO: PASARELA DE TRANSACCION BLOCKCHAIN */}
      <TransactionStatusDialog
        open={isTxDialogOpen}
        onOpenChange={setIsTxDialogOpen}
        actionName="Registrar nuevo participante"
        status={txStatus}
        txHash={txHash}
        errorMessage={txError}
        onClose={refreshParticipants}
      />
    </div>
  )
}
