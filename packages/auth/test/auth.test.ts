import { describe, it, expect } from "vitest";
import {
  AES256SecretCipher,
  can,
  generateApiKey,
  hashApiKey,
  hashPassword,
  signAccessToken,
  verifyAccessToken,
  verifyPassword
} from "../src/index.js";

describe("Auth Package", () => {
  it("encrypts and decrypts secret keys using AES-256-GCM", async () => {
    const cipher = new AES256SecretCipher("super-secret-key-1234567890123456");
    const secret = "sk-proj-openai-api-key-test";
    const encrypted = await cipher.encrypt(secret);
    expect(encrypted).not.toBe(secret);
    const decrypted = await cipher.decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("evaluates RBAC permissions correctly", () => {
    const ownerPrincipal = {
      userId: "u1",
      email: "owner@meow.dev",
      workspaceId: "w1",
      role: "owner" as const,
      authProvider: "email" as const,
      mfaVerified: true
    };
    const viewerPrincipal = {
      ...ownerPrincipal,
      role: "viewer" as const
    };

    expect(can(ownerPrincipal, "provider:write")).toBe(true);
    expect(can(viewerPrincipal, "provider:write")).toBe(false);
    expect(can(viewerPrincipal, "chat:read")).toBe(true);
  });

  it("generates and hashes API keys", () => {
    const { key, hash } = generateApiKey();
    expect(key).toContain("meow_");
    expect(hashApiKey(key)).toBe(hash);
  });

  it("hashes and verifies passwords", () => {
    const hash = hashPassword("correct-horse-battery");
    expect(verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("signs and verifies access tokens", () => {
    const token = signAccessToken(
      {
        sub: "user_1",
        email: "dev@meow.dev",
        workspaceId: "ws_1",
        role: "owner",
        sessionId: "sess_1",
        authProvider: "email",
        mfaVerified: true
      },
      "test-secret",
      60
    );
    const payload = verifyAccessToken(token, "test-secret");
    expect(payload.sub).toBe("user_1");
    expect(payload.workspaceId).toBe("ws_1");
    expect(() => verifyAccessToken(token, "other-secret")).toThrow();
  });
});
