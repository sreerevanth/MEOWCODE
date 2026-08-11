/**
 * End-to-end API smoke test for Meow Code production readiness.
 * Run: npx tsx scripts/qa-api-smoke.ts
 */
const API = process.env.MEOW_API_URL ?? "http://localhost:4000";
const random = Math.floor(Math.random() * 1e9);

interface TestResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name} — ${detail}`);
}

async function json<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let body: T;
  try {
    body = text ? (JSON.parse(text) as T) : (undefined as T);
  } catch {
    body = text as T;
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`\nMeow Code API smoke test → ${API}\n`);

  // Health
  {
    const { status, body } = await json<{ ok: boolean }>("/health");
    status === 200 && body.ok ? pass("GET /health") : fail("GET /health", `status=${status}`);
  }

  // OAuth providers (dev mode)
  {
    const { status, body } = await json<Array<{ id: string; enabled: boolean }>>("/v1/auth/oauth/providers");
    if (status !== 200) fail("GET /v1/auth/oauth/providers", `status=${status}`);
    else {
      const enabled = body.filter((p) => p.enabled).length;
      enabled > 0 ? pass("OAuth providers enabled (dev)", `${enabled}/4`) : fail("OAuth providers", "none enabled — set MEOW_OAUTH_DEV=true");
    }
  }

  // Signup
  const email = `qa-${random}@meowcode.local`;
  const password = "testpass12345";
  let accessToken = "";
  let refreshToken = "";
  let workspaceId = "";

  {
    const { status, body } = await json<{
      accessToken: string;
      refreshToken: string;
      user: { workspaceId?: string; id: string };
    }>("/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name: "QA Tester" })
    });
    if (status === 201 && body.accessToken) {
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
      workspaceId = body.user.workspaceId ?? "";
      workspaceId ? pass("POST /v1/auth/signup with workspace") : fail("POST /v1/auth/signup", "no workspaceId returned");
    } else {
      fail("POST /v1/auth/signup", `status=${status} ${JSON.stringify(body)}`);
    }
  }

  const auth = { authorization: `Bearer ${accessToken}` };

  // Me
  {
    const { status, body } = await json<{ email: string; workspaceId: string | null }>("/v1/auth/me", { headers: auth });
    status === 200 && body.email === email ? pass("GET /v1/auth/me") : fail("GET /v1/auth/me", `status=${status}`);
    if (body.workspaceId) workspaceId = body.workspaceId;
  }

  // Refresh
  {
    const { status, body } = await json<{ accessToken: string; refreshToken: string }>("/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (status === 200 && body.accessToken) {
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
      pass("POST /v1/auth/refresh");
    } else fail("POST /v1/auth/refresh", `status=${status}`);
  }

  const auth2 = { authorization: `Bearer ${accessToken}` };

  // Workspaces
  {
    const { status, body } = await json<Array<{ id: string }>>("/v1/workspaces", { headers: auth2 });
    status === 200 && body.length > 0 ? pass("GET /v1/workspaces", `${body.length} workspace(s)`) : fail("GET /v1/workspaces", `status=${status}`);
  }

  // Workspace settings merge
  {
    await json(`/v1/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { ...auth2, "content-type": "application/json" },
      body: JSON.stringify({ settings: { preferences: { showRouting: true } } })
    });
    await json(`/v1/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { ...auth2, "content-type": "application/json" },
      body: JSON.stringify({ settings: { preferences: { chatFolders: [{ id: "f1", name: "Test" }] } } })
    });
    const { body } = await json<{ settings?: { preferences?: Record<string, unknown> } }>(`/v1/workspaces/${workspaceId}`, {
      headers: auth2
    });
    const prefs = body.settings?.preferences ?? {};
    if (prefs.showRouting === true && Array.isArray(prefs.chatFolders)) pass("Workspace preferences merge");
    else fail("Workspace preferences merge", JSON.stringify(prefs));
  }

  // Provider catalog
  {
    const { status, body } = await json<unknown[]>("/v1/providers/catalog", { headers: auth2 });
    status === 200 && Array.isArray(body) && body.length > 0
      ? pass("GET /v1/providers/catalog", `${body.length} providers`)
      : fail("GET /v1/providers/catalog", `status=${status}`);
  }

  // Providers list
  {
    const { status, body } = await json<unknown[]>(`/v1/providers?workspaceId=${workspaceId}`, { headers: auth2 });
    status === 200 && Array.isArray(body) ? pass("GET /v1/providers") : fail("GET /v1/providers", `status=${status}`);
  }

  // Models (empty ok)
  {
    const { status } = await json(`/v1/models?workspaceId=${workspaceId}`, { headers: auth2 });
    status === 200 ? pass("GET /v1/models") : fail("GET /v1/models", `status=${status}`);
  }

  // Chats CRUD
  let chatId = "";
  {
    const { status, body } = await json<{ id: string }>("/v1/chats", {
      method: "POST",
      headers: { ...auth2, "content-type": "application/json" },
      body: JSON.stringify({ title: "QA Chat", workspaceId })
    });
    if (status === 201 && body.id) {
      chatId = body.id;
      pass("POST /v1/chats");
    } else fail("POST /v1/chats", `status=${status}`);
  }

  {
    const { status } = await json(`/v1/chats/${chatId}`, {
      method: "PATCH",
      headers: { ...auth2, "content-type": "application/json" },
      body: JSON.stringify({ title: "Renamed QA Chat", pinned: true })
    });
    status === 200 ? pass("PATCH /v1/chats/:id") : fail("PATCH /v1/chats/:id", `status=${status}`);
  }

  {
    const { status, body } = await json<unknown[]>(`/v1/chats?workspaceId=${workspaceId}`, { headers: auth2 });
    status === 200 && Array.isArray(body) && body.length > 0 ? pass("GET /v1/chats") : fail("GET /v1/chats", `status=${status}`);
  }

  // Chat completions without models should 400
  {
    const { status } = await json("/v1/chat/completions", {
      method: "POST",
      headers: { ...auth2, "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        conversationId: chatId,
        messages: [{ role: "user", content: "Hello" }],
        stream: false
      })
    });
    status === 400 ? pass("POST /v1/chat/completions rejects without models") : fail("POST /v1/chat/completions", `expected 400, got ${status}`);
  }

  // Usage
  {
    const { status } = await json(`/v1/usage?workspaceId=${workspaceId}`, { headers: auth2 });
    status === 200 ? pass("GET /v1/usage") : fail("GET /v1/usage", `status=${status}`);
  }

  // Magic link (dev)
  {
    const { status, body } = await json<{ ok: boolean; link?: string }>("/v1/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `magic-${random}@meowcode.local` })
    });
    status === 200 && body.link ? pass("POST /v1/auth/magic-link (dev)") : fail("POST /v1/auth/magic-link", `status=${status}`);
  }

  // API keys
  let apiKeyId = "";
  {
    const { status, body } = await json<{ id: string; apiKey: string }>("/v1/auth/api-keys", {
      method: "POST",
      headers: { ...auth2, "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, name: "QA Key" })
    });
    if (status === 201 && body.apiKey) {
      apiKeyId = body.id;
      pass("POST /v1/auth/api-keys");
    } else fail("POST /v1/auth/api-keys", `status=${status}`);
  }

  {
    const { status } = await json(`/v1/auth/api-keys/${apiKeyId}`, { method: "DELETE", headers: auth2 });
    status === 200 ? pass("DELETE /v1/auth/api-keys/:id") : fail("DELETE /v1/auth/api-keys/:id", `status=${status}`);
  }

  // Logout
  {
    const { status } = await json("/v1/auth/logout", {
      method: "POST",
      headers: { ...auth2, "content-type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    status === 204 ? pass("POST /v1/auth/logout") : fail("POST /v1/auth/logout", `status=${status}`);
  }

  // Unauthorized after logout refresh
  {
    const { status } = await json("/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    status === 401 ? pass("Refresh token revoked after logout") : fail("Refresh after logout", `expected 401, got ${status}`);
  }

  // Cleanup chat
  {
    await json(`/v1/chats/${chatId}`, { method: "DELETE", headers: auth2 });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
