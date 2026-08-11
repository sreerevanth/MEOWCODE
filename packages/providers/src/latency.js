import { nowIso } from "@meowcode/shared";
export function mapHttpToHealthStatus(status, latencyMs) {
    if (status === 401 || status === 403)
        return "auth_failed";
    if (status === 404 || status === 502 || status === 503)
        return "invalid_endpoint";
    if (status === 429)
        return "rate_limited";
    if (status >= 500)
        return "offline";
    if (status >= 400)
        return "degraded";
    if (latencyMs > 5000)
        return "slow";
    if (latencyMs > 2000)
        return "degraded";
    return "healthy";
}
export async function measureLatency(url, headers, timeoutMs = 12000) {
    const connectionStart = Date.now();
    let connectionMs = 0;
    let ttfbMs = 0;
    let totalMs = 0;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, { method: "GET", headers, signal: controller.signal });
        connectionMs = Date.now() - connectionStart;
        const reader = response.body?.getReader();
        if (reader) {
            const ttfbStart = Date.now();
            await reader.read();
            ttfbMs = Date.now() - ttfbStart;
            reader.releaseLock();
        }
        else {
            ttfbMs = connectionMs;
        }
        totalMs = Date.now() - connectionStart;
        clearTimeout(timer);
        return {
            connectionMs,
            ttfbMs,
            totalMs,
            latencyMs: totalMs,
            avgMs: totalMs,
            p50Ms: totalMs,
            p95Ms: totalMs,
            lastRequestAt: nowIso()
        };
    }
    catch {
        totalMs = Date.now() - connectionStart;
        return {
            connectionMs,
            ttfbMs: totalMs,
            totalMs,
            latencyMs: totalMs,
            avgMs: totalMs,
            p50Ms: totalMs,
            p95Ms: totalMs,
            lastRequestAt: nowIso()
        };
    }
}
export function computeLatencyAggregates(samples) {
    if (samples.length === 0)
        return {};
    const totals = samples.map((s) => s.totalMs).sort((a, b) => a - b);
    const connections = samples.map((s) => s.connectionMs);
    const ttfbs = samples.map((s) => s.ttfbMs);
    const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const percentile = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
    return {
        connectionMs: avg(connections),
        ttfbMs: avg(ttfbs),
        totalMs: avg(totals),
        avgMs: avg(totals),
        p50Ms: percentile(totals, 0.5),
        p95Ms: percentile(totals, 0.95),
        lastRequestAt: nowIso()
    };
}
export function buildOpenAIHeaders(config) {
    const headers = { ...(config.headers ?? {}) };
    if (config.apiKey)
        headers.authorization = `Bearer ${config.apiKey}`;
    if (config.organizationId)
        headers["OpenAI-Organization"] = config.organizationId;
    if (config.projectId)
        headers["OpenAI-Project"] = config.projectId;
    return headers;
}
export function mapFetchErrorToHealth(error, latencyMs) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("abort") || message.includes("timeout"))
        return "offline";
    if (message.includes("401") || message.includes("403") || message.includes("unauthorized"))
        return "auth_failed";
    if (message.includes("429") || message.includes("rate"))
        return "rate_limited";
    if (message.includes("enotfound") || message.includes("fetch failed") || message.includes("econnrefused")) {
        return "invalid_endpoint";
    }
    if (latencyMs > 5000)
        return "slow";
    return "unknown_error";
}
