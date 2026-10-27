import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { ethers, BrowserProvider } from "ethers"
import { api } from "@/services/api"
import { CONTRACT_ADDRESSES } from "@/contracts/contract-addresses"
import MediRecordRegistryABI from "@/contracts/MediRecordRegistryABI.json"
import type { User, UserRole } from "@/types/user"
import { type ParticipantRegistrationInput } from "@/utils/participants"
import { useDemoSession } from "@/hooks/use-demo-session"

interface DemoParticipantsContextValue {
  participants: readonly User[]
  registerParticipant: (input: ParticipantRegistrationInput) => Promise<User>
  findParticipantById: (participantId: string) => User | undefined
  findParticipantByWallet: (walletAddress: string) => User | undefined
  refreshParticipants: () => Promise<void>
}

const DemoParticipantsContext = createContext<DemoParticipantsContextValue | null>(null)

export function DemoParticipantsProvider({ children }: { children: ReactNode }) {
  const { walletState, currentUser } = useDemoSession()
  const [participants, setParticipants] = useState<User[]>([])

  // Fetch the full participant list from the backend DB (admin only)
  const refreshParticipants = useCallback(async () => {
    if (walletState.connectionStatus !== "CONNECTED") {
      setParticipants([])
      return
    }

    // Only admins can see all users
    if (currentUser.role !== "ADMIN") {
      return
    }

    try {
      const data = await api.getAllUsers()
      const mapped: User[] = data.map((u) => ({
        id: u.wallet,
        fullName: u.displayName || `${roleLabel(u.role)} (${u.wallet.slice(0, 6)}...${u.wallet.slice(-4)})`,
        role: u.role as UserRole,
        walletAddress: u.wallet,
        status: u.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      }))
      setParticipants(mapped)
    } catch (err) {
      console.error("Failed to load participants:", err)
    }
  }, [walletState.connectionStatus, currentUser.role])

  // Auto-refresh when session state changes
  useEffect(() => {
    refreshParticipants()
  }, [refreshParticipants])

  const findParticipantById = useCallback(
    (participantId: string) => participants.find((p) => p.id === participantId),
    [participants],
  )

  const findParticipantByWallet = useCallback(
    (walletAddress: string) => {
      const normalizedWallet = walletAddress.trim().toLowerCase()
      return participants.find(
        (p) => p.walletAddress.trim().toLowerCase() === normalizedWallet,
      )
    },
    [participants],
  )

  const registerParticipant = useCallback(
    async (input: ParticipantRegistrationInput): Promise<User> => {
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        throw new Error("MetaMask is not installed.")
      }

      // 1. Submit on-chain transaction via MetaMask
      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.MediRecordRegistry,
        MediRecordRegistryABI,
        signer
      )

      // Map string role to enum
      // enum Rol { NONE, ADMIN, PATIENT, DOCTOR, CLINIC, INSURANCE }
      const roleMap: Record<string, number> = {
        NONE: 0,
        ADMIN: 1,
        PATIENT: 2,
        DOCTOR: 3,
        CLINIC: 4,
        INSURANCE: 5,
      }
      const roleEnumVal = roleMap[input.role] ?? 0

      // Call registerUser(address user, Rol role)
      try {
        const tx = await contract.registerUser(input.walletAddress, roleEnumVal)
        await tx.wait()
      } catch (contractErr: any) {
        // Friendly error messages for known contract reverts
        const errStr = contractErr?.message || contractErr?.reason || ""
        if (errStr.includes("0x9e4a65f6") || errStr.toLowerCase().includes("notowner")) {
          throw new Error("Solo el propietario del contrato puede registrar usuarios.")
        }
        if (errStr.toLowerCase().includes("alreadyregistered") || errStr.includes("already")) {
          throw new Error("La wallet fue registrada ya anteriormente.")
        }
        if (errStr.toLowerCase().includes("user rejected") || errStr.code === 4001) {
          throw new Error("Transacción rechazada por el usuario en MetaMask.")
        }
        throw new Error("Error al registrar en la blockchain. Verifica que tienes los permisos necesarios.")
      }

      // 2. Refresh participants list from backend (the user will now appear after login)
      await refreshParticipants()

      // 3. Return a local participant object for immediate UI feedback
      const nextParticipant: User = {
        id: input.walletAddress.toLowerCase(),
        fullName: input.fullName.trim(),
        role: input.role,
        walletAddress: input.walletAddress.trim(),
        status: "ACTIVE",
      }

      return nextParticipant
    },
    [refreshParticipants],
  )

  const value = useMemo<DemoParticipantsContextValue>(
    () => ({
      participants,
      registerParticipant,
      findParticipantById,
      findParticipantByWallet,
      refreshParticipants,
    }),
    [findParticipantById, findParticipantByWallet, participants, registerParticipant, refreshParticipants],
  )

  return <DemoParticipantsContext.Provider value={value}>{children}</DemoParticipantsContext.Provider>
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

export { DemoParticipantsContext }
