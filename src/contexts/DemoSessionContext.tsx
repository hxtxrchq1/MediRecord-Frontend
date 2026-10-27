import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { BrowserProvider } from "ethers"
import { api, getToken, removeToken } from "@/services/api"
import type { User, UserRole } from "@/types/user"
import type { WalletState } from "@/types/wallet"

interface DemoSessionContextValue {
  currentUser: User
  currentRole: UserRole
  walletState: WalletState
  isConnected: boolean
  availableUsers: readonly User[]
  connectDemoUser: (userId?: string) => Promise<void>
  disconnectDemoSession: () => void
  switchDemoUser: (userId: string) => void
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null)

const SEPOLIA_CHAIN_ID = "0xaa36a7"

const initialWalletState: WalletState = {
  connectionStatus: "DISCONNECTED",
  networkStatus: "UNKNOWN",
  registrationStatus: "UNREGISTERED",
  address: null,
  chainId: null,
  errorMessage: null,
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>(initialWalletState)
  const [currentUser, setCurrentUser] = useState<User>({
    id: "disconnected",
    walletAddress: "",
    role: "PATIENT",
    fullName: "Usuario no conectado",
    status: "ACTIVE",
  })

  const isConnected = useMemo(
    () => walletState.connectionStatus === "CONNECTED",
    [walletState.connectionStatus],
  )

  // Auto-reconnect if JWT is already present in localStorage
  useEffect(() => {
    const token = getToken()
    if (token) {
      api.getProfile()
        .then((profile: any) => {
          const shortWallet = `${profile.wallet.slice(0, 6)}...${profile.wallet.slice(-4)}`
          const roleLabels: Record<string, string> = {
            ADMIN: 'Administrador', PATIENT: 'Paciente', DOCTOR: 'Médico',
            CLINIC: 'Clínica', INSURANCE: 'Aseguradora',
          }
          const name = profile.displayName || `${roleLabels[profile.role] ?? profile.role} (${shortWallet})`
          setCurrentUser({
            id: profile.wallet,
            walletAddress: profile.wallet,
            role: profile.role as UserRole,
            fullName: name,
            status: "ACTIVE",
          })
          setWalletState({
            connectionStatus: "CONNECTED",
            networkStatus: "SEPOLIA",
            registrationStatus: "REGISTERED",
            address: profile.wallet,
            chainId: SEPOLIA_CHAIN_ID,
            errorMessage: null,
          })
        })
        .catch(() => {
          removeToken()
        })
    }
  }, [])

  const connectWallet = useCallback(async () => {
    const ethereum = (window as any).ethereum
    if (typeof window === "undefined" || !ethereum) {
      setWalletState((prev) => ({
        ...prev,
        errorMessage: "METAMASK_NOT_INSTALLED",
      }))
      return
    }

    try {
      setWalletState((prev) => ({
        ...prev,
        connectionStatus: "CONNECTING",
        errorMessage: null,
      }))

      // 1. Request accounts
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      }) as string[]
      
      if (!accounts || accounts.length === 0) {
        throw new Error("CONNECTION_REJECTED")
      }
      const walletAddress = accounts[0].toLowerCase()

      // 2. Validate and Switch Network to Sepolia
      let chainId = await ethereum.request({ method: "eth_chainId" }) as string
      if (chainId !== SEPOLIA_CHAIN_ID) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          })
          chainId = SEPOLIA_CHAIN_ID
        } catch (switchError: any) {
          // Try adding the Sepolia network if it's not present
          if (switchError.code === 4902) {
            try {
              await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: SEPOLIA_CHAIN_ID,
                    chainName: "Sepolia Test Network",
                    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                    rpcUrls: ["https://ethereum-sepolia.publicnode.com"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io"],
                  },
                ],
              })
              chainId = SEPOLIA_CHAIN_ID
            } catch (addError) {
              setWalletState((prev) => ({
                ...prev,
                connectionStatus: "DISCONNECTED",
                networkStatus: "WRONG_NETWORK",
                errorMessage: "WRONG_NETWORK",
              }))
              return
            }
          } else {
            setWalletState((prev) => ({
              ...prev,
              connectionStatus: "DISCONNECTED",
              networkStatus: "WRONG_NETWORK",
              errorMessage: "WRONG_NETWORK",
            }))
            return
          }
        }
      }

      // 3. Cryptographic Challenge-Response Authentication
      const nonce = await api.getChallenge(walletAddress)
      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const signature = await signer.signMessage(nonce)

      // Submit signature to backend
      let authData
      try {
        authData = await api.verifySignature(walletAddress, signature)
      } catch (authError: any) {
        if (authError.message.includes("not registered")) {
          setWalletState((prev) => ({
            ...prev,
            connectionStatus: "DISCONNECTED",
            registrationStatus: "UNREGISTERED",
            errorMessage: "UNREGISTERED_USER",
          }))
          return
        }
        throw authError;
      }

      // 4. Successful login
      const shortWallet = `${authData.wallet.slice(0, 6)}...${authData.wallet.slice(-4)}`
      const roleLabels: Record<string, string> = {
        ADMIN: 'Administrador', PATIENT: 'Paciente', DOCTOR: 'Médico',
        CLINIC: 'Clínica', INSURANCE: 'Aseguradora',
      }
      const roleLabel = roleLabels[authData.role] ?? authData.role
      // Fetch profile to get displayName if set
      let displayName = `${roleLabel} (${shortWallet})`
      try {
        const profile = await api.getProfile() as any
        if (profile.displayName) displayName = profile.displayName
      } catch {}

      setCurrentUser({
        id: authData.wallet,
        walletAddress: authData.wallet,
        role: authData.role as UserRole,
        fullName: displayName,
        status: "ACTIVE",
      })

      setWalletState({
        connectionStatus: "CONNECTED",
        networkStatus: "SEPOLIA",
        registrationStatus: "REGISTERED",
        address: authData.wallet,
        chainId: SEPOLIA_CHAIN_ID,
        errorMessage: null,
      })

    } catch (err: any) {
      console.error("MetaMask connection error:", err)
      const errorKind = err.message === "CONNECTION_REJECTED" ? "CONNECTION_REJECTED" : "UNKNOWN_ERROR"
      setWalletState((prev) => ({
        ...prev,
        connectionStatus: "DISCONNECTED",
        errorMessage: errorKind,
      }))
    }
  }, [])

  const disconnectSession = useCallback(() => {
    removeToken()
    setCurrentUser({
      id: "disconnected",
      walletAddress: "",
      role: "PATIENT",
      fullName: "Usuario no conectado",
      status: "ACTIVE",
    })
    setWalletState(initialWalletState)
  }, [])

  // Listen to accountsChanged and chainChanged events from MetaMask
  useEffect(() => {
    const ethereum = (window as any).ethereum
    if (typeof window === "undefined" || !ethereum) {
      return
    }

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectSession()
      } else if (walletState.connectionStatus === "CONNECTED" && accounts[0].toLowerCase() !== walletState.address?.toLowerCase()) {
        // Re-authenticate if account changes
        connectWallet()
      }
    }

    const handleChainChanged = () => {
      // Reload page on chain change as recommended by MetaMask
      window.location.reload()
    }

    ethereum.on("accountsChanged", handleAccountsChanged)
    ethereum.on("chainChanged", handleChainChanged)

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged)
        ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [walletState, disconnectSession, connectWallet])

  const value = useMemo<DemoSessionContextValue>(
    () => ({
      currentUser,
      currentRole: currentUser.role,
      walletState,
      isConnected,
      availableUsers: [],
      connectDemoUser: connectWallet,
      disconnectDemoSession: disconnectSession,
      switchDemoUser: () => {},
    }),
    [currentUser, walletState, isConnected, connectWallet, disconnectSession],
  )

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>
}

export { DemoSessionContext }