import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import type { WorkspaceRole } from "@meowcode/shared";

export type AuthProvider = "email" | "google" | "github" | "microsoft" | "discord" | "magic_link" | "passkey" | "api_key";

export interface SessionPrincipal {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
  authProvider: AuthProvider;
  mfaVerified: boolean;
  sessionId?: string;
}

export type Permission =
  | "workspace:read"
  | "workspace:write"
  | "provider:read"
  | "provider:write"
  | "secret:read"
  | "chat:read"
  | "chat:write"
  | "usage:read"
  | "audit:read"
  | "admin:manage";

const rolePermissions: Record<WorkspaceRole, Permission[]> = {
  owner: [
    "workspace:read",
    "workspace:write",
    "provider:read",
    "provider:write",
    "secret:read",
    "chat:read",
    "chat:write",
    "usage:read",
    "audit:read",
    "admin:manage"
  ],
  admin: [
    "workspace:read",
    "workspace:write",
    "provider:read",
    "provider:write",
    "secret:read",
    "chat:read",
    "chat:write",
    "usage:read",
    "audit:read"
  ],
  developer: ["workspace:read", "provider:read", "chat:read", "chat:write", "usage:read"],
  viewer: ["workspace:read", "provider:read", "chat:read", "usage:read"]
};

export function can(principal: SessionPrincipal, permission: Permission): boolean {
  return rolePermissions[principal.role]?.includes(permission) ?? false;
}

export function requirePermission(principal: SessionPrincipal, permission: Permission): void {
  if (!can(principal, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

export interface SecretCipher {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

export class AES256SecretCipher implements SecretCipher {
  private readonly key: Buffer;

  constructor(secretKey: string) {
    this.key = createHash("sha256").update(secretKey).digest();
  }

  async encrypt(plaintext: string): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      return Buffer.from(ciphertext, "base64url").toString("utf8");
    }
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const encryptedText = Buffer.from(parts[2], "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encryptedText) + decipher.final("utf8");
  }
}

export class DevelopmentSecretCipher implements SecretCipher {
  async encrypt(plaintext: string): Promise<string> {
    return Buffer.from(plaintext, "utf8").toString("base64url");
  }

  async decrypt(ciphertext: string): Promise<string> {
    return Buffer.from(ciphertext, "base64url").toString("utf8");
  }
}

export function createSecretCipher(secretKey?: string): SecretCipher {
  if (secretKey && secretKey.length > 0) {
    return new AES256SecretCipher(secretKey);
  }
  return new DevelopmentSecretCipher();
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; hash: string } {
  const raw = `meow_${randomBytes(24).toString("hex")}`;
  return { key: raw, hash: hashApiKey(raw) };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
  sessionId: string;
  authProvider: AuthProvider;
  mfaVerified: boolean;
  typ: "access";
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function decodeBase64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, "typ" | "iat" | "exp">,
  secret: string,
  expiresInSeconds = 60 * 15
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body: AccessTokenPayload = {
    ...payload,
    typ: "access",
    iat: now,
    exp: now + expiresInSeconds
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;
  const hmac = createHmacSha256(secret, data);
  return `${data}.${hmac}`;
}

function createHmacSha256(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid access token");
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmacSha256(secret, data);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid access token signature");
  }
  const payload = JSON.parse(decodeBase64url(encodedPayload).toString("utf8")) as AccessTokenPayload;
  if (payload.typ !== "access") {
    throw new Error("Invalid token type");
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Access token expired");
  }
  void encodedHeader;
  return payload;
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = `mrt_${randomBytes(32).toString("hex")}`;
  return { token, hash: hashApiKey(token) };
}

export function toSessionPrincipal(payload: AccessTokenPayload): SessionPrincipal {
  return {
    userId: payload.sub,
    email: payload.email,
    workspaceId: payload.workspaceId,
    role: payload.role,
    authProvider: payload.authProvider,
    mfaVerified: payload.mfaVerified,
    sessionId: payload.sessionId
  };
}

export function getAuthSecret(): string {
  return process.env.MEOW_AUTH_SECRET ?? process.env.JWT_SECRET ?? "meow-dev-auth-secret-change-me";
}

export function getEncryptionKey(): string | undefined {
  return process.env.MEOW_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
}
