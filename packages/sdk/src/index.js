export class MeowClient {
    baseUrl;
    apiKey;
    accessToken;
    refreshToken;
    fetchImpl;
    onTokensUpdated;
    refreshing = null;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.accessToken = options.accessToken;
        this.refreshToken = options.refreshToken;
        this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
        this.onTokensUpdated = options.onTokensUpdated;
    }
    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        if (refreshToken !== undefined)
            this.refreshToken = refreshToken;
    }
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
    signup(data) {
        return this.post("/v1/auth/signup", data, { auth: false });
    }
    login(data) {
        return this.post("/v1/auth/login", data, { auth: false });
    }
    refresh() {
        if (!this.refreshToken)
            throw new Error("No refresh token");
        return this.post("/v1/auth/refresh", { refreshToken: this.refreshToken }, { auth: false });
    }
    logout() {
        return this.post("/v1/auth/logout", { refreshToken: this.refreshToken }, { auth: true }).then(() => undefined);
    }
    oauthProviders() {
        return this.request("GET", "/v1/auth/oauth/providers", undefined, { auth: false });
    }
    oauthStartUrl(provider) {
        return `${this.baseUrl}/v1/auth/oauth/${provider}`;
    }
    requestMagicLink(email) {
        return this.post("/v1/auth/magic-link", { email }, { auth: false });
    }
    setSessionTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.onTokensUpdated?.({ accessToken, refreshToken });
    }
    me() {
        return this.get("/v1/auth/me");
    }
    updateProfile(data) {
        return this.patch("/v1/auth/me", data);
    }
    switchWorkspace(workspaceId) {
        return this.post("/v1/auth/switch-workspace", { workspaceId });
    }
    workspaces() {
        return this.get("/v1/workspaces");
    }
    createWorkspace(data) {
        return this.post("/v1/workspaces", data);
    }
    getWorkspace(id) {
        return this.get(`/v1/workspaces/${id}`);
    }
    updateWorkspace(id, data) {
        return this.patch(`/v1/workspaces/${id}`, data);
    }
    workspaceMembers(id) {
        return this.get(`/v1/workspaces/${id}/members`);
    }
    inviteToWorkspace(id, data) {
        return this.post(`/v1/workspaces/${id}/invites`, data);
    }
    skipInvite(id) {
        return this.post(`/v1/workspaces/${id}/invites/skip`, {});
    }
    providerCatalog() {
        return this.get("/v1/providers/catalog");
    }
    providers(workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
        return this.get(`/v1/providers${query}`);
    }
    addProvider(data) {
        return this.post("/v1/providers", data);
    }
    updateProvider(id, data) {
        return this.patch(`/v1/providers/${id}`, data);
    }
    getProvider(id, workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
        return this.get(`/v1/providers/${id}${query}`);
    }
    disconnectProvider(id) {
        return this.post(`/v1/providers/${id}/disconnect`, {});
    }
    verifyProvider(id) {
        return this.post(`/v1/providers/${id}/verify`, {});
    }
    healthCheckProvider(id) {
        return this.post(`/v1/providers/${id}/health`, {});
    }
    latencyTestProvider(id) {
        return this.post(`/v1/providers/${id}/latency`, {});
    }
    providerCapabilities(id) {
        return this.get(`/v1/providers/${id}/capabilities`);
    }
    providerStatistics(id) {
        return this.get(`/v1/providers/${id}/statistics`);
    }
    syncProvider(id) {
        return this.post(`/v1/providers/${id}/sync-models`, {});
    }
    deleteProvider(id) {
        return this.delete(`/v1/providers/${id}`);
    }
    listApiKeys(workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
        return this.get(`/v1/auth/api-keys${query}`);
    }
    createApiKey(workspaceId, name) {
        return this.post("/v1/auth/api-keys", { workspaceId, name: name ?? "API Key" });
    }
    revokeApiKey(id) {
        return this.delete(`/v1/auth/api-keys/${id}`);
    }
    models(workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
        return this.get(`/v1/models${query}`);
    }
    conversations(workspaceId, q) {
        const params = new URLSearchParams();
        if (workspaceId)
            params.set("workspaceId", workspaceId);
        if (q)
            params.set("q", q);
        const query = params.toString() ? `?${params}` : "";
        return this.get(`/v1/chats${query}`);
    }
    createConversation(title, workspaceId) {
        return this.post("/v1/chats", { title, workspaceId });
    }
    updateConversation(id, data) {
        return this.patch(`/v1/chats/${id}`, data);
    }
    deleteConversation(id) {
        return this.delete(`/v1/chats/${id}`);
    }
    messages(conversationId) {
        return this.get(`/v1/chats/${conversationId}/messages`);
    }
    updateMessage(conversationId, messageId, content) {
        return this.patch(`/v1/chats/${conversationId}/messages/${messageId}`, { content });
    }
    deleteMessage(conversationId, messageId) {
        return this.delete(`/v1/chats/${conversationId}/messages/${messageId}`);
    }
    branchConversation(conversationId, messageId) {
        return this.post(`/v1/chats/${conversationId}/branch`, { messageId });
    }
    usage(workspaceId, since) {
        const params = new URLSearchParams();
        if (workspaceId)
            params.set("workspaceId", workspaceId);
        if (since)
            params.set("since", since);
        const query = params.toString() ? `?${params}` : "";
        return this.get(`/v1/usage${query}`);
    }
    async chatCompletions(payload) {
        return this.post("/v1/chat/completions", payload);
    }
    async *chatCompletionsStream(payload) {
        await this.ensureFreshToken();
        const { signal, providerKeys, ...body } = payload;
        const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
                ...this.headers(),
                "content-type": "application/json",
                ...(providerKeys ? { "x-provider-keys": JSON.stringify(providerKeys) } : {})
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
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(":"))
                        continue;
                    if (trimmed === "data: [DONE]")
                        return;
                    if (trimmed.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            if (data.error)
                                throw new Error(typeof data.error === "string" ? data.error : data.error.message);
                            const delta = data.choices?.[0]?.delta?.content;
                            if (delta)
                                yield delta;
                        }
                        catch (err) {
                            if (err instanceof Error && err.message !== "Unexpected end of JSON input") {
                                if (err.message.includes("JSON"))
                                    continue;
                                throw err;
                            }
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    async ensureFreshToken() {
        if (!this.refreshToken || this.apiKey)
            return;
        // Lazy refresh only on 401; no-op here
    }
    async tryRefresh() {
        if (!this.refreshToken)
            return false;
        if (!this.refreshing) {
            this.refreshing = (async () => {
                try {
                    const result = await this.refresh();
                    this.accessToken = result.accessToken;
                    this.refreshToken = result.refreshToken;
                    this.onTokensUpdated?.({ accessToken: result.accessToken, refreshToken: result.refreshToken });
                    return true;
                }
                catch {
                    return false;
                }
                finally {
                    this.refreshing = null;
                }
            })();
        }
        return this.refreshing;
    }
    async get(path) {
        return this.request("GET", path);
    }
    async post(path, body, options) {
        return this.request("POST", path, body, options);
    }
    async patch(path, body) {
        return this.request("PATCH", path, body);
    }
    async delete(path) {
        return this.request("DELETE", path);
    }
    async request(method, path, body, options) {
        const doFetch = async () => this.fetchImpl(`${this.baseUrl}${path}`, {
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
            if (ok)
                response = await doFetch();
        }
        if (path === "/v1/auth/logout" && (response.status === 204 || response.ok)) {
            return undefined;
        }
        return this.decode(response);
    }
    async decode(response) {
        if (response.status === 204)
            return undefined;
        if (!response.ok) {
            throw new Error(`Meow API error ${response.status}: ${await response.text()}`);
        }
        return (await response.json());
    }
    headers() {
        if (this.accessToken)
            return { authorization: `Bearer ${this.accessToken}` };
        if (this.apiKey)
            return { authorization: `Bearer ${this.apiKey}` };
        return {};
    }
}
