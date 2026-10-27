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
import type { Permission, PermissionStatus } from "@/types/permission"
import { useDemoSession } from "@/hooks/use-demo-session"

interface DemoPermissionsContextValue {
  permissions: readonly Permission[]
  registerPermission: (
    permission: Omit<Permission, "id" | "tokenId" | "issuedAt" | "status" | "transactionHash">
  ) => Promise<Permission>
  revokePermission: (permissionId: string, transactionHash?: string) => Promise<void>
  findPermissionById: (permissionId: string) => Permission | undefined
  findPermissionsByPatientId: (patientId: string) => Permission[]
  findPermissionsByAuthorizedUserId: (authorizedUserId: string) => Permission[]
  refreshPermissions: () => Promise<void>
}

const DemoPermissionsContext = createContext<DemoPermissionsContextValue | null>(null)

export function DemoPermissionsProvider({ children }: { children: ReactNode }) {
  const { walletState, currentUser } = useDemoSession()
  const [permissions, setPermissions] = useState<Permission[]>([])

  const refreshPermissions = useCallback(async () => {
    if (walletState.connectionStatus !== "CONNECTED" || !walletState.address) {
      setPermissions([])
      return
    }

    try {
      let data: any[] = []
      if (currentUser.role === "PATIENT") {
        data = await api.getIssuedPermissions()
      } else {
        data = await api.getReceivedPermissions()
      }

      const mappedPerms: Permission[] = data.map((p: any) => ({
        id: p.permissionId,
        tokenId: String(p.tokenId),
        documentId: p.documentId,
        documentName: `Documento (${p.documentId.slice(0, 10)})`,
        patientId: p.patientWallet,
        patientName: `Paciente (${p.patientWallet.slice(0, 6)}...${p.patientWallet.slice(-4)})`,
        authorizedUserId: p.authorizedWallet,
        authorizedUserName: `Médico/Clínica (${p.authorizedWallet.slice(0, 6)}...${p.authorizedWallet.slice(-4)})`,
        authorizedWallet: p.authorizedWallet,
        authorizedRole: "DOCTOR", // Default mapping for visual display
        accessType: "READ",
        issuedAt: p.issuedAt,
        expiresAt: p.expiresAt,
        status: (p.revoked ? "REVOKED" : new Date(p.expiresAt) < new Date() ? "EXPIRED" : "ACTIVE") as PermissionStatus,
        transactionHash: p.txHash || "",
      }))

      setPermissions(mappedPerms)
    } catch (err) {
      console.error("Failed to load permissions:", err)
    }
  }, [walletState.connectionStatus, walletState.address, currentUser.role])

  useEffect(() => {
    refreshPermissions()
  }, [refreshPermissions])

  const findPermissionById = useCallback(
    (permissionId: string) => permissions.find((perm) => perm.id === permissionId),
    [permissions],
  )

  const findPermissionsByPatientId = useCallback(
    (patientId: string) => permissions.filter((perm) => perm.patientId.toLowerCase() === patientId.toLowerCase()),
    [permissions],
  )

  const findPermissionsByAuthorizedUserId = useCallback(
    (authorizedUserId: string) => permissions.filter((perm) => perm.authorizedUserId.toLowerCase() === authorizedUserId.toLowerCase()),
    [permissions],
  )

  const registerPermission = useCallback(
    async (
      input: Omit<Permission, "id" | "tokenId" | "issuedAt" | "status" | "transactionHash">
    ): Promise<Permission> => {
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        throw new Error("MetaMask is not installed.")
      }

      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.MediRecordRegistry,
        MediRecordRegistryABI,
        signer
      )

      // Convert expiresAt (ISO string) to UNIX timestamp in seconds
      const expiresAtSeconds = Math.floor(new Date(input.expiresAt).getTime() / 1000)

      // issuePermission(bytes32 documentId, address authorized, uint64 expiresAt)
      const tx = await contract.issuePermission(input.documentId, input.authorizedWallet, expiresAtSeconds)
      const receipt = await tx.wait()

      // Find permissionId and tokenId from logs
      let permissionId = ""
      let tokenId = 0
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log)
          if (parsedLog && parsedLog.name === "PermisoEmitido") {
            permissionId = parsedLog.args.idPermiso
            tokenId = Number(parsedLog.args.tokenId)
            break
          }
        } catch (e) {}
      }

      if (!permissionId) {
        throw new Error("Failed to retrieve PermisoEmitido event from logs")
      }

      // Sync permission to backend database
      await api.syncPermission({
        permissionId,
        tokenId,
        documentId: input.documentId,
        authorizedWallet: input.authorizedWallet,
        expiresAt: expiresAtSeconds,
        txHash: receipt.hash,
      })

      const newPermission: Permission = {
        ...input,
        id: permissionId,
        tokenId: String(tokenId),
        issuedAt: new Date().toISOString(),
        status: "ACTIVE",
        transactionHash: receipt.hash,
      }

      setPermissions((prev) => [newPermission, ...prev])
      return newPermission
    },
    [],
  )

  const revokePermission = useCallback(
    async (permissionId: string, _transactionHash?: string): Promise<void> => {
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        throw new Error("MetaMask is not installed.")
      }

      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.MediRecordRegistry,
        MediRecordRegistryABI,
        signer
      )

      // revokePermission(bytes32 permissionId)
      const tx = await contract.revokePermission(permissionId)
      const receipt = await tx.wait()

      // Sync revocation to backend
      await api.syncRevocation(permissionId)

      setPermissions((prev) =>
        prev.map((p) =>
          p.id === permissionId
            ? { ...p, status: "REVOKED", transactionHash: receipt.hash }
            : p
        )
      )
    },
    [],
  )

  const value = useMemo<DemoPermissionsContextValue>(
    () => ({
      permissions,
      registerPermission,
      revokePermission,
      findPermissionById,
      findPermissionsByPatientId,
      findPermissionsByAuthorizedUserId,
      refreshPermissions,
    }),
    [
      permissions,
      registerPermission,
      revokePermission,
      findPermissionById,
      findPermissionsByPatientId,
      findPermissionsByAuthorizedUserId,
      refreshPermissions,
    ],
  )

  return <DemoPermissionsContext.Provider value={value}>{children}</DemoPermissionsContext.Provider>
}

export { DemoPermissionsContext }
