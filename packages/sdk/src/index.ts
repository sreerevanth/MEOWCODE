import type { Conversation, ModelDescriptor, ProviderHealth, Workspace } from "@meowcode/shared";

export interface MeowClientOptions {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  fetchImpl?: typeof fetch;
  onTokensUpdated?: (tokens: { accessToken: string; refreshToken: string }) => void;
}

export interface ProviderSummary {
  id: string | null;
  providerId: string;
  displayName: string;
  description?: string;
  logoUrl?: string;
  defaultEndpoint?: string;
  capabilities?: string[];
  supportsCustomEndpoint?: boolean;
  local?: boolean;
  endpoint?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  isConnected?: boolean;
  healthStatus?: string;
  lastHealthMessage?: string | null;
  lastHealthCheckAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncMessage?: string | null;
  modelsCount?: number;
  hasCredentials?: boolean;
  health?: ProviderHealth;
  latency?: {
    connectionMs?: number | null;
    ttfbMs?: number | null;
    totalMs?: number | null;
    avgMs?: number | null;
    p50Ms?: number | null;
    p95Ms?: number | null;
    lastRequestAt?: string | null;
  };
  healthStats?: {
    failureCount?: number;
    successCount?: number;
    availabilityPct?: number | null;
  };
  timeoutMs?: number;
  retryPolicy?: unknown;
  customHeaders?: Record<string, string> | null;
}

export interface ChatMessageItem {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
  parentId?: string;
  metadata?: unknown;
}

export interface AuthUser {
  id?: string;
  userId?: string;
  email: string;
  name?: string | null;
  onboardingStep?: string;
  workspaceId?: string | null;
  role?: string;
  workspaces?: Array<{ id: string; name: string; slug: string; kind: string; role: string }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UsageSummary {
  workspaceId: string;
  since: string;
  requests: number;
  successRate: number;
  costUsd: number;
  latencyP50Ms: number;
  inputTokens: number;
  outputTokens: number;
  models: number;
}

export class MeowClient {
  private readonly baseUrl: string;
  private apiKey?: string;
  private accessToken?: string;
  private refreshToken?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly onTokensUpdated?: (tokens: { accessToken: string; refreshToken: string }) => void;
  private refreshing: Promise<boolean> | null = null;

  constructor(options: MeowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.onTokensUpdated = options.onTokensUpdated;
  }

  setTokens(accessToken?: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    if (refreshToken !== undefined) this.refreshToken = refreshToken;
  }

  setApiKey(apiKey?: string): void {
    this.apiKey = apiKey;
  }

  signup(data: { email: string; password: string; name?: string }): Promise<AuthTokens & { user: AuthUser }> {
    return this.post("/v1/auth/signup", data, { auth: false });
  }

  login(data: { email: string; password: string }): Promise<AuthTokens & { user: AuthUser }> {
    return this.post("/v1/auth/login", data, { auth: false });
  }

  refresh(): Promise<AuthTokens & { user: AuthUser }> {
    if (!this.refreshToken) throw new Error("No refresh token");
    return this.post("/v1/auth/refresh", { refreshToken: this.refreshToken }, { auth: false });
  }

  logout(): Promise<void> {
    return this.post("/v1/auth/logout", { refreshToken: this.refreshToken }, { auth: true }).then(() => undefined);
  }

  oauthProviders(): Promise<Array<{ id: string; displayName: string; enabled: boolean }>> {
    return this.request("GET", "/v1/auth/oauth/providers", undefined, { auth: false });
  }

  oauthStartUrl(provider: string): string {
    return `${this.baseUrl}/v1/auth/oauth/${provider}`;
  }

  requestMagicLink(email: string): Promise<{ ok: boolean; message: string; link?: string }> {
    return this.post("/v1/auth/magic-link", { email }, { auth: false });
  }

  setSessionTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.onTokensUpdated?.({ accessToken, refreshToken });
  }

  me(): Promise<AuthUser> {
    return this.get("/v1/auth/me");
  }

  updateProfile(data: {
    name?: string;
    preferences?: Record<string, unknown>;
    onboardingStep?: string;
  }): Promise<AuthUser> {
    return this.patch("/v1/auth/me", data);
  }

  switchWorkspace(workspaceId: string): Promise<AuthTokens & { workspaceId: string; role: string }> {
    return this.post("/v1/auth/switch-workspace", { workspaceId });
  }

