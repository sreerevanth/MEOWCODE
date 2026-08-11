import { nowIso } from "@meowcode/shared";
import { inferCapabilitiesFromModel, parseContextWindow, parsePricing, PROVIDER_DEFINITIONS } from "./definitions.js";
import { buildOpenAIHeaders, mapFetchErrorToHealth, mapHttpToHealthStatus, measureLatency } from "./latency.js";
export class ProviderRegistry {
    plugins = new Map();
    register(plugin) {
        if (this.plugins.has(plugin.id)) {
            throw new Error(`Provider plugin already registered: ${plugin.id}`);
        }
        this.plugins.set(plugin.id, plugin);
    }
    get(providerId) {
        const plugin = this.plugins.get(providerId);
        if (!plugin) {
            throw new Error(`Provider plugin not registered: ${providerId}`);
        }
        return plugin;
    }
    has(providerId) {
        return this.plugins.has(providerId);
    }
    list() {
        return [...this.plugins.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
}
export class OpenAICompatibleProvider {
    id;
    displayName;
    description;
    logoUrl;
    supportsCustomEndpoint;
    capabilities;
    defaultEndpoint;
    local;
    requiresApiKey;
    constructor(options) {
        this.id = options.id;
        this.displayName = options.displayName;
        this.description = options.description;
        this.logoUrl = options.logoUrl;
        this.defaultEndpoint = options.defaultEndpoint.replace(/\/$/, "");
        this.local = options.local ?? false;
        this.requiresApiKey = options.requiresApiKey ?? !this.local;
        this.supportsCustomEndpoint = options.supportsCustomEndpoint ?? true;
        this.capabilities = options.capabilities ?? ["chat", "responses", "embeddings", "vision", "tools", "json", "streaming"];
    }
    async verify(config) {
        const started = Date.now();
        try {
            const response = await fetch(`${this.endpoint(config)}/models`, {
                headers: this.headers(config),
                signal: AbortSignal.timeout(config.timeoutMs ?? 8000)
            });
            const latencyMs = Date.now() - started;
            const status = mapHttpToHealthStatus(response.status, latencyMs);
            return {
                status: response.ok ? status : status,
                latencyMs,
                checkedAt: nowIso(),
                message: response.ok ? undefined : `Model endpoint returned ${response.status}`
            };
        }
        catch (error) {
            const latencyMs = Date.now() - started;
            return {
                status: mapFetchErrorToHealth(error, latencyMs),
                latencyMs,
                checkedAt: nowIso(),
                message: error instanceof Error ? error.message : "Connection failed"
            };
        }
    }
    async measureLatency(config) {
        const latency = await measureLatency(`${this.endpoint(config)}/models`, this.headers(config), config.timeoutMs ?? 12000);
        const verify = await this.verify(config);
        return {
            ...verify,
            latencyMs: latency.latencyMs,
            latency,
            checkedAt: nowIso()
        };
    }
    async listModels(config) {
        const response = await fetch(`${this.endpoint(config)}/models`, {
            headers: this.headers(config),
            signal: AbortSignal.timeout(config.timeoutMs ?? 12000)
        });
        if (!response.ok) {
            throw new Error(`Failed to list models for ${this.id}: ${response.status}`);
        }
        const payload = (await response.json());
        return (payload.data ?? []).map((model) => {
            const metadata = model;
            const pricing = parsePricing(metadata);
            return {
                id: model.id,
                providerId: this.id,
                displayName: model.id,
                family: model.owned_by,
                capabilities: inferCapabilitiesFromModel(model.id, this.capabilities, metadata),
                contextWindow: parseContextWindow(metadata, model.id),
                pricing: pricing.inputPerMillion || pricing.outputPerMillion ? { ...pricing, currency: "USD" } : undefined,
                isLocal: this.local,
                isFree: this.local,
                discoveredAt: nowIso(),
                metadata
            };
        });
    }
    async chat(request) {
        const response = await fetch(`${this.endpoint(request.config)}/chat/completions`, {
            method: "POST",
            headers: {
                ...this.headers(request.config),
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: request.model.id,
                messages: request.messages,
                temperature: request.temperature,
                max_tokens: request.maxTokens,
                tools: request.tools,
                response_format: request.responseFormat
            }),
            signal: request.signal
        });
        if (!response.ok) {
            throw new Error(`Chat completion failed for ${this.id}/${request.model.id}: ${response.status}`);
        }
        const payload = await response.json();
        return {
            id: String(payload.id ?? crypto.randomUUID()),
            content: String(payload.choices?.[0]?.message?.content ?? ""),
            modelId: request.model.id,
            providerId: this.id,
            inputTokens: payload.usage?.prompt_tokens,
            outputTokens: payload.usage?.completion_tokens,
            raw: payload
        };
    }
    async *streamChat(request) {
        let responseId = crypto.randomUUID();
        const response = await fetch(`${this.endpoint(request.config)}/chat/completions`, {
            method: "POST",
            headers: {
                ...this.headers(request.config),
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: request.model.id,
                messages: request.messages,
                temperature: request.temperature,
                max_tokens: request.maxTokens,
                tools: request.tools,
                response_format: request.responseFormat,
                stream: true
            }),
            signal: request.signal
        });
        if (!response.ok || !response.body) {
            yield { type: "error", message: `Stream request failed for ${this.id}: ${response.status}` };
            yield { type: "done", responseId };
            return;
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
                    if (trimmed === "data: [DONE]") {
                        yield { type: "done", responseId };
                        return;
                    }
                    if (trimmed.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            if (data.id)
                                responseId = data.id;
                            const delta = data.choices?.[0]?.delta?.content;
                            if (delta) {
                                yield { type: "content_delta", delta };
                            }
                            if (data.usage) {
                                yield {
                                    type: "usage",
                                    inputTokens: data.usage.prompt_tokens ?? 0,
                                    outputTokens: data.usage.completion_tokens ?? 0
                                };
                            }
                        }
                        catch {
                            // Ignore invalid JSON chunks from dynamic SSE streams
                        }
                    }
                }
            }
            yield { type: "done", responseId };
        }
        catch (err) {
            yield { type: "error", message: err instanceof Error ? err.message : "Stream error" };
        }
        finally {
            reader.releaseLock();
        }
    }
    endpoint(config) {
        return (config.endpoint ?? this.defaultEndpoint).replace(/\/$/, "");
    }
    headers(config) {
        return buildOpenAIHeaders(config);
    }
}
export class AnthropicProvider {
    id = "anthropic";
    displayName = "Anthropic";
    description = "Claude family models with tool use, vision, and long context.";
    logoUrl = "https://cdn.simpleicons.org/anthropic";
    defaultEndpoint = "https://api.anthropic.com/v1";
    supportsCustomEndpoint = false;
    capabilities = ["chat", "vision", "tools", "json", "reasoning", "streaming"];
    local = false;
    requiresApiKey = true;
    headers(config) {
        const headers = {
            "anthropic-version": "2023-06-01",
            ...(config.headers ?? {})
        };
        if (config.apiKey)
            headers["x-api-key"] = config.apiKey;
        return headers;
    }
    async verify(config) {
        const started = Date.now();
        try {
            const response = await fetch(`${this.defaultEndpoint}/models`, {
                headers: this.headers(config),
                signal: AbortSignal.timeout(config.timeoutMs ?? 8000)
            });
            const latencyMs = Date.now() - started;
            return {
                status: response.ok ? mapHttpToHealthStatus(response.status, latencyMs) : mapHttpToHealthStatus(response.status, latencyMs),
                latencyMs,
                checkedAt: nowIso(),
                message: response.ok ? undefined : `Anthropic returned ${response.status}`
            };
        }
        catch (error) {
            const latencyMs = Date.now() - started;
            return {
                status: mapFetchErrorToHealth(error, latencyMs),
                latencyMs,
                checkedAt: nowIso(),
                message: error instanceof Error ? error.message : "Connection failed"
            };
        }
    }
    async measureLatency(config) {
        const latency = await measureLatency(`${this.defaultEndpoint}/models`, this.headers(config), config.timeoutMs ?? 12000);
        const verify = await this.verify(config);
        return { ...verify, latencyMs: latency.latencyMs, latency, checkedAt: nowIso() };
    }
    async listModels(config) {
        const response = await fetch(`${this.defaultEndpoint}/models`, {
            headers: this.headers(config),
            signal: AbortSignal.timeout(config.timeoutMs ?? 12000)
        });
        if (!response.ok) {
            throw new Error(`Failed to list Anthropic models: ${response.status}`);
        }
        const payload = (await response.json());
        return (payload.data ?? []).map((model) => ({
            id: model.id,
            providerId: this.id,
            displayName: model.display_name ?? model.id,
            family: "claude",
            capabilities: inferCapabilitiesFromModel(model.id, this.capabilities),
            contextWindow: parseContextWindow(undefined, model.id),
            discoveredAt: nowIso()
        }));
    }
    async chat(request) {
        const system = request.messages.find((m) => m.role === "system")?.content;
        const messages = request.messages.filter((m) => m.role !== "system").map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content
        }));
        const response = await fetch(`${this.defaultEndpoint}/messages`, {
            method: "POST",
            headers: { ...this.headers(request.config), "content-type": "application/json" },
            body: JSON.stringify({
                model: request.model.id,
                max_tokens: request.maxTokens ?? 4096,
                system,
                messages,
                temperature: request.temperature
            }),
            signal: request.signal
        });
        if (!response.ok) {
            throw new Error(`Anthropic chat failed: ${response.status}`);
        }
        const payload = await response.json();
        const content = Array.isArray(payload.content)
            ? payload.content.map((b) => b.text ?? "").join("")
            : "";
        return {
            id: String(payload.id ?? crypto.randomUUID()),
            content,
            modelId: request.model.id,
            providerId: this.id,
            inputTokens: payload.usage?.input_tokens,
            outputTokens: payload.usage?.output_tokens,
            raw: payload
        };
    }
}
export { PROVIDER_DEFINITIONS, getProviderDefinition } from "./definitions.js";
export { computeLatencyAggregates, measureLatency } from "./latency.js";
export function createDefaultProviderRegistry() {
    const registry = new ProviderRegistry();
    registry.register(new AnthropicProvider());
    for (const def of PROVIDER_DEFINITIONS) {
        if (def.providerId === "anthropic")
            continue;
        registry.register(new OpenAICompatibleProvider({
            id: def.providerId,
            displayName: def.displayName,
            description: def.description,
            logoUrl: def.logoUrl,
            defaultEndpoint: def.defaultEndpoint,
            capabilities: def.capabilities,
            local: def.local,
            requiresApiKey: def.requiresApiKey,
            supportsCustomEndpoint: def.supportsCustomEndpoint
        }));
    }
    return registry;
}
export function resolvePlugin(registry, providerId, displayName, endpoint) {
    if (registry.has(providerId)) {
        return registry.get(providerId);
    }
    return new OpenAICompatibleProvider({
        id: providerId,
        displayName,
        defaultEndpoint: endpoint ?? "http://localhost:8000/v1",
        description: "Custom OpenAI-compatible provider"
    });
}
