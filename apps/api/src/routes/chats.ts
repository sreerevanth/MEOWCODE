import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createSecretCipher, getEncryptionKey } from "@meowcode/auth";
import { prisma } from "@meowcode/database";
import { ModelRouter } from "@meowcode/router";
import { resolvePlugin } from "@meowcode/providers";
import type { ModelDescriptor, ProviderConnectionConfig, ProviderHealth, RoutingMode } from "@meowcode/shared";
import { nowIso } from "@meowcode/shared";
import { z } from "zod";
import { requireAuth } from "./auth.js";
import { providerService } from "../services/providerService.js";

const router = new ModelRouter();
const cipher = createSecretCipher(getEncryptionKey());

async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } }
  });
}

export async function chatRoutes(app: FastifyInstance) {
  app.get("/v1/chats", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const workspaceId =
      (request.query as { workspaceId?: string }).workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    const membership = await assertWorkspaceAccess(principal.userId, workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const q = ((request.query as { q?: string }).q ?? "").trim();
    const dbChats = await prisma.conversation.findMany({
      where: {
        workspaceId,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { messages: { some: { content: { contains: q, mode: "insensitive" } } } }
              ]
            }
          : {})
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }]
    });

    return dbChats.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      title: c.title,
      folderId: c.folderId ?? undefined,
      pinned: c.pinned,
      favorite: c.favorite,
      shared: c.shared,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString()
    }));
  });

  app.post("/v1/chats", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        workspaceId: z.string().optional()
      })
      .safeParse(request.body ?? {});

    if (!body.success) {
      return reply.status(400).send({ error: "Invalid chat payload" });
    }

    const workspaceId = body.data.workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    const membership = await assertWorkspaceAccess(principal.userId, workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const conv = await prisma.conversation.create({
      data: {
        workspaceId,
        userId: principal.userId,
        title: body.data.title ?? "New Conversation"
      }
    });

    return reply.status(201).send({
      id: conv.id,
      workspaceId: conv.workspaceId,
      title: conv.title,
      pinned: conv.pinned,
      favorite: conv.favorite,
      shared: conv.shared,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString()
    });
  });

  app.patch("/v1/chats/:id", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const chat = await prisma.conversation.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: "Conversation not found" });

    const membership = await assertWorkspaceAccess(principal.userId, chat.workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        pinned: z.boolean().optional(),
        favorite: z.boolean().optional(),
        shared: z.boolean().optional(),
        folderId: z.string().nullable().optional()
      })
      .safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: "Invalid update" });

    const updated = await prisma.conversation.update({
      where: { id },
      data: body.data
    });

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      title: updated.title,
      folderId: updated.folderId ?? undefined,
      pinned: updated.pinned,
      favorite: updated.favorite,
      shared: updated.shared,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  });

  app.delete("/v1/chats/:id", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };
    const chat = await prisma.conversation.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: "Conversation not found" });
    const membership = await assertWorkspaceAccess(principal.userId, chat.workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });
    await prisma.conversation.delete({ where: { id } });
    return { ok: true };
  });

  app.get("/v1/chats/:id/messages", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const chat = await prisma.conversation.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: "Conversation not found" });
    const membership = await assertWorkspaceAccess(principal.userId, chat.workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" }
    });

    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      parentId: m.parentId ?? undefined,
      metadata: m.metadata,
      createdAt: m.createdAt.toISOString()
    }));
  });

  app.patch("/v1/chats/:id/messages/:messageId", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id, messageId } = request.params as { id: string; messageId: string };

    const chat = await prisma.conversation.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: "Conversation not found" });
    const membership = await assertWorkspaceAccess(principal.userId, chat.workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const body = z.object({ content: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid message update" });

    const message = await prisma.message.findFirst({ where: { id: messageId, conversationId: id } });
    if (!message) return reply.status(404).send({ error: "Message not found" });
    if (message.role !== "user") return reply.status(400).send({ error: "Only user messages can be edited" });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: body.data.content }
    });

    return {
      id: updated.id,
      role: updated.role,
      content: updated.content,
      parentId: updated.parentId ?? undefined,
      metadata: updated.metadata,
      createdAt: updated.createdAt.toISOString()
    };
  });

  app.delete("/v1/chats/:id/messages/:messageId", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id, messageId } = request.params as { id: string; messageId: string };

    const chat = await prisma.conversation.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: "Conversation not found" });
    const membership = await assertWorkspaceAccess(principal.userId, chat.workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const message = await prisma.message.findFirst({ where: { id: messageId, conversationId: id } });
    if (!message) return reply.status(404).send({ error: "Message not found" });

    await prisma.message.delete({ where: { id: messageId } });
    return { ok: true };
  });

  app.post("/v1/chats/:id/branch", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const chat = await prisma.conversation.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: "Conversation not found" });
    const membership = await assertWorkspaceAccess(principal.userId, chat.workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const body = z.object({ messageId: z.string().optional() }).safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: "Invalid branch request" });

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" }
    });

    let cutoff = messages.length;
    if (body.data.messageId) {
      const idx = messages.findIndex((m) => m.id === body.data.messageId);
      if (idx >= 0) cutoff = idx + 1;
    }

    const branch = await prisma.conversation.create({
      data: {
        workspaceId: chat.workspaceId,
        userId: principal.userId,
        title: `${chat.title} (branch)`,
        folderId: chat.folderId
      }
    });

    const toCopy = messages.slice(0, cutoff);
    for (const m of toCopy) {
      await prisma.message.create({
        data: {
          conversationId: branch.id,
          role: m.role,
          content: m.content,
          parentId: m.parentId,
          metadata: m.metadata ?? undefined
        }
      });
    }

    return reply.status(201).send({
      id: branch.id,
      workspaceId: branch.workspaceId,
      title: branch.title,
      folderId: branch.folderId ?? undefined,
      pinned: branch.pinned,
      favorite: branch.favorite,
      shared: branch.shared,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString()
    });
  });

  app.post("/v1/chats/:id/messages", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const chat = await prisma.conversation.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: "Conversation not found" });
    const membership = await assertWorkspaceAccess(principal.userId, chat.workspaceId);
    if (!membership) return reply.status(403).send({ error: "Forbidden" });

    const body = z
      .object({
        content: z.string().min(1),
        parentId: z.string().optional(),
        stream: z.boolean().optional(),
        model: z.string().optional(),
        routing: z
          .object({
            mode: z
              .enum([
                "auto",
                "cheapest",
                "fastest",
                "highest_quality",
                "free_only",
                "local_only",
                "vision",
                "reasoning",
                "manual_provider",
                "manual_model"
              ])
              .optional(),
            manualProviderId: z.string().optional(),
            manualModelId: z.string().optional()
          })
          .optional()
      })
      .safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: "Invalid message payload" });

    const userMessage = await prisma.message.create({
      data: {
        conversationId: id,
        role: "user",
        content: body.data.content,
        parentId: body.data.parentId
      }
    });

    if (chat.title === "New Conversation") {
      const title = body.data.content.slice(0, 80).trim() || "New Conversation";
      await prisma.conversation.update({
        where: { id },
        data: { title, updatedAt: new Date() }
      });
    } else {
      await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    }

    const history = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" }
    });

    request.body = {
      model: body.data.model,
      stream: body.data.stream ?? true,
      workspaceId: chat.workspaceId,
      conversationId: id,
      routing: body.data.routing,
      messages: history.map((m) => ({
        role: m.role as "system" | "user" | "assistant" | "tool",
        content: m.content
      })),
      _userMessageId: userMessage.id
    };

    return completeChat(request, reply);
  });

  app.post("/v1/chat/completions", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    return completeChat(request, reply);
  });

  app.post("/v1/responses", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const body = request.body as { input?: string; workspaceId?: string };
    const workspaceId = body.workspaceId || principal.workspaceId;
    if (!workspaceId) return reply.status(400).send({ error: "No workspace selected" });

    request.body = {
      workspaceId,
      messages: [{ role: "user", content: body.input ?? "" }],
      stream: false
    };
    return completeChat(request, reply);
  });
}

