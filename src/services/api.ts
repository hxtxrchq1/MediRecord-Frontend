const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";

export function getToken(): string | null {
  return localStorage.getItem("medirecord-auth-token");
}

export function setToken(token: string) {
  localStorage.setItem("medirecord-auth-token", token);
}

export function removeToken() {
  localStorage.removeItem("medirecord-auth-token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
  } as Record<string, string>;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  async getChallenge(wallet: string): Promise<string> {
    const data = await request(`/auth/challenge?wallet=${wallet}`);
    return data.nonce;
  },

  async verifySignature(wallet: string, signature: string): Promise<{ token: string; wallet: string; role: string }> {
    const data = await request(`/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, signature }),
    });
    setToken(data.token);
    return data;
  },

  // Profile
  async getProfile(): Promise<{ wallet: string; role: string; registeredAt: string; status: string }> {
    return request(`/auth/profile`);
  },

  // Admin: list all registered users
  async getAllUsers(): Promise<Array<{ wallet: string; displayName: string | null; role: string; registeredAt: string; status: string }>> {
    return request(`/auth/users`);
  },

  // Update own display name
  async updateProfile(displayName: string): Promise<{ wallet: string; displayName: string; role: string }> {
    return request(`/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
  },

  // Admin: update any user's display name
  async updateUserName(wallet: string, displayName: string): Promise<{ wallet: string; displayName: string; role: string }> {
    return request(`/auth/users/${wallet}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
  },

  // Patients: Search registered doctors, clinics, insurance
  async getRecipients(): Promise<Array<{ wallet: string; displayName: string | null; role: string; registeredAt: string; status: string }>> {
    return request(`/auth/recipients`);
  },


  // Documents
  async uploadDocument(file: File, category: string, description: string): Promise<{ documentId: string; documentHash: string; fileName: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("description", description);

    const token = getToken();
    const headers = {} as Record<string, string>;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  async getMyDocuments(): Promise<any[]> {
    return request(`/documents`);
  },

  async getDocumentDetails(documentId: string): Promise<any> {
    return request(`/documents/${documentId}`);
  },

  async downloadDocument(documentId: string, fileName: string): Promise<void> {
    const token = getToken();
    const headers = {} as Record<string, string>;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/documents/${documentId}/file`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to download file");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Permissions
  async syncPermission(payload: {
    permissionId: string;
    tokenId: number;
    documentId: string;
    authorizedWallet: string;
    expiresAt: number;
    txHash: string;
  }): Promise<any> {
    return request(`/permissions/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async syncRevocation(permissionId: string): Promise<any> {
    return request(`/permissions/sync-revocation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionId }),
    });
  },

  async getIssuedPermissions(): Promise<any[]> {
    return request(`/permissions/issued`);
  },

  async getReceivedPermissions(): Promise<any[]> {
    return request(`/permissions/received`);
  },

  async getAuditAll(): Promise<any[]> {
    return request(`/permissions/audit`);
  },

  async getAccessLogs(documentId: string): Promise<any[]> {
    return request(`/permissions/audit/${documentId}`);
  },
};
