import { generateApiKey, generateRefreshToken, getAuthSecret, hashApiKey, hashPassword, signAccessToken, toSessionPrincipal, verifyAccessToken, verifyPassword } from "@meowcode/auth";
import { prisma } from "@meowcode/database";
import { z } from "zod";
import { buildAuthorizeUrl, buildDevOAuthProfile, buildWebCallbackUrl, consumeMagicLinkToken, createMagicLinkToken, exchangeOAuthCode, findOrCreateOAuthUser, getOAuthProvider, getOAuthProviders, provisionPersonalWorkspace, signOAuthState, verifyOAuthState } from "../services/oauthService.js";
const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(120).optional()
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});
const refreshSchema = z.object({
    refreshToken: z.string().min(10)
});
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30;
function slugify(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
}
async function issueTokens(params) {
    const refresh = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const session = params.sessionId
        ? await prisma.session.update({
            where: { id: params.sessionId },
            data: {
                refreshTokenHash: refresh.hash,
                expiresAt,
                revokedAt: null,
                userAgent: params.userAgent,
                ipAddress: params.ipAddress
            }
        })
        : await prisma.session.create({
            data: {
                userId: params.userId,
                refreshTokenHash: refresh.hash,
                expiresAt,
                userAgent: params.userAgent,
                ipAddress: params.ipAddress
            }
        });
    const accessToken = signAccessToken({
        sub: params.userId,
        email: params.email,
        workspaceId: params.workspaceId,
        role: params.role,
        sessionId: session.id,
        authProvider: params.authProvider ?? "email",
        mfaVerified: true
    }, getAuthSecret());
    return {
        accessToken,
        refreshToken: refresh.token,
        expiresIn: 60 * 15,
        tokenType: "Bearer",
        sessionId: session.id
    };
}
export async function resolvePrincipal(request) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return null;
    const token = header.slice("Bearer ".length).trim();
    if (!token)
        return null;
    if (token.startsWith("meow_")) {
        const keyHash = hashApiKey(token);
        const apiKey = await prisma.apiKey.findFirst({
            where: { keyHash, revokedAt: null },
            include: {
                workspace: {
                    include: {
                        members: { take: 1, orderBy: { createdAt: "asc" } }
                    }
                }
            }
        });
        if (!apiKey)
            return null;
        if (apiKey.expiresAt && apiKey.expiresAt < new Date())
            return null;
        await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() }
        });
        const owner = apiKey.workspace.members[0];
        const user = owner
            ? await prisma.user.findUnique({ where: { id: owner.userId } })
            : null;
        return {
            userId: user?.id ?? "api_key",
            email: user?.email ?? "api-key@meowcode.local",
            workspaceId: apiKey.workspaceId,
            role: owner?.role ?? "developer",
            authProvider: "api_key",
            mfaVerified: true
        };
    }
    try {
        const payload = verifyAccessToken(token, getAuthSecret());
        const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
            return null;
        }
        return toSessionPrincipal(payload);
    }
    catch {
        return null;
    }
}
export async function requireAuth(request, reply) {
    const principal = await resolvePrincipal(request);
    if (!principal) {
        reply.status(401).send({ error: "Unauthorized" });
        return null;
    }
    request.principal = principal;
    return principal;
}
export async function authRoutes(app) {
    app.post("/v1/auth/signup", async (request, reply) => {
        const parsed = signupSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: "Invalid signup payload", details: parsed.error.flatten() });
        }
        const email = parsed.data.email.toLowerCase().trim();
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return reply.status(409).send({ error: "An account with this email already exists" });
        }
        const user = await prisma.user.create({
            data: {
                email,
                name: parsed.data.name ?? email.split("@")[0],
                passwordHash: hashPassword(parsed.data.password),
                onboardingStep: "complete"
            }
        });
        const { membership } = await provisionPersonalWorkspace(user.id, user.name ?? email.split("@")[0]);
        const tokens = await issueTokens({
            userId: user.id,
            email: user.email,
            workspaceId: membership.workspaceId,
            role: membership.role,
            userAgent: request.headers["user-agent"],
            ipAddress: request.ip
        });
        await prisma.auditLog.create({
            data: {
                actorUserId: user.id,
                action: "auth.signup",
                target: user.id,
                metadata: { email: user.email }
            }
        });
        return reply.status(201).send({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                onboardingStep: user.onboardingStep,
                workspaceId: membership.workspaceId
            },
            ...tokens
        });
    });
    app.post("/v1/auth/login", async (request, reply) => {
        const parsed = loginSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: "Invalid login payload" });
        }
        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                memberships: { orderBy: { createdAt: "asc" }, take: 1 }
            }
        });
        if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
            return reply.status(401).send({ error: "Invalid email or password" });
        }
        let membership = user.memberships[0];
        if (!membership) {
            const provisioned = await provisionPersonalWorkspace(user.id, user.name ?? email.split("@")[0]);
            membership = provisioned.membership;
            if (user.onboardingStep === "create_workspace") {
                await prisma.user.update({ where: { id: user.id }, data: { onboardingStep: "complete" } });
            }
        }
        const tokens = await issueTokens({
            userId: user.id,
            email: user.email,
            workspaceId: membership.workspaceId,
            role: membership.role,
            userAgent: request.headers["user-agent"],
            ipAddress: request.ip
        });
        await prisma.auditLog.create({
            data: {
                workspaceId: membership?.workspaceId,
                actorUserId: user.id,
                action: "auth.login",
                target: user.id
            }
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                onboardingStep: user.onboardingStep,
                workspaceId: membership?.workspaceId ?? null
            },
            ...tokens
        };
    });
    app.post("/v1/auth/refresh", async (request, reply) => {
        const parsed = refreshSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: "refreshToken is required" });
        }
        const hash = hashApiKey(parsed.data.refreshToken);
        const session = await prisma.session.findFirst({
            where: { refreshTokenHash: hash, revokedAt: null },
            include: {
                user: {
                    include: {
                        memberships: { orderBy: { createdAt: "asc" }, take: 1 }
                    }
                }
            }
        });
        if (!session || session.expiresAt < new Date()) {
            return reply.status(401).send({ error: "Invalid or expired refresh token" });
        }
        const membership = session.user.memberships[0];
        const tokens = await issueTokens({
            userId: session.userId,
            email: session.user.email,
            workspaceId: membership?.workspaceId ?? "",
            role: membership?.role ?? "owner",
            userAgent: request.headers["user-agent"],
            ipAddress: request.ip,
            sessionId: session.id
        });
        return {
            user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
                onboardingStep: session.user.onboardingStep,
                workspaceId: membership?.workspaceId ?? null
            },
            ...tokens
        };
    });
    app.post("/v1/auth/logout", async (request, reply) => {
        const principal = await resolvePrincipal(request);
        if (principal?.sessionId) {
            await prisma.session.update({
                where: { id: principal.sessionId },
                data: { revokedAt: new Date() }
            });
        }
        const body = request.body;
        if (body?.refreshToken) {
            const hash = hashApiKey(body.refreshToken);
            await prisma.session.updateMany({
                where: { refreshTokenHash: hash },
                data: { revokedAt: new Date() }
            });
        }
        return reply.status(204).send();
    });
    app.get("/v1/auth/me", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const user = await prisma.user.findUnique({
            where: { id: principal.userId },
            include: {
                memberships: {
                    include: { workspace: true },
                    orderBy: { createdAt: "asc" }
                }
            }
        });
        if (!user) {
            return reply.status(404).send({ error: "User not found" });
        }
        const activeMembership = user.memberships.find((m) => m.workspaceId === principal.workspaceId) ?? user.memberships[0];
        return {
            userId: user.id,
            email: user.email,
            name: user.name,
            imageUrl: user.imageUrl,
            onboardingStep: user.onboardingStep,
            preferences: user.preferences,
            workspaceId: activeMembership?.workspaceId ?? null,
            role: activeMembership?.role ?? principal.role,
            authProvider: principal.authProvider,
            mfaVerified: principal.mfaVerified,
            workspaces: user.memberships.map((m) => ({
                id: m.workspace.id,
                name: m.workspace.name,
                slug: m.workspace.slug,
                kind: m.workspace.kind,
                role: m.role
            }))
        };
    });
    app.patch("/v1/auth/me", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const body = z
            .object({
            name: z.string().min(1).max(120).optional(),
            preferences: z.record(z.unknown()).optional(),
            onboardingStep: z
                .enum([
                "create_workspace",
                "invite_team",
                "connect_providers",
                "verify_providers",
                "sync_models",
                "complete"
            ])
                .optional()
        })
            .safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({ error: "Invalid profile update" });
        }
        const user = await prisma.user.update({
            where: { id: principal.userId },
            data: {
                ...(body.data.name !== undefined ? { name: body.data.name } : {}),
                ...(body.data.preferences !== undefined
                    ? { preferences: body.data.preferences }
                    : {}),
                ...(body.data.onboardingStep !== undefined ? { onboardingStep: body.data.onboardingStep } : {})
            }
        });
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            onboardingStep: user.onboardingStep,
            preferences: user.preferences
        };
    });
    app.post("/v1/auth/switch-workspace", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const body = z.object({ workspaceId: z.string().min(1) }).safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({ error: "workspaceId is required" });
        }
        const membership = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: principal.userId,
                    workspaceId: body.data.workspaceId
                }
            },
            include: { user: true }
        });
        if (!membership) {
            return reply.status(403).send({ error: "Not a member of this workspace" });
        }
        const tokens = await issueTokens({
            userId: membership.userId,
            email: membership.user.email,
            workspaceId: membership.workspaceId,
            role: membership.role,
            userAgent: request.headers["user-agent"],
            ipAddress: request.ip,
            sessionId: principal.sessionId
        });
        return {
            workspaceId: membership.workspaceId,
            role: membership.role,
            ...tokens
        };
    });
    app.post("/v1/auth/api-keys", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const body = z
            .object({
            name: z.string().min(1).max(120).optional(),
            workspaceId: z.string().optional(),
            scopes: z.array(z.string()).optional()
        })
            .safeParse(request.body ?? {});
        if (!body.success) {
            return reply.status(400).send({ error: "Invalid API key request" });
        }
        const workspaceId = body.data.workspaceId ?? principal.workspaceId;
        if (!workspaceId) {
            return reply.status(400).send({ error: "No workspace selected" });
        }
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: principal.userId, workspaceId } }
        });
        if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
            return reply.status(403).send({ error: "Insufficient permissions to create API keys" });
        }
        const { key, hash } = generateApiKey();
        const dbKey = await prisma.apiKey.create({
            data: {
                workspaceId,
                name: body.data.name ?? "CLI Key",
                keyHash: hash,
                scopes: body.data.scopes ?? ["full"]
            }
        });
        await prisma.auditLog.create({
            data: {
                workspaceId,
                actorUserId: principal.userId,
                action: "api_key.create",
                target: dbKey.id
            }
        });
        return reply.status(201).send({
            id: dbKey.id,
            name: dbKey.name,
            apiKey: key,
            scopes: dbKey.scopes,
            createdAt: dbKey.createdAt.toISOString()
        });
    });
    app.get("/v1/auth/api-keys", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const workspaceId = request.query.workspaceId ?? principal.workspaceId;
        if (!workspaceId)
            return reply.status(400).send({ error: "No workspace selected" });
        const keys = await prisma.apiKey.findMany({
            where: { workspaceId, revokedAt: null },
            orderBy: { createdAt: "desc" }
        });
        return keys.map((k) => ({
            id: k.id,
            name: k.name,
            scopes: k.scopes,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            expiresAt: k.expiresAt?.toISOString() ?? null,
            createdAt: k.createdAt.toISOString()
        }));
    });
    app.delete("/v1/auth/api-keys/:id", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const { id } = request.params;
        const key = await prisma.apiKey.findUnique({ where: { id } });
        if (!key)
            return reply.status(404).send({ error: "API key not found" });
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: principal.userId, workspaceId: key.workspaceId } }
        });
        if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
            return reply.status(403).send({ error: "Insufficient permissions" });
        }
        await prisma.apiKey.update({
            where: { id },
            data: { revokedAt: new Date() }
        });
        return { ok: true };
    });
    app.get("/v1/auth/oauth/providers", async () => {
        return getOAuthProviders();
    });
    app.get("/v1/auth/oauth/:provider", async (request, reply) => {
        const { provider } = request.params;
        const config = getOAuthProvider(provider);
        if (!config)
            return reply.status(404).send({ error: "Unknown OAuth provider" });
        if (!config.clientId || !config.clientSecret) {
            if (process.env.MEOW_OAUTH_DEV === "true") {
                return reply.redirect(`/v1/auth/oauth/${provider}/dev`);
            }
            return reply.status(503).send({ error: `${config.displayName} OAuth is not configured` });
        }
        const state = signOAuthState(provider);
        return reply.redirect(buildAuthorizeUrl(config, state));
    });
    app.get("/v1/auth/oauth/:provider/dev", async (request, reply) => {
        if (process.env.MEOW_OAUTH_DEV !== "true" && process.env.NODE_ENV === "production") {
            return reply.status(404).send({ error: "Not found" });
        }
        const { provider } = request.params;
        if (!getOAuthProvider(provider))
            return reply.status(404).send({ error: "Unknown provider" });
        const profile = buildDevOAuthProfile(provider);
        const { user, membership, isNew } = await findOrCreateOAuthUser(profile);
        const tokens = await issueTokens({
            userId: user.id,
            email: user.email,
            workspaceId: membership.workspaceId,
            role: membership.role,
            userAgent: request.headers["user-agent"],
            ipAddress: request.ip,
            authProvider: provider
        });
        await prisma.auditLog.create({
            data: {
                workspaceId: membership.workspaceId,
                actorUserId: user.id,
                action: isNew ? "auth.oauth_signup" : "auth.oauth_login",
                target: user.id,
                metadata: { provider }
            }
        });
        return reply.redirect(buildWebCallbackUrl(tokens.accessToken, tokens.refreshToken));
    });
    app.get("/v1/auth/oauth/:provider/callback", async (request, reply) => {
        const { provider } = request.params;
        const query = request.query;
        if (query.error) {
            return reply.redirect(`${buildWebCallbackUrl("", "").split("/auth")[0]}/auth?error=${encodeURIComponent(query.error)}`);
        }
        if (!query.code || !query.state || !verifyOAuthState(query.state, provider)) {
            return reply.status(400).send({ error: "Invalid OAuth callback" });
        }
        const config = getOAuthProvider(provider);
        if (!config?.clientId || !config.clientSecret) {
            return reply.status(503).send({ error: "OAuth provider not configured" });
        }
        try {
            const { profile } = await exchangeOAuthCode(config, query.code);
            const { user, membership, isNew } = await findOrCreateOAuthUser(profile);
            const tokens = await issueTokens({
                userId: user.id,
                email: user.email,
                workspaceId: membership.workspaceId,
                role: membership.role,
                userAgent: request.headers["user-agent"],
                ipAddress: request.ip,
                authProvider: provider
            });
            await prisma.auditLog.create({
                data: {
                    workspaceId: membership.workspaceId,
                    actorUserId: user.id,
                    action: isNew ? "auth.oauth_signup" : "auth.oauth_login",
                    target: user.id,
                    metadata: { provider }
                }
            });
            return reply.redirect(buildWebCallbackUrl(tokens.accessToken, tokens.refreshToken));
        }
        catch (err) {
            return reply.status(502).send({
                error: err instanceof Error ? err.message : "OAuth authentication failed"
            });
        }
    });
    app.post("/v1/auth/magic-link", async (request, reply) => {
        const body = z.object({ email: z.string().email() }).safeParse(request.body);
        if (!body.success)
            return reply.status(400).send({ error: "Valid email required" });
        const email = body.data.email.toLowerCase().trim();
        const token = createMagicLinkToken(email);
        const webBase = (process.env.MEOW_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
        const link = `${webBase}/auth/callback?magic_token=${token}`;
        if (process.env.MEOW_OAUTH_DEV === "true" || process.env.NODE_ENV !== "production") {
            return { ok: true, message: "Magic link generated (dev mode)", link };
        }
        // Production: integrate email delivery here
        return { ok: true, message: "If an account exists, a sign-in link has been sent." };
    });
    app.get("/v1/auth/magic-link/verify", async (request, reply) => {
        const token = request.query.token;
        if (!token)
            return reply.status(400).send({ error: "token required" });
        const email = consumeMagicLinkToken(token);
        if (!email)
            return reply.status(401).send({ error: "Invalid or expired magic link" });
        const profile = {
            provider: "magic_link",
            providerAccountId: email,
            email,
            name: email.split("@")[0]
        };
        const { user, membership, isNew } = await findOrCreateOAuthUser(profile);
        const tokens = await issueTokens({
            userId: user.id,
            email: user.email,
            workspaceId: membership.workspaceId,
            role: membership.role,
            userAgent: request.headers["user-agent"],
            ipAddress: request.ip,
            authProvider: "magic_link"
        });
        await prisma.auditLog.create({
            data: {
                workspaceId: membership.workspaceId,
                actorUserId: user.id,
                action: isNew ? "auth.magic_signup" : "auth.magic_login",
                target: user.id
            }
        });
        return reply.redirect(buildWebCallbackUrl(tokens.accessToken, tokens.refreshToken));
    });
}
export { slugify };
