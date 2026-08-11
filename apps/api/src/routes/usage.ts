import type { FastifyInstance } from "fastify";
import { prisma } from "@meowcode/database";
import { requireAuth } from "./auth.js";

export async function usageRoutes(app: FastifyInstance) {
  app.get("/v1/usage", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const workspaceId =
      (request.query as { workspaceId?: string }).workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId } }
    });
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const sinceParam = (request.query as { since?: string }).since;
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 1000 * 60 * 60 * 24);

    const records = await prisma.usageRecord.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" }
    });

    const requestCount = records.length;
    const successCount = records.filter((r) => r.success).length;
    const totalCost = records.reduce((sum, r) => sum + Number(r.costUsd), 0);
    const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const inputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const outputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);

    const modelsCount = await prisma.model.count({ where: { workspaceId } });

    return {
      workspaceId,
      since: since.toISOString(),
      requests: requestCount,
      successRate: requestCount === 0 ? 1 : successCount / requestCount,
      costUsd: Number(totalCost.toFixed(6)),
      latencyP50Ms: p50,
      inputTokens,
      outputTokens,
      models: modelsCount,
      recent: records.slice(0, 50).map((r) => ({
        id: r.id,
        providerId: r.providerId,
        modelId: r.modelId,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: Number(r.costUsd),
        latencyMs: r.latencyMs,
        success: r.success,
        createdAt: r.createdAt.toISOString()
      }))
    };
  });
}