  workspaces(): Promise<Array<Workspace & { role?: string }>> {
    return this.get("/v1/workspaces");
  }

  createWorkspace(data: { name: string; kind?: "personal" | "team"; slug?: string }): Promise<Workspace & { role?: string }> {
    return this.post("/v1/workspaces", data);
  }

  getWorkspace(id: string): Promise<unknown> {
    return this.get(`/v1/workspaces/${id}`);
  }

  updateWorkspace(id: string, data: unknown): Promise<unknown> {
    return this.patch(`/v1/workspaces/${id}`, data);
  }

  workspaceMembers(id: string): Promise<unknown[]> {
    return this.get(`/v1/workspaces/${id}/members`);
  }

  inviteToWorkspace(id: string, data: { email: string; role?: string }): Promise<unknown> {
    return this.post(`/v1/workspaces/${id}/invites`, data);
  }

  skipInvite(id: string): Promise<{ ok: boolean; onboardingStep: string }> {
    return this.post(`/v1/workspaces/${id}/invites/skip`, {});
  }

  providerCatalog(): Promise<Array<{ providerId: string; displayName: string; description: string; logoUrl?: string; defaultEndpoint: string; capabilities: string[]; supportsCustomEndpoint: boolean; local?: boolean }>> {
    return this.get("/v1/providers/catalog");
  }