async function completeChat(request: FastifyRequest, reply: FastifyReply) {
  const principal = request.principal!;
  const body = request.body as {
    model?: string;
    messages?: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    workspaceId?: string;
    conversationId?: string;
    persistUser?: boolean;
    routing?: {
      mode?: RoutingMode;
      manualProviderId?: string;
      manualModelId?: string;
    };
  };

  const workspaceId = body.workspaceId || principal.workspaceId;
  if (!workspaceId) {
    return reply.status(400).send({ error: "No workspace selected" });
  }

  const membership = await assertWorkspaceAccess(principal.userId, workspaceId);
  if (!membership) return reply.status(403).send({ error: "Forbidden" });

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return reply.status(400).send({ error: "messages are required" });
  }

  if (body.conversationId && body.persistUser !== false) {
    const chat = await prisma.conversation.findUnique({ where: { id: body.conversationId } });
    if (!chat || chat.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Conversation not found" });
    }
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      const existing = await prisma.message.findFirst({
        where: { conversationId: body.conversationId },
        orderBy: { createdAt: "desc" }
      });
      if (!existing || existing.role !== "user" || existing.content !== lastUser.content) {
        await prisma.message.create({
          data: {
            conversationId: body.conversationId,
            role: "user",
            content: lastUser.content
          }
        });
      }
      if (chat.title === "New Conversation") {
        await prisma.conversation.update({
          where: { id: body.conversationId },
          data: { title: lastUser.content.slice(0, 80).trim() || "New Conversation", updatedAt: new Date() }
        });
      }
    }
  }

  const models = await providerService.getAvailableModels(workspaceId);
  if (models.length === 0) {
    return reply.status(400).send({
      error: "No synchronized models available. Connect and sync a provider first."
    });
  }

  const connections = await prisma.providerConnection.findMany({
    where: { workspaceId, isConnected: true }
  });
  const connectedProviderIds = new Set(connections.map((c) => c.providerId));
  const healthMap = new Map<string, ProviderHealth>();
  for (const conn of connections) {
    healthMap.set(conn.providerId, {
      status: conn.healthStatus as ProviderHealth["status"],
      checkedAt: conn.lastHealthCheckAt?.toISOString() ?? nowIso(),
      message: conn.lastHealthMessage ?? undefined,
      latencyMs: conn.latencyP50Ms ?? conn.latencyAvgMs ?? undefined,
      latency: {
        connectionMs: conn.latencyConnectionMs ?? undefined,
        ttfbMs: conn.latencyTtfbMs ?? undefined,
        totalMs: conn.latencyTotalMs ?? undefined,
        avgMs: conn.latencyAvgMs ?? undefined,
        p50Ms: conn.latencyP50Ms ?? undefined,
        p95Ms: conn.latencyP95Ms ?? undefined,
        lastRequestAt: conn.lastRequestAt?.toISOString()
      },
      failureCount: conn.healthFailureCount,
      successCount: conn.healthSuccessCount,
      availabilityPct: conn.availabilityPct ? Number(conn.availabilityPct) : undefined
    });
  }

  let routePlan;
  try {
    routePlan = router.route({
      mode: body.routing?.mode ?? (body.model ? "manual_model" : "auto"),
      models,
      healthByProvider: healthMap,
      connectedProviderIds,
      manualModelId: body.model ?? body.routing?.manualModelId,
      manualProviderId: body.routing?.manualProviderId
    });
  } catch (err) {
    return reply.status(400).send({
      error: err instanceof Error ? err.message : "Routing failed"
    });
  }

  const targetModel = routePlan.primary;
  let connectionConfig: ProviderConnectionConfig = { providerId: targetModel.providerId };

  const dbConn = await prisma.providerConnection.findFirst({
    where: { workspaceId, providerId: targetModel.providerId }
  });
  if (dbConn) {
    connectionConfig = {
      providerId: dbConn.providerId,
      apiKey: dbConn.encryptedApiKey ? await cipher.decrypt(dbConn.encryptedApiKey) : undefined,
      endpoint: dbConn.endpoint ?? undefined,
      organizationId: dbConn.organizationId ?? undefined,
      projectId: dbConn.projectId ?? undefined,
      headers: (dbConn.customHeaders as Record<string, string> | null) ?? undefined,
      timeoutMs: dbConn.timeoutMs,
      retryPolicy: (dbConn.retryPolicy as ProviderConnectionConfig["retryPolicy"]) ?? undefined
    };
  }

  const plugin = resolvePlugin(
    providerService.defaultRegistry,
    targetModel.providerId,
    targetModel.displayName,
    dbConn?.endpoint ?? undefined
  );

  const startedAt = Date.now();

  const persistAssistant = async (content: string, metadata?: Record<string, unknown>) => {
    if (!body.conversationId || !content) return null;
    const msg = await prisma.message.create({
      data: {
        conversationId: body.conversationId,
        role: "assistant",
        content,
        metadata: {
          modelId: targetModel.id,
          providerId: targetModel.providerId,
          routeReason: routePlan.reason,
          ...metadata
        }
      }
    });
    await prisma.conversation.update({
      where: { id: body.conversationId },
      data: { updatedAt: new Date() }
    });
    return msg;
  };

  const recordUsage = async (params: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    success: boolean;
    costUsd?: number;
  }) => {
    await prisma.usageRecord.create({
      data: {
        workspaceId,
        providerId: targetModel.providerId,
        modelId: targetModel.id,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        costUsd: params.costUsd ?? estimateCost(targetModel, params.inputTokens, params.outputTokens),
        latencyMs: params.latencyMs,
        success: params.success
      }
    });
  };

  if (body.stream && plugin.streamChat) {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });

    let fullContent = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let success = true;

    try {
      const stream = plugin.streamChat({
        config: connectionConfig,
        model: targetModel,
        messages,
        temperature: body.temperature,
        maxTokens: body.max_tokens
      });

      for await (const event of stream) {
        if (event.type === "content_delta") {
          fullContent += event.delta;
          reply.raw.write(
            `data: ${JSON.stringify({
              choices: [{ delta: { content: event.delta } }],
              model: targetModel.id
            })}\n\n`
          );
        } else if (event.type === "usage") {
          inputTokens = event.inputTokens;
          outputTokens = event.outputTokens;
        } else if (event.type === "done") {
          reply.raw.write("data: [DONE]\n\n");
        } else if (event.type === "error") {
          success = false;
          reply.raw.write(`data: ${JSON.stringify({ error: event.message })}\n\n`);
        }
      }
    } catch (err) {
      success = false;
      const message = err instanceof Error ? err.message : "Provider stream failed";
      reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      reply.raw.write("data: [DONE]\n\n");
    }

    await persistAssistant(fullContent, { streamed: true });
    await recordUsage({
      inputTokens,
      outputTokens: outputTokens || Math.ceil(fullContent.length / 4),
      latencyMs: Date.now() - startedAt,
      success
    });

    reply.raw.end();
    return;
  }

  try {
    const response = await plugin.chat({
      config: connectionConfig,
      model: targetModel,
      messages,
      temperature: body.temperature,
      maxTokens: body.max_tokens
    });

    const latencyMs = Date.now() - startedAt;
    await persistAssistant(response.content, { streamed: false });
    await recordUsage({
      inputTokens: response.inputTokens ?? 0,
      outputTokens: response.outputTokens ?? 0,
      latencyMs,
      success: true
    });

    return {
      id: `chatcmpl_${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: targetModel.id,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: response.content },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: response.inputTokens ?? 0,
        completion_tokens: response.outputTokens ?? 0,
        total_tokens: (response.inputTokens ?? 0) + (response.outputTokens ?? 0)
      },
      routing: {
        mode: body.routing?.mode ?? (body.model ? "manual_model" : "auto"),
        reason: routePlan.reason,
        providerId: targetModel.providerId
      }
    };
  } catch (err) {
    await recordUsage({
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      success: false
    });
    return reply.status(502).send({
      error: err instanceof Error ? err.message : "Provider request failed",
      model: targetModel.id,
      providerId: targetModel.providerId
    });
  }
}

function estimateCost(model: ModelDescriptor, inputTokens: number, outputTokens: number): number {
  const inputRate = model.pricing?.inputPerMillion ?? 0;
  const outputRate = model.pricing?.outputPerMillion ?? 0;
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}
