import type { FastifyInstance } from "fastify";
import { prisma } from "@meowcode/database";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth, slugify } from "./auth.js";
import { randomBytes } from "node:crypto";

export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/v1/workspaces", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: principal.userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" }
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      kind: m.workspace.kind,
      slug: m.workspace.slug,
      role: m.role,
      createdAt: m.workspace.createdAt.toISOString()
    }));
  });

  app.post("/v1/workspaces", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;

    const body = z
      .object({
        name: z.string().min(1).max(120),
        kind: z.enum(["personal", "team"]).default("personal"),
        slug: z.string().min(1).max(64).optional()
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ error: "Invalid workspace payload", details: body.error.flatten() });
    }

    const baseSlug = slugify(body.data.slug ?? body.data.name) || `ws-${randomBytes(3).toString("hex")}`;
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: body.data.name,
        kind: body.data.kind,
        slug,
        members: {
          create: {
            userId: principal.userId,
            role: "owner"
          }
        },
        settings: {
          create: {
            defaultRoutingMode: "auto",
            theme: "system"
          }
        }
      }
    });

    const user = await prisma.user.findUnique({ where: { id: principal.userId } });
    if (user && user.onboardingStep === "create_workspace") {
      await prisma.user.update({
        where: { id: principal.userId },
        data: { onboardingStep: "invite_team" }
      });
    }

    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: principal.userId,
        action: "workspace.create",
        target: workspace.id,
        metadata: { name: workspace.name, kind: workspace.kind }
      }
    });

    return reply.status(201).send({
      id: workspace.id,
      name: workspace.name,
      kind: workspace.kind,
      slug: workspace.slug,
      role: "owner",
      createdAt: workspace.createdAt.toISOString()
    });
  });

  app.get("/v1/workspaces/:id", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId: id } },
      include: {
        workspace: {
          include: {
            settings: true,
            _count: { select: { members: true, providers: true, models: true, conversations: true } }
          }
        }
      }
    });

    if (!membership) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    return {
      id: membership.workspace.id,
      name: membership.workspace.name,
      kind: membership.workspace.kind,
      slug: membership.workspace.slug,
      role: membership.role,
      settings: membership.workspace.settings,
      counts: membership.workspace._count,
      createdAt: membership.workspace.createdAt.toISOString()
    };
  });

  app.patch("/v1/workspaces/:id", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId: id } }
    });
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        settings: z
          .object({
            defaultRoutingMode: z
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
            defaultModelId: z.string().nullable().optional(),
            theme: z.string().optional(),
            preferences: z.record(z.unknown()).optional()
          })
          .optional()
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ error: "Invalid update payload" });
    }

    if (body.data.name) {
      await prisma.workspace.update({ where: { id }, data: { name: body.data.name } });
    }

    if (body.data.settings) {
      const existingSettings = await prisma.workspaceSettings.findUnique({ where: { workspaceId: id } });
      const mergedPreferences =
        body.data.settings.preferences !== undefined
          ? {
              ...((existingSettings?.preferences as Record<string, unknown> | null) ?? {}),
              ...(body.data.settings.preferences as Record<string, unknown>)
            }
          : undefined;

      await prisma.workspaceSettings.upsert({
        where: { workspaceId: id },
        create: {
          workspaceId: id,
          defaultRoutingMode: body.data.settings.defaultRoutingMode ?? "auto",
          defaultModelId: body.data.settings.defaultModelId ?? undefined,
          theme: body.data.settings.theme ?? "system",
          ...(mergedPreferences !== undefined
            ? { preferences: mergedPreferences as Prisma.InputJsonValue }
            : {})
        },
        update: {
          ...(body.data.settings.defaultRoutingMode
            ? { defaultRoutingMode: body.data.settings.defaultRoutingMode }
            : {}),
          ...(body.data.settings.defaultModelId !== undefined
            ? { defaultModelId: body.data.settings.defaultModelId }
            : {}),
          ...(body.data.settings.theme ? { theme: body.data.settings.theme } : {}),
          ...(mergedPreferences !== undefined
            ? { preferences: mergedPreferences as Prisma.InputJsonValue }
            : {})
        }
      });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: { settings: true }
    });

    return workspace;
  });

  app.get("/v1/workspaces/:id/members", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId: id } }
    });
    if (!membership) return reply.status(404).send({ error: "Workspace not found" });

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: id },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt.toISOString()
    }));
  });

  app.post("/v1/workspaces/:id/invites", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId: id } }
    });
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return reply.status(403).send({ error: "Insufficient permissions to invite" });
    }

    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "developer", "viewer"]).default("developer")
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ error: "Invalid invite payload" });
    }

    const email = body.data.email.toLowerCase().trim();
    const token = `inv_${randomBytes(24).toString("hex")}`;
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: id,
        email,
        role: body.data.role,
        token,
        invitedByUserId: principal.userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
      }
    });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: existingUser.id, workspaceId: id } },
        create: { userId: existingUser.id, workspaceId: id, role: body.data.role },
        update: { role: body.data.role }
      });
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() }
      });
    }

    const user = await prisma.user.findUnique({ where: { id: principal.userId } });
    if (user && user.onboardingStep === "invite_team") {
      await prisma.user.update({
        where: { id: principal.userId },
        data: { onboardingStep: "connect_providers" }
      });
    }

    await prisma.auditLog.create({
      data: {
        workspaceId: id,
        actorUserId: principal.userId,
        action: "workspace.invite",
        target: invite.id,
        metadata: { email, role: body.data.role }
      }
    });

    return reply.status(201).send({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString()
    });
  });

  app.post("/v1/workspaces/:id/invites/skip", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId: id } }
    });
    if (!membership) return reply.status(404).send({ error: "Workspace not found" });

    await prisma.user.update({
      where: { id: principal.userId },
      data: { onboardingStep: "connect_providers" }
    });

    return { ok: true, onboardingStep: "connect_providers" };
  });

  app.get("/v1/workspaces/:id/invites", async (request, reply) => {
    const principal = await requireAuth(request, reply);
    if (!principal) return;
    const { id } = request.params as { id: string };

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: principal.userId, workspaceId: id } }
    });
    if (!membership) return reply.status(404).send({ error: "Workspace not found" });

    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "desc" }
    });

    return invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      acceptedAt: i.acceptedAt?.toISOString() ?? null,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString()
    }));
  });
}