  providers(workspaceId?: string): Promise<ProviderSummary[]> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return this.get(`/v1/providers${query}`);
  }

  addProvider(data: {
    providerId: string;
    displayName: string;
    apiKey?: string;
    endpoint?: string;
    organizationId?: string;
    projectId?: string;
    customHeaders?: Record<string, string>;
    timeoutMs?: number;
    retryPolicy?: { maxRetries?: number; backoffMs?: number };
    workspaceId?: string;
  }): Promise<ProviderSummary> {
    return this.post("/v1/providers", data);
  }

  updateProvider(
    id: string,
    data: {
      displayName?: string;
      apiKey?: string;
      endpoint?: string;
      organizationId?: string | null;
      projectId?: string | null;
      customHeaders?: Record<string, string>;
      timeoutMs?: number;
      retryPolicy?: { maxRetries?: number; backoffMs?: number };
    }
  ): Promise<ProviderSummary> {
    return this.patch(`/v1/providers/${id}`, data);
  }

  getProvider(id: string, workspaceId?: string): Promise<ProviderSummary> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return this.get(`/v1/providers/${id}${query}`);
  }

  disconnectProvider(id: string): Promise<{ ok: boolean }> {
    return this.post(`/v1/providers/${id}/disconnect`, {});
  }

  verifyProvider(id: string): Promise<{ ok: boolean; health: ProviderHealth }> {
    return this.post(`/v1/providers/${id}/verify`, {});
  }

  healthCheckProvider(id: string): Promise<{ ok: boolean; health: ProviderHealth }> {
    return this.post(`/v1/providers/${id}/health`, {});
  }

  latencyTestProvider(id: string): Promise<{ ok: boolean; health: ProviderHealth }> {
    return this.post(`/v1/providers/${id}/latency`, {});
  }

  providerCapabilities(id: string): Promise<{ providerId: string; capabilities: string[]; models: ModelDescriptor[] }> {
    return this.get(`/v1/providers/${id}/capabilities`);
  }

  providerStatistics(id: string): Promise<{
    providerId: string;
    connectionId?: string;
    requests: number;
    successRate: number;
    avgLatencyMs: number;
    costUsd: number;
    modelsCount: number;
    lastSeenAt?: string;
  }> {
    return this.get(`/v1/providers/${id}/statistics`);
  }

  syncProvider(id: string): Promise<{ ok: boolean; health: ProviderHealth; modelsCount?: number }> {
    return this.post(`/v1/providers/${id}/sync-models`, {});
  }

  deleteProvider(id: string): Promise<{ ok: boolean }> {
    return this.delete(`/v1/providers/${id}`);
  }

  listApiKeys(workspaceId?: string): Promise<Array<{ id: string; name: string; scopes: string[]; createdAt: string }>> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return this.get(`/v1/auth/api-keys${query}`);
  }

  createApiKey(workspaceId: string, name?: string): Promise<{ id: string; name: string; apiKey: string }> {
    return this.post("/v1/auth/api-keys", { workspaceId, name: name ?? "API Key" });
  }

  revokeApiKey(id: string): Promise<{ ok: boolean }> {
    return this.delete(`/v1/auth/api-keys/${id}`);
  }

  models(workspaceId?: string): Promise<{ object: string; data: ModelDescriptor[] }> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return this.get(`/v1/models${query}`);
  }

  conversations(workspaceId?: string, q?: string): Promise<Conversation[]> {
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspaceId", workspaceId);
    if (q) params.set("q", q);
    const query = params.toString() ? `?${params}` : "";
    return this.get(`/v1/chats${query}`);
  }

  createConversation(title: string, workspaceId?: string): Promise<Conversation> {
    return this.post("/v1/chats", { title, workspaceId });
  }

  updateConversation(
    id: string,
    data: Partial<Pick<Conversation, "title" | "pinned" | "favorite" | "shared" | "folderId">>
  ): Promise<Conversation> {
    return this.patch(`/v1/chats/${id}`, data);
  }

  deleteConversation(id: string): Promise<{ ok: boolean }> {
    return this.delete(`/v1/chats/${id}`);
  }

  messages(conversationId: string): Promise<ChatMessageItem[]> {
    return this.get(`/v1/chats/${conversationId}/messages`);
  }

  updateMessage(conversationId: string, messageId: string, content: string): Promise<ChatMessageItem> {
    return this.patch(`/v1/chats/${conversationId}/messages/${messageId}`, { content });
  }

  deleteMessage(conversationId: string, messageId: string): Promise<{ ok: boolean }> {
    return this.delete(`/v1/chats/${conversationId}/messages/${messageId}`);
  }

  branchConversation(conversationId: string, messageId?: string): Promise<Conversation> {
    return this.post(`/v1/chats/${conversationId}/branch`, { messageId });
  }

  usage(workspaceId?: string, since?: string): Promise<UsageSummary> {
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspaceId", workspaceId);
    if (since) params.set("since", since);
    const query = params.toString() ? `?${params}` : "";
    return this.get(`/v1/usage${query}`);
  }

  async chatCompletions(payload: unknown): Promise<unknown> {
    return this.post("/v1/chat/completions", payload);
  }

  async *chatCompletionsStream(
    payload: Record<string, unknown> & { signal?: AbortSignal }
  ): AsyncIterable<string> {
    await this.ensureFreshToken();
    const { signal, ...body } = payload;
    const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "content-type": "application/json"
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream failed: ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (trimmed === "data: [DONE]") return;
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.error) throw new Error(typeof data.error === "string" ? data.error : data.error.message);
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            } catch (err) {
              if (err instanceof Error && err.message !== "Unexpected end of JSON input") {
                if (err.message.includes("JSON")) continue;
                throw err;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async ensureFreshToken(): Promise<void> {
    if (!this.refreshToken || this.apiKey) return;
    // Lazy refresh only on 401; no-op here
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const result = await this.refresh();
          this.accessToken = result.accessToken;
          this.refreshToken = result.refreshToken;
          this.onTokensUpdated?.({ accessToken: result.accessToken, refreshToken: result.refreshToken });
          return true;
        } catch {
          return false;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown, options?: { auth?: boolean }): Promise<T> {
    return this.request<T>("POST", path, body, options);
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  private async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { auth?: boolean }
  ): Promise<T> {
    const doFetch = async (): Promise<Response> =>
      this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...(options?.auth === false ? {} : this.headers()),
          ...(body !== undefined ? { "content-type": "application/json" } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });

    let response = await doFetch();
    if (response.status === 401 && options?.auth !== false && this.refreshToken) {
      const ok = await this.tryRefresh();
      if (ok) response = await doFetch();
    }

    if (path === "/v1/auth/logout" && (response.status === 204 || response.ok)) {
      return undefined as T;
    }

    return this.decode<T>(response);
  }

  private async decode<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    if (!response.ok) {
      throw new Error(`Meow API error ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  private headers(): Record<string, string> {
    if (this.accessToken) return { authorization: `Bearer ${this.accessToken}` };
    if (this.apiKey) return { authorization: `Bearer ${this.apiKey}` };
    return {};
  }
}
