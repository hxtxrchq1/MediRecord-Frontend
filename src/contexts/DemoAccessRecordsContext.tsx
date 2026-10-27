import {
  createContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react"
import { api } from "@/services/api"
import type { AccessRecord, AccessResult } from "@/types/access-record"
import { useDemoSession } from "@/hooks/use-demo-session"

interface DemoAccessRecordsContextValue {
  accessRecords: readonly AccessRecord[]
  registerAccess: (input: Omit<AccessRecord, "id" | "occurredAt" | "transactionHash" | "blockNumber" | "gasUsed"> & {
    transactionHash?: string
    blockNumber?: number
    gasUsed?: string
  }) => Promise<AccessRecord>
  findRecordsByActorId: (actorId: string) => AccessRecord[]
  findRecordsByPatientId: (patientId: string) => AccessRecord[]
  findRecordsByDocumentId: (documentId: string) => Promise<AccessRecord[]>
  findRecordsByPermissionId: (permissionId: string) => AccessRecord[]
  refreshAccessLogs: () => Promise<void>
}

const DemoAccessRecordsContext = createContext<DemoAccessRecordsContextValue | null>(null)

export function DemoAccessRecordsProvider({ children }: { children: ReactNode }) {
  const { walletState } = useDemoSession()
  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>([])

  // Refresh access logs globally
  const refreshAccessLogs = useCallback(async () => {
    if (walletState.connectionStatus !== "CONNECTED") {
      setAccessRecords([])
      return
    }

    try {
      const backendLogs = await api.getAuditAll()
      const mappedLogs: AccessRecord[] = backendLogs.map((log: any) => ({
        id: String(log.id),
        permissionId: log.permissionId || "Acceso Directo / Sin Credencial",
        documentId: log.documentId,
        documentName: log.Document?.fileName || `Documento (${log.documentId.slice(0, 10)}...)`,
        patientId: log.Document?.ownerWallet || "",
        patientName: log.Document?.ownerWallet 
          ? `Paciente (${log.Document.ownerWallet.slice(0, 6)}...${log.Document.ownerWallet.slice(-4)})`
          : "Paciente",
        actorId: log.requesterWallet,
        actorName: `Usuario (${log.requesterWallet.slice(0, 6)}...${log.requesterWallet.slice(-4)})`,
        actorWallet: log.requesterWallet,
        actorRole: "DOCTOR", // Default mapping for list visual
        actionType: "MEDICAL_CONSULTATION",
        occurredAt: log.createdAt,
        result: (log.result ? "GRANTED" : "DENIED") as AccessResult,
        transactionHash: log.txHash || "Registro de Servidor Local",
        blockNumber: 0,
        gasUsed: "0",
      }))
      setAccessRecords(mappedLogs)
    } catch (err) {
      console.error("Failed to load global access logs:", err)
    }
  }, [walletState.connectionStatus])

  // Auto-fetch on connect
  useEffect(() => {
    refreshAccessLogs()
  }, [refreshAccessLogs])

  const findRecordsByActorId = useCallback(
    (actorId: string) => accessRecords.filter((rec) => rec.actorId.toLowerCase() === actorId.toLowerCase()),
    [accessRecords],
  )

  const findRecordsByPatientId = useCallback(
    (patientId: string) => accessRecords.filter((rec) => rec.patientId.toLowerCase() === patientId.toLowerCase()),
    [accessRecords],
  )

  const findRecordsByPermissionId = useCallback(
    (permissionId: string) => accessRecords.filter((rec) => rec.permissionId === permissionId),
    [accessRecords],
  )

  const findRecordsByDocumentId = useCallback(
    async (documentId: string): Promise<AccessRecord[]> => {
      try {
        const backendLogs = await api.getAccessLogs(documentId)
        const mappedLogs: AccessRecord[] = backendLogs.map((log: any) => ({
          id: String(log.id),
          permissionId: log.permissionId || "Sin credencial",
          documentId: log.documentId,
          documentName: log.Document?.fileName || `Documento (${log.documentId.slice(0, 10)}...)`,
          patientId: log.Document?.ownerWallet || "",
          patientName: "Propietario",
          actorId: log.requesterWallet,
          actorName: `Actor (${log.requesterWallet.slice(0, 6)}...${log.requesterWallet.slice(-4)})`,
          actorWallet: log.requesterWallet,
          actorRole: "DOCTOR",
          actionType: "MEDICAL_CONSULTATION",
          occurredAt: log.createdAt,
          result: (log.result ? "GRANTED" : "DENIED") as AccessResult,
          transactionHash: log.txHash || "Registro de Servidor Local",
          blockNumber: 0,
          gasUsed: "0",
        }))
        return mappedLogs
      } catch (err) {
        console.error("Failed to load access logs for document:", err)
        return []
      }
    },
    [],
  )

  const registerAccess = useCallback(
    async (input: Omit<AccessRecord, "id" | "occurredAt" | "transactionHash" | "blockNumber" | "gasUsed"> & {
      transactionHash?: string
      blockNumber?: number
      gasUsed?: string
    }): Promise<AccessRecord> => {
      const nextRecord: AccessRecord = {
        ...input,
        id: `acc-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        transactionHash: input.transactionHash || "Pendiente de Sincronización",
        blockNumber: input.blockNumber || 0,
        gasUsed: input.gasUsed || "0",
      }

      setAccessRecords((curr) => [nextRecord, ...curr])
      return nextRecord
    },
    [],
  )

  const value = useMemo<DemoAccessRecordsContextValue>(
    () => ({
      accessRecords,
      registerAccess,
      findRecordsByActorId,
      findRecordsByPatientId,
      findRecordsByDocumentId,
      findRecordsByPermissionId,
      refreshAccessLogs,
    }),
    [
      accessRecords,
      registerAccess,
      findRecordsByActorId,
      findRecordsByPatientId,
      findRecordsByDocumentId,
      findRecordsByPermissionId,
      refreshAccessLogs,
    ],
  )

  return (
    <DemoAccessRecordsContext.Provider value={value}>
      {children}
    </DemoAccessRecordsContext.Provider>
  )
}

export { DemoAccessRecordsContext }
