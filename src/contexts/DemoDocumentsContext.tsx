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
import type { MedicalDocument, MedicalDocumentStatus } from "@/types/document"
import { useDemoSession } from "@/hooks/use-demo-session"

interface DemoDocumentsContextValue {
  documents: readonly MedicalDocument[]
  registerDocument: (
    document: Omit<MedicalDocument, "id" | "uploadedAt" | "status" | "documentHash">,
    file: File
  ) => Promise<MedicalDocument>
  findDocumentById: (documentId: string) => MedicalDocument | undefined
  findDocumentsByOwnerId: (ownerId: string) => MedicalDocument[]
  refreshDocuments: () => Promise<void>
}

const DemoDocumentsContext = createContext<DemoDocumentsContextValue | null>(null)

export function DemoDocumentsProvider({ children }: { children: ReactNode }) {
  const { walletState } = useDemoSession()
  const [documents, setDocuments] = useState<MedicalDocument[]>([])

  const refreshDocuments = useCallback(async () => {
    if (walletState.connectionStatus !== "CONNECTED") {
      setDocuments([])
      return
    }

    try {
      const data = await api.getMyDocuments()
      const mappedDocs: MedicalDocument[] = data.map((doc: any) => ({
        id: doc.documentId,
        name: doc.fileName,
        category: doc.category,
        description: doc.description || "Sin descripción adicional.",
        ownerId: doc.ownerWallet,
        ownerName: `Paciente (${doc.ownerWallet.slice(0, 6)}...${doc.ownerWallet.slice(-4)})`,
        documentHash: doc.documentHash,
        uploadedAt: doc.uploadedAt,
        status: (doc.status === "ACTIVE" ? "ACTIVE" : "RESTRICTED") as MedicalDocumentStatus,
      }))
      setDocuments(mappedDocs)
    } catch (err) {
      console.error("Failed to load documents:", err)
    }
  }, [walletState.connectionStatus])

  // Reload documents when wallet connection state changes
  useEffect(() => {
    refreshDocuments()
  }, [refreshDocuments])

  const findDocumentById = useCallback(
    (documentId: string) => documents.find((doc) => doc.id === documentId),
    [documents],
  )

  const findDocumentsByOwnerId = useCallback(
    (ownerId: string) => documents.filter((doc) => doc.ownerId.toLowerCase() === ownerId.toLowerCase()),
    [documents],
  )

  const registerDocument = useCallback(
    async (
      input: Omit<MedicalDocument, "id" | "uploadedAt" | "status" | "documentHash">,
      file: File
    ): Promise<MedicalDocument> => {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask is not installed.")
      }

      // 1. Upload PDF to backend to receive documentId and documentHash
      const uploadRes = await api.uploadDocument(file, input.category, input.description)

      // 2. Submit transaction to Sepolia MediRecordRegistry contract
      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.MediRecordRegistry,
        MediRecordRegistryABI,
        signer
      )

      // registerDocument(bytes32 documentId, bytes32 documentHash)
      const tx = await contract.registerDocument(uploadRes.documentId, uploadRes.documentHash)
      await tx.wait()

      // 3. Construct local document object and update local state
      const nextDocument: MedicalDocument = {
        id: uploadRes.documentId,
        name: uploadRes.fileName,
        category: input.category,
        description: input.description,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        documentHash: uploadRes.documentHash,
        uploadedAt: new Date().toISOString(),
        status: "ACTIVE",
      }

      setDocuments((currentDocs) => [nextDocument, ...currentDocs])
      return nextDocument
    },
    [],
  )

  const value = useMemo<DemoDocumentsContextValue>(
    () => ({
      documents,
      registerDocument,
      findDocumentById,
      findDocumentsByOwnerId,
      refreshDocuments,
    }),
    [documents, registerDocument, findDocumentById, findDocumentsByOwnerId, refreshDocuments],
  )

  return <DemoDocumentsContext.Provider value={value}>{children}</DemoDocumentsContext.Provider>
}

export { DemoDocumentsContext }
