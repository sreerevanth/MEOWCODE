import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@meowcode/database";
function slugify(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
}
function getApiBase() {
    return (process.env.MEOW_API_URL ?? process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
}
function getWebBase() {
    return (process.env.MEOW_WEB_URL ?? process.env.NEXT_PUBLIC_MEOW_WEB_URL ?? "http://localhost:3001").replace(/\/$/, "");
}
function oauthSecret() {
    return process.env.MEOW_OAUTH_STATE_SECRET ?? process.env.MEOW_AUTH_SECRET ?? "meow-oauth-state-dev";
}
export function signOAuthState(provider) {
    const nonce = randomBytes(16).toString("hex");
    const payload = `${provider}:${nonce}:${Date.now()}`;
    const sig = createHmac("sha256", oauthSecret()).update(payload).digest("hex");
    return Buffer.from(`${payload}:${sig}`).toString("base64url");
}
export function verifyOAuthState(state, provider) {
    try {
        const decoded = Buffer.from(state, "base64url").toString("utf8");
        const parts = decoded.split(":");
        if (parts.length !== 4)
            return false;
        const [prov, , ts, sig] = parts;
        if (prov !== provider)
            return false;
        const age = Date.now() - Number(ts);
        if (Number.isNaN(age) || age > 1000 * 60 * 15)
            return false;
        const payload = `${prov}:${parts[1]}:${ts}`;
        const expected = createHmac("sha256", oauthSecret()).update(payload).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}
export function getOAuthRedirectUri(provider) {
    return `${getApiBase()}/v1/auth/oauth/${provider}/callback`;
}
export function getOAuthProviders() {
    return OAUTH_PROVIDERS.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        enabled: Boolean(p.clientId && p.clientSecret) || process.env.MEOW_OAUTH_DEV === "true"
    }));
}
export const OAUTH_PROVIDERS = [
    {
        id: "google",
        displayName: "Google",
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
        scopes: ["openid", "email", "profile"],
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        profileMapper: (payload) => ({
            provider: "google",
            providerAccountId: String(payload.sub),
            email: String(payload.email).toLowerCase(),
            name: payload.name ? String(payload.name) : undefined,
            imageUrl: payload.picture ? String(payload.picture) : undefined
        })
    },
    {
        id: "github",
        displayName: "GitHub",
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userInfoUrl: "https://api.github.com/user",
        scopes: ["read:user", "user:email"],
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        profileMapper: (payload, tokens) => ({
            provider: "github",
            providerAccountId: String(payload.id),
            email: String(payload.email ?? tokens?.email ?? `${payload.id}@users.noreply.github.com`).toLowerCase(),
            name: payload.name ? String(payload.name) : payload.login ? String(payload.login) : undefined,
            imageUrl: payload.avatar_url ? String(payload.avatar_url) : undefined
        })
    },
    {
        id: "microsoft",
        displayName: "Microsoft",
        authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userInfoUrl: "https://graph.microsoft.com/v1.0/me",
        scopes: ["openid", "profile", "email", "User.Read"],
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        profileMapper: (payload) => ({
            provider: "microsoft",
            providerAccountId: String(payload.id),
            email: String(payload.mail ?? payload.userPrincipalName).toLowerCase(),
            name: payload.displayName ? String(payload.displayName) : undefined,
            imageUrl: undefined
        })
    },
    {
        id: "discord",
        displayName: "Discord",
        authorizeUrl: "https://discord.com/api/oauth2/authorize",
        tokenUrl: "https://discord.com/api/oauth2/token",
        userInfoUrl: "https://discord.com/api/users/@me",
        scopes: ["identify", "email"],
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        profileMapper: (payload) => ({
            provider: "discord",
            providerAccountId: String(payload.id),
            email: String(payload.email ?? `${payload.id}@discord.local`).toLowerCase(),
            name: payload.global_name ? String(payload.global_name) : payload.username ? String(payload.username) : undefined,
            imageUrl: payload.avatar
                ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png`
                : undefined
        })
    }
];
export function getOAuthProvider(providerId) {
    return OAUTH_PROVIDERS.find((p) => p.id === providerId);
}
export function buildAuthorizeUrl(config, state) {
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: getOAuthRedirectUri(config.id),
        response_type: "code",
        scope: config.scopes.join(" "),
        state
    });
    if (config.id === "google")
        params.set("access_type", "online");
    if (config.id === "microsoft")
        params.set("response_mode", "query");
    return `${config.authorizeUrl}?${params}`;
}
export async function exchangeOAuthCode(config, code) {
    const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: getOAuthRedirectUri(config.id),
        grant_type: "authorization_code"
    });
    const tokenRes = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            accept: "application/json",
            ...(config.id === "github" ? { "user-agent": "MeowCode" } : {})
        },
        body
    });
    if (!tokenRes.ok) {
        throw new Error(`OAuth token exchange failed: ${tokenRes.status}`);
    }
    const tokens = (await tokenRes.json());
    const accessToken = String(tokens.access_token ?? "");
    if (!accessToken)
        throw new Error("OAuth token missing access_token");
    let userPayload = {};
    if (config.userInfoUrl) {
        const userRes = await fetch(config.userInfoUrl, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                accept: "application/json",
                ...(config.id === "github" ? { "user-agent": "MeowCode" } : {})
            }
        });
        if (!userRes.ok)
            throw new Error(`OAuth userinfo failed: ${userRes.status}`);
        userPayload = (await userRes.json());
        if (config.id === "github" && !userPayload.email) {
            const emailsRes = await fetch("https://api.github.com/user/emails", {
                headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", "user-agent": "MeowCode" }
            });
            if (emailsRes.ok) {
                const emails = (await emailsRes.json());
                const primary = emails.find((e) => e.primary) ?? emails[0];
                if (primary)
                    userPayload.email = primary.email;
            }
        }
    }
    return { tokens, profile: config.profileMapper(userPayload, tokens) };
}
export async function findOrCreateOAuthUser(profile) {
    const existingAccount = await prisma.account.findUnique({
        where: {
            provider_providerAccountId: {
                provider: profile.provider,
                providerAccountId: profile.providerAccountId
            }
        },
        include: {
            user: {
                include: {
                    memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" }, take: 1 }
                }
            }
        }
    });
    if (existingAccount) {
        const user = existingAccount.user;
        if (profile.name && !user.name) {
            await prisma.user.update({ where: { id: user.id }, data: { name: profile.name, imageUrl: profile.imageUrl } });
        }
        const membership = user.memberships[0];
        if (!membership) {
            const ws = await provisionPersonalWorkspace(user.id, profile.name ?? profile.email.split("@")[0]);
            return { user, membership: ws.membership, isNew: false };
        }
        return { user, membership, isNew: false };
    }
    let user = await prisma.user.findUnique({
        where: { email: profile.email },
        include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } }
    });
    if (user) {
        await prisma.account.create({
            data: {
                userId: user.id,
                provider: profile.provider,
                providerAccountId: profile.providerAccountId
            }
        });
        if (!user.memberships[0]) {
            const ws = await provisionPersonalWorkspace(user.id, user.name ?? profile.name ?? profile.email.split("@")[0]);
            return { user, membership: ws.membership, isNew: false };
        }
        return { user, membership: user.memberships[0], isNew: false };
    }
    user = await prisma.user.create({
        data: {
            email: profile.email,
            name: profile.name ?? profile.email.split("@")[0],
            imageUrl: profile.imageUrl,
            onboardingStep: "complete",
            accounts: {
                create: {
                    provider: profile.provider,
                    providerAccountId: profile.providerAccountId
                }
            }
        },
        include: { memberships: true }
    });
    const ws = await provisionPersonalWorkspace(user.id, user.name ?? "Personal");
    return { user, membership: ws.membership, isNew: true };
}
export async function provisionPersonalWorkspace(userId, name) {
    const baseSlug = slugify(`${name}-personal`) || `personal-${randomBytes(3).toString("hex")}`;
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
    }
    const workspace = await prisma.workspace.create({
        data: {
            name: `${name}'s Workspace`,
            kind: "personal",
            slug,
            members: { create: { userId, role: "owner" } },
            settings: {
                create: {
                    defaultRoutingMode: "auto",
                    theme: "system",
                    preferences: { showRouting: false, showProviderBadge: true }
                }
            }
        }
    });
    const membership = await prisma.workspaceMember.findUniqueOrThrow({
        where: { userId_workspaceId: { userId, workspaceId: workspace.id } }
    });
    return { workspace, membership };
}
const magicLinkTokens = new Map();
export function createMagicLinkToken(email) {
    const token = randomBytes(24).toString("hex");
    magicLinkTokens.set(token, { email: email.toLowerCase(), expiresAt: Date.now() + 1000 * 60 * 15 });
    return token;
}
export function consumeMagicLinkToken(token) {
    const entry = magicLinkTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
        magicLinkTokens.delete(token);
        return null;
    }
    magicLinkTokens.delete(token);
    return entry.email;
}
export function buildWebCallbackUrl(accessToken, refreshToken) {
    const params = new URLSearchParams({ access_token: accessToken, refresh_token: refreshToken });
    return `${getWebBase()}/auth/callback?${params}`;
}
export function buildDevOAuthProfile(provider) {
    const id = randomBytes(8).toString("hex");
    return {
        provider: provider,
        providerAccountId: `dev_${provider}_${id}`,
        email: `dev+${provider}.${id}@meowcode.local`,
        name: `Dev ${provider} User`,
        imageUrl: undefined
    };
}
