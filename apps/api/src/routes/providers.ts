import type { FastifyInstance } from "fastify";
import { prisma } from "@meowcode/database";
import { z } from "zod";
import { requireAuth } from "./auth.js";
import { providerService } from "../services/providerService.js";

async function assertMembership(userId: string, workspaceId: string, minRole?: "viewer" | "developer" | "admin") {
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } }
  });
  if (!membership) return null;
  if (minRole === "developer" && membership.role === "viewer") return null;
  if (minRole === "admin" && membership.role !== "owner" && membership.role !== "admin") return null;
  return membership;
}

const connectSchema = z.object({
  workspaceId: z.string().optional(),
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  apiKey: z.string().optional(),
  endpoint: z.string().url().optional().or(z.literal("")).optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(0).optional(),
      backoffMs: z.number().int().min(0).optional()
    })
    .optional()
});

export async function providerRoutes(app: FastifyInstance) {
  app.get("/v1/providers/catalog", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    return providerService.listCatalog();
  });

  app.get("/v1/providers", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const workspaceId =
      (request.query as { workspaceId?: string }).workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    if (!(await assertMembership(principal.userId, workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return providerService.getWorkspaceProviders(workspaceId);
  });

  app.get("/v1/providers/:id", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };
    const workspaceId =
      (request.query as { workspaceId?: string }).workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    if (!(await assertMembership(principal.userId, workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const card = await providerService.getProviderDetail(workspaceId, id);
    if (!card) return reply.status(404).send({ error: "Provider not found" });
    return card;
  });

  app.post("/v1/providers", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const body = connectSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid provider payload", details: body.error.flatten() });
    }

    const workspaceId = body.data.workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    if (!(await assertMembership(principal.userId, workspaceId, "developer"))) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    try {
      const result = await providerService.connectProvider(workspaceId, {
        providerId: body.data.providerId,
        displayName: body.data.displayName,
        apiKey: body.data.apiKey,
        endpoint: body.data.endpoint || undefined,
        organizationId: body.data.organizationId,
        projectId: body.data.projectId,
        customHeaders: body.data.customHeaders,
        timeoutMs: body.data.timeoutMs,
        retryPolicy: body.data.retryPolicy
      });

      const conn = result.connection!;
      const user = await prisma.user.findUnique({ where: { id: principal.userId } });
      if (user && (user.onboardingStep === "connect_providers" || user.onboardingStep === "verify_providers")) {
        const next =
          conn.healthStatus === "healthy" || conn.healthStatus === "slow" || conn.healthStatus === "degraded"
            ? "sync_models"
            : "verify_providers";
        await prisma.user.update({ where: { id: principal.userId }, data: { onboardingStep: next } });
      }

      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: principal.userId,
          action: "provider.connect",
          target: conn.id,
          metadata: { providerId: conn.providerId }
        }
      });

      return reply.status(201).send(result.card);
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : "Failed to connect provider" });
    }
  });

  app.patch("/v1/providers/:id", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });

    if (!(await assertMembership(principal.userId, conn.workspaceId, "developer"))) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const body = z
      .object({
        displayName: z.string().min(1).optional(),
        apiKey: z.string().optional(),
        endpoint: z.string().optional(),
        organizationId: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
        customHeaders: z.record(z.string()).optional(),
        timeoutMs: z.number().int().positive().optional(),
        retryPolicy: z
          .object({
            maxRetries: z.number().int().min(0).optional(),
            backoffMs: z.number().int().min(0).optional()
          })
          .optional()
      })
      .safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: "Invalid update" });

    const result = await providerService.connectProvider(conn.workspaceId, {
      providerId: conn.providerId,
      displayName: body.data.displayName ?? conn.displayName,
      apiKey: body.data.apiKey,
      endpoint: body.data.endpoint ?? conn.endpoint ?? undefined,
      organizationId: body.data.organizationId ?? conn.organizationId ?? undefined,
      projectId: body.data.projectId ?? conn.projectId ?? undefined,
      customHeaders: body.data.customHeaders ?? (conn.customHeaders as Record<string, string> | undefined),
      timeoutMs: body.data.timeoutMs ?? conn.timeoutMs,
      retryPolicy: body.data.retryPolicy ?? (conn.retryPolicy as { maxRetries?: number; backoffMs?: number } | undefined)
    });

    return result.card;
  });

  app.post("/v1/providers/:id/disconnect", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "developer"))) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    await providerService.disconnectProvider(id);
    await prisma.auditLog.create({
      data: {
        workspaceId: conn.workspaceId,
        actorUserId: principal.userId,
        action: "provider.disconnect",
        target: id
      }
    });
    return { ok: true };
  });

  app.post("/v1/providers/:id/verify", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const health = await providerService.verifyAndSyncProvider(id);
      if (health.status === "healthy" || health.status === "slow" || health.status === "degraded") {
        const user = await prisma.user.findUnique({ where: { id: principal.userId } });
        if (user && user.onboardingStep === "verify_providers") {
          await prisma.user.update({ where: { id: principal.userId }, data: { onboardingStep: "sync_models" } });
        }
      }
      return { ok: isHealthyEnough(health.status), health };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Provider verify failed" });
    }
  });

  app.post("/v1/providers/:id/health", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const health = await providerService.runHealthCheck(id);
      return { ok: isHealthyEnough(health.status), health };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Health check failed" });
    }
  });

  app.post("/v1/providers/:id/latency", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const health = await providerService.runLatencyTest(id);
      return { ok: true, health };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Latency test failed" });
    }
  });

  app.get("/v1/providers/:id/capabilities", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      return await providerService.getCapabilities(id);
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Failed to get capabilities" });
    }
  });

  app.get("/v1/providers/:id/statistics", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      return await providerService.getStatistics(conn.workspaceId, id);
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Failed to get statistics" });
    }
  });

  app.post("/v1/providers/:id/sync", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const { models, health } = await providerService.syncModelsOnly(id);
      await advanceOnboardingIfReady(principal.userId, conn.workspaceId);
      return { ok: true, health, modelsCount: models.length };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : "Model sync failed" });
    }
  });

  app.post("/v1/providers/:id/sync-models", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });
    if (!(await assertMembership(principal.userId, conn.workspaceId, "viewer"))) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const { models, health } = await providerService.syncModelsOnly(id);
      await advanceOnboardingIfReady(principal.userId, conn.workspaceId);
      return { ok: true, health, modelsCount: models.length };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : "Model sync failed" });
    }
  });

  app.delete("/v1/providers/:id", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const conn = await prisma.providerConnection.findUnique({ where: { id } });
    if (!conn) return reply.status(404).send({ error: "Provider not found" });

    if (!(await assertMembership(principal.userId, conn.workspaceId, "admin"))) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    await prisma.providerLatencySample.deleteMany({ where: { providerConnectionId: id } });
    await prisma.providerSyncHistory.deleteMany({ where: { providerConnectionId: id } });
    await prisma.model.deleteMany({ where: { providerConnectionId: id } });
    await prisma.providerConnection.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        workspaceId: conn.workspaceId,
        actorUserId: principal.userId,
        action: "provider.delete",
        target: id
      }
    });

    return { ok: true, deletedId: id };
  });
}

function isHealthyEnough(status: string): boolean {
  return status === "healthy" || status === "slow" || status === "degraded";
}

async function advanceOnboardingIfReady(userId: string, workspaceId: string) {
  const models = await providerService.getAvailableModels(workspaceId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (
    user &&
    (user.onboardingStep === "sync_models" || user.onboardingStep === "verify_providers") &&
    models.length > 0
  ) {
    await prisma.user.update({ where: { id: userId }, data: { onboardingStep: "complete" } });
  }
}
