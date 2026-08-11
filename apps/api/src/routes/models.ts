import type { FastifyInstance } from "fastify";
import { prisma } from "@meowcode/database";
import { requireAuth } from "./auth.js";
import { providerService } from "../services/providerService.js";

export async function modelRoutes(app: FastifyInstance) {
  app.get("/v1/models", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const workspaceId =
      (request.query as { workspaceId?: string }).workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId } }
    });
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const models = await providerService.getAvailableModels(workspaceId);

    return {
      object: "list",
      data: models.map((m) => ({
        id: m.id,
        object: "model",
        created: Math.floor(Date.parse(m.discoveredAt) / 1000),
        owned_by: m.providerId,
        providerId: m.providerId,
        displayName: m.displayName,
        family: m.family,
        capabilities: m.capabilities,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        pricing: m.pricing,
        isFree: m.isFree,
        isLocal: m.isLocal,
        qualityScore: m.qualityScore,
        latencyP50Ms: m.latencyP50Ms
      }))
    };
  });
}
