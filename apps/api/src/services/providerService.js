import { createSecretCipher, getEncryptionKey } from "@meowcode/auth";
import { prisma } from "@meowcode/database";
import { computeLatencyAggregates, createDefaultProviderRegistry, getProviderDefinition, resolvePlugin } from "@meowcode/providers";
import { nowIso } from "@meowcode/shared";
const cipher = createSecretCipher(getEncryptionKey());
function isHealthyEnough(status) {
    return status === "healthy" || status === "slow" || status === "degraded";
}
export class ProviderService {
    defaultRegistry = createDefaultProviderRegistry();
    listCatalog() {
        return this.defaultRegistry.list().map((provider) => ({
            providerId: provider.id,
            displayName: provider.displayName,
            description: provider.description ?? "",
            logoUrl: provider.logoUrl,
            defaultEndpoint: provider.defaultEndpoint,
            capabilities: provider.capabilities,
            supportsCustomEndpoint: provider.supportsCustomEndpoint,
            local: provider.local,
            requiresApiKey: provider.requiresApiKey
        }));
    }
    getPlugin(providerId, displayName, endpoint) {
        return resolvePlugin(this.defaultRegistry, providerId, displayName, endpoint ?? undefined);
    }
    async buildConfig(connection) {
        return {
            providerId: connection.providerId,
            apiKey: undefined,
            endpoint: connection.endpoint ?? undefined,
            organizationId: connection.organizationId ?? undefined,
            projectId: connection.projectId ?? undefined,
            headers: connection.customHeaders ?? undefined,
            timeoutMs: connection.timeoutMs,
            retryPolicy: connection.retryPolicy ?? undefined
        };
    }
    toCard(catalog, conn) {
        const def = getProviderDefinition(catalog.id);
        return {
            id: conn?.id ?? null,
            providerId: catalog.id,
            displayName: conn?.displayName ?? catalog.displayName,
            description: catalog.description ?? def?.description ?? "",
            logoUrl: catalog.logoUrl ?? def?.logoUrl,
            defaultEndpoint: catalog.defaultEndpoint,
            endpoint: conn?.endpoint ?? null,
            organizationId: conn?.organizationId ?? null,
            projectId: conn?.projectId ?? null,
            isConnected: conn?.isConnected ?? false,
            hasCredentials: true,
            healthStatus: conn?.healthStatus ?? "unknown",
            lastHealthMessage: conn?.lastHealthMessage ?? null,
            lastHealthCheckAt: conn?.lastHealthCheckAt?.toISOString() ?? null,
            lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
            lastSyncStatus: conn?.lastSyncStatus ?? null,
            lastSyncMessage: conn?.lastSyncMessage ?? null,
            modelsCount: conn?._count?.models ?? 0,
            capabilities: catalog.capabilities,
            supportsCustomEndpoint: catalog.supportsCustomEndpoint,
            local: catalog.local ?? false,
            latency: {
                connectionMs: conn?.latencyConnectionMs ?? null,
                ttfbMs: conn?.latencyTtfbMs ?? null,
                totalMs: conn?.latencyTotalMs ?? null,
                avgMs: conn?.latencyAvgMs ?? null,
                p50Ms: conn?.latencyP50Ms ?? null,
                p95Ms: conn?.latencyP95Ms ?? null,
                lastRequestAt: conn?.lastRequestAt?.toISOString() ?? null
            },
            health: {
                failureCount: conn?.healthFailureCount ?? 0,
                successCount: conn?.healthSuccessCount ?? 0,
                availabilityPct: conn?.availabilityPct ? Number(conn.availabilityPct) : null
            },
            timeoutMs: conn?.timeoutMs ?? 60000,
            retryPolicy: conn?.retryPolicy ?? null,
            customHeaders: conn?.customHeaders ?? null
        };
    }
    async getWorkspaceProviders(workspaceId) {
        const connections = await prisma.providerConnection.findMany({
            where: { workspaceId },
            include: { _count: { select: { models: true } } },
            orderBy: { createdAt: "asc" }
        });
        const byProviderId = new Map(connections.map((c) => [c.providerId, c]));
        const cards = [];
        for (const plugin of this.defaultRegistry.list()) {
            cards.push(this.toCard(plugin, byProviderId.get(plugin.id)));
        }
        for (const conn of connections) {
            if (!this.defaultRegistry.has(conn.providerId)) {
                const plugin = this.getPlugin(conn.providerId, conn.displayName, conn.endpoint);
                cards.push(this.toCard(plugin, conn));
            }
        }
        return cards.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    async getProviderDetail(workspaceId, connectionId) {
        const conn = await prisma.providerConnection.findFirst({
            where: { id: connectionId, workspaceId },
            include: { _count: { select: { models: true } } }
        });
        if (!conn)
            return null;
        const plugin = this.getPlugin(conn.providerId, conn.displayName, conn.endpoint);
        return this.toCard(plugin, conn);
    }
    async connectProvider(workspaceId, data) {
        const plugin = this.getPlugin(data.providerId, data.displayName, data.endpoint);
        const def = getProviderDefinition(data.providerId);
        const connection = await prisma.providerConnection.upsert({
            where: {
                workspaceId_providerId: { workspaceId, providerId: data.providerId }
            },
            create: {
                workspaceId,
                providerId: data.providerId,
                displayName: data.displayName,
                endpoint: data.endpoint ?? def?.defaultEndpoint,
                organizationId: data.organizationId,
                projectId: data.projectId,
                customHeaders: data.customHeaders,
                timeoutMs: data.timeoutMs ?? 60000,
                retryPolicy: data.retryPolicy,
                isConnected: false,
                healthStatus: "unknown"
            },
            update: {
                displayName: data.displayName,
                endpoint: data.endpoint ?? undefined,
                organizationId: data.organizationId,
                projectId: data.projectId,
                customHeaders: data.customHeaders,
                timeoutMs: data.timeoutMs,
                retryPolicy: data.retryPolicy
            }
        });
        const health = await this.runFullConnectionFlow(connection.id, plugin);
        const updated = await prisma.providerConnection.findUnique({
            where: { id: connection.id },
            include: { _count: { select: { models: true } } }
        });
        return { connection: updated, health, card: updated ? this.toCard(plugin, updated) : null };
    }
    async upsertProvider(workspaceId, data) {
        const result = await this.connectProvider(workspaceId, data);
        return result.connection;
    }
    async runFullConnectionFlow(connectionId, plugin) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        const config = await this.buildConfig(connection);
        if (plugin.measureLatency) {
            await plugin.measureLatency(config);
        }
        const health = await this.recordHealthCheck(connectionId, () => plugin.verify(config));
        if (isHealthyEnough(health.status)) {
            await this.syncModelsForProvider(connection.workspaceId, connectionId, plugin, config);
            await prisma.providerConnection.update({
                where: { id: connectionId },
                data: { isConnected: true, lastSeenAt: new Date() }
            });
        }
        else {
            await prisma.providerConnection.update({
                where: { id: connectionId },
                data: { isConnected: false }
            });
        }
        return health;
    }
    async disconnectProvider(connectionId) {
        await prisma.providerConnection.update({
            where: { id: connectionId },
            data: {
                isConnected: false,
                healthStatus: "unknown",
                lastHealthMessage: "Disconnected by user"
            }
        });
    }
    async recordHealthCheck(connectionId, check) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        const health = await check();
        const success = isHealthyEnough(health.status);
        const failureCount = connection.healthFailureCount + (success ? 0 : 1);
        const successCount = connection.healthSuccessCount + (success ? 1 : 0);
        const total = failureCount + successCount;
        const availabilityPct = total > 0 ? (successCount / total) * 100 : success ? 100 : 0;
        await prisma.providerConnection.update({
            where: { id: connectionId },
            data: {
                healthStatus: health.status,
                lastHealthMessage: health.message,
                lastHealthCheckAt: new Date(),
                healthFailureCount: failureCount,
                healthSuccessCount: successCount,
                availabilityPct,
                ...(health.latencyMs != null ? { latencyTotalMs: health.latencyMs, latencyAvgMs: health.latencyMs } : {}),
                ...(health.latency?.connectionMs != null ? { latencyConnectionMs: health.latency.connectionMs } : {}),
                ...(health.latency?.ttfbMs != null ? { latencyTtfbMs: health.latency.ttfbMs } : {}),
                ...(health.latency?.p50Ms != null ? { latencyP50Ms: health.latency.p50Ms } : {}),
                ...(health.latency?.p95Ms != null ? { latencyP95Ms: health.latency.p95Ms } : {}),
                lastLatencyCheckAt: health.latency ? new Date() : undefined,
                lastRequestAt: health.latency?.lastRequestAt ? new Date(health.latency.lastRequestAt) : undefined
            }
        });
        return {
            ...health,
            failureCount,
            successCount,
            availabilityPct,
            checkedAt: nowIso()
        };
    }
    async verifyAndSyncProvider(connectionId) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        const plugin = this.getPlugin(connection.providerId, connection.displayName, connection.endpoint);
        const config = await this.buildConfig(connection);
        const health = await this.recordHealthCheck(connectionId, () => plugin.verify(config));
        if (isHealthyEnough(health.status)) {
            await this.syncModelsForProvider(connection.workspaceId, connectionId, plugin, config);
            await prisma.providerConnection.update({
                where: { id: connectionId },
                data: { isConnected: true, lastSeenAt: new Date() }
            });
        }
        return health;
    }
    async runHealthCheck(connectionId) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        if (!connection.isConnected) {
            return { status: "unknown", checkedAt: nowIso(), message: "Provider is disconnected" };
        }
        const plugin = this.getPlugin(connection.providerId, connection.displayName, connection.endpoint);
        const config = await this.buildConfig(connection);
        return this.recordHealthCheck(connectionId, () => plugin.verify(config));
    }
    async runLatencyTest(connectionId) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        const plugin = this.getPlugin(connection.providerId, connection.displayName, connection.endpoint);
        const config = await this.buildConfig(connection);
        const measure = plugin.measureLatency ?? plugin.verify.bind(plugin);
        const health = await this.recordHealthCheck(connectionId, () => measure(config));
        const samples = await prisma.providerLatencySample.findMany({
            where: { providerConnectionId: connectionId },
            orderBy: { recordedAt: "desc" },
            take: 20
        });
        if (health.latency?.connectionMs != null && health.latency.ttfbMs != null && health.latency.totalMs != null) {
            await prisma.providerLatencySample.create({
                data: {
                    providerConnectionId: connectionId,
                    connectionMs: health.latency.connectionMs,
                    ttfbMs: health.latency.ttfbMs,
                    totalMs: health.latency.totalMs
                }
            });
        }
        const aggregates = computeLatencyAggregates(samples.map((s) => ({ connectionMs: s.connectionMs, ttfbMs: s.ttfbMs, totalMs: s.totalMs })));
        await prisma.providerConnection.update({
            where: { id: connectionId },
            data: {
                latencyConnectionMs: aggregates.connectionMs,
                latencyTtfbMs: aggregates.ttfbMs,
                latencyTotalMs: aggregates.totalMs,
                latencyAvgMs: aggregates.avgMs,
                latencyP50Ms: aggregates.p50Ms,
                latencyP95Ms: aggregates.p95Ms,
                lastLatencyCheckAt: new Date(),
                lastRequestAt: aggregates.lastRequestAt ? new Date(aggregates.lastRequestAt) : undefined
            }
        });
        return { ...health, latency: aggregates, checkedAt: nowIso() };
    }
    async getCapabilities(connectionId) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        const models = await this.getAvailableModels(connection.workspaceId, connection.providerId);
        const capabilitySet = new Set();
        for (const model of models) {
            for (const cap of model.capabilities)
                capabilitySet.add(cap);
        }
        const plugin = this.getPlugin(connection.providerId, connection.displayName, connection.endpoint);
        for (const cap of plugin.capabilities)
            capabilitySet.add(cap);
        return {
            providerId: connection.providerId,
            capabilities: [...capabilitySet],
            models
        };
    }
    async getStatistics(workspaceId, connectionId) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId, workspaceId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const records = await prisma.usageRecord.findMany({
            where: { workspaceId, providerId: connection.providerId, createdAt: { gte: since } }
        });
        const modelsCount = await prisma.model.count({
            where: { workspaceId, providerId: connection.providerId }
        });
        const requests = records.length;
        const successes = records.filter((r) => r.success).length;
        const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);
        const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : connection.latencyAvgMs ?? 0;
        const costUsd = records.reduce((sum, r) => sum + Number(r.costUsd), 0);
        return {
            providerId: connection.providerId,
            connectionId,
            requests,
            successRate: requests > 0 ? successes / requests : connection.availabilityPct ? Number(connection.availabilityPct) / 100 : 0,
            avgLatencyMs,
            costUsd,
            modelsCount,
            lastSeenAt: connection.lastSeenAt?.toISOString()
        };
    }
    async syncModelsForProvider(workspaceId, connectionId, plugin, config) {
        const startedAt = new Date();
        let models = [];
        let status = "success";
        let message;
        try {
            models = await plugin.listModels(config);
            for (const model of models) {
                await prisma.model.upsert({
                    where: {
                        workspaceId_providerId_modelId: {
                            workspaceId,
                            providerId: config.providerId,
                            modelId: model.id
                        }
                    },
                    create: {
                        workspaceId,
                        providerConnectionId: connectionId,
                        providerId: config.providerId,
                        modelId: model.id,
                        displayName: model.displayName,
                        family: model.family,
                        capabilities: model.capabilities,
                        contextWindow: model.contextWindow,
                        maxOutputTokens: model.maxOutputTokens,
                        inputPerMillionUsd: model.pricing?.inputPerMillion,
                        outputPerMillionUsd: model.pricing?.outputPerMillion,
                        isFree: model.isFree ?? false,
                        isLocal: model.isLocal ?? false,
                        qualityScore: model.qualityScore,
                        latencyP50Ms: model.latencyP50Ms,
                        metadata: model.metadata,
                        discoveredAt: new Date()
                    },
                    update: {
                        displayName: model.displayName,
                        family: model.family,
                        capabilities: model.capabilities,
                        contextWindow: model.contextWindow,
                        maxOutputTokens: model.maxOutputTokens,
                        inputPerMillionUsd: model.pricing?.inputPerMillion,
                        outputPerMillionUsd: model.pricing?.outputPerMillion,
                        isFree: model.isFree ?? false,
                        isLocal: model.isLocal ?? false,
                        qualityScore: model.qualityScore,
                        latencyP50Ms: model.latencyP50Ms,
                        metadata: model.metadata,
                        updatedAt: new Date()
                    }
                });
            }
        }
        catch (err) {
            status = "failed";
            message = err instanceof Error ? err.message : "Model sync failed";
            throw err;
        }
        finally {
            const completedAt = new Date();
            await prisma.providerSyncHistory.create({
                data: {
                    providerConnectionId: connectionId,
                    status,
                    modelsDiscovered: models.length,
                    message,
                    startedAt,
                    completedAt,
                    durationMs: completedAt.getTime() - startedAt.getTime()
                }
            });
            await prisma.providerConnection.update({
                where: { id: connectionId },
                data: {
                    lastSyncAt: completedAt,
                    lastSyncStatus: status,
                    lastSyncMessage: message ?? `${models.length} models synchronized`,
                    lastSeenAt: status === "success" ? completedAt : undefined
                }
            });
        }
        return models;
    }
    async syncModelsOnly(connectionId) {
        const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new Error(`Provider connection ${connectionId} not found`);
        const plugin = this.getPlugin(connection.providerId, connection.displayName, connection.endpoint);
        const config = await this.buildConfig(connection);
        const health = await plugin.verify(config);
        const models = await this.syncModelsForProvider(connection.workspaceId, connectionId, plugin, config);
        return { models, health };
    }
    async getAvailableModels(workspaceId, providerId) {
        const dbModels = await prisma.model.findMany({
            where: { workspaceId, ...(providerId ? { providerId } : {}) },
            orderBy: [{ providerId: "asc" }, { displayName: "asc" }]
        });
        return dbModels.map((m) => ({
            id: m.modelId,
            providerId: m.providerId,
            displayName: m.displayName,
            family: m.family ?? undefined,
            capabilities: m.capabilities,
            contextWindow: m.contextWindow ?? undefined,
            maxOutputTokens: m.maxOutputTokens ?? undefined,
            pricing: m.inputPerMillionUsd != null || m.outputPerMillionUsd != null
                ? {
                    inputPerMillion: m.inputPerMillionUsd ? Number(m.inputPerMillionUsd) : undefined,
                    outputPerMillion: m.outputPerMillionUsd ? Number(m.outputPerMillionUsd) : undefined,
                    currency: "USD"
                }
                : undefined,
            isFree: m.isFree,
            isLocal: m.isLocal,
            qualityScore: m.qualityScore ?? undefined,
            latencyP50Ms: m.latencyP50Ms ?? undefined,
            metadata: m.metadata ?? undefined,
            discoveredAt: m.discoveredAt.toISOString()
        }));
    }
    async runPeriodicHealthChecks() {
        const connections = await prisma.providerConnection.findMany({
            where: { isConnected: true }
        });
        for (const connection of connections) {
            try {
                const plugin = this.getPlugin(connection.providerId, connection.displayName, connection.endpoint);
                const config = await this.buildConfig(connection);
                await this.recordHealthCheck(connection.id, () => plugin.verify(config));
            }
            catch {
                // Continue checking other providers
            }
        }
    }
}
export const providerService = new ProviderService();
