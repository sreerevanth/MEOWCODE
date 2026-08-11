"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  Route,
  Trash2,
  User,
  Users
} from "lucide-react";
import { Button } from "@meowcode/ui";
import { useAuth } from "../lib/auth";
import { KEYBOARD_SHORTCUTS } from "../hooks/useKeyboardShortcuts";

export default function SettingsPage(): React.ReactElement {
  const { ready, user, client, workspaceId, logout, switchWorkspace } = useAuth();
  const router = useRouter();
  const [profileName, setProfileName] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [routingMode, setRoutingMode] = React.useState("auto");
  const [showRouting, setShowRouting] = React.useState(false);
  const [theme, setTheme] = React.useState("system");
  const [apiKeys, setApiKeys] = React.useState<Array<{ id: string; name: string; createdAt: string }>>([]);
  const [workspaces, setWorkspaces] = React.useState<Array<{ id: string; name: string; role?: string; kind?: string }>>([]);
  const [members, setMembers] = React.useState<Array<{ id: string; email: string; name?: string | null; role: string }>>([]);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [newWorkspaceName, setNewWorkspaceName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    void load();
  }, [ready, user, workspaceId, router]);

  async function load() {
    if (!workspaceId) return;
    setProfileName(user?.name ?? "");
    const ws = (await client.getWorkspace(workspaceId)) as {
      name?: string;
      settings?: { defaultRoutingMode?: string; theme?: string; preferences?: { showRouting?: boolean } };
    };
    setWorkspaceName(ws.name ?? "");
    setRoutingMode(ws.settings?.defaultRoutingMode ?? "auto");
    setTheme(ws.settings?.theme ?? "system");
    setShowRouting(Boolean(ws.settings?.preferences?.showRouting));
    setApiKeys(await client.listApiKeys(workspaceId));
    setWorkspaces(await client.workspaces());
    setMembers((await client.workspaceMembers(workspaceId)) as typeof members);
  }

  const applyTheme = (t: string) => {
    document.documentElement.classList.toggle(
      "dark",
      t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  };

  if (!ready || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 dark:bg-[#101014]">
        <Loader2 className="animate-spin text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950 dark:bg-[#101014] dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white/85 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            <ArrowLeft size={16} /> Back to chat
          </Link>
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-cyan-500" />
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8">
        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <User size={16} /> Profile
          </h2>
          <p className="mb-3 text-xs text-zinc-500">{user.email}</p>
          <label className="mb-3 block space-y-1 text-sm">
            <span>Display name</span>
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-stone-50 px-3 dark:border-zinc-800 dark:bg-zinc-900"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await client.updateProfile({ name: profileName.trim() || undefined });
                setMessage("Profile updated");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update profile");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save profile
          </Button>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users size={16} /> Workspaces
          </h2>
          <label className="mb-3 block space-y-1 text-sm">
            <span>Active workspace</span>
            <select
              className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
              value={workspaceId ?? ""}
              onChange={(e) => void switchWorkspace(e.target.value)}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} {ws.kind === "personal" ? "(Personal)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 block space-y-1 text-sm">
            <span>Workspace name</span>
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-stone-50 px-3 dark:border-zinc-800 dark:bg-zinc-900"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy || !workspaceId}
              onClick={async () => {
                if (!workspaceId) return;
                setBusy(true);
                try {
                  await client.updateWorkspace(workspaceId, { name: workspaceName.trim() });
                  setMessage("Workspace renamed");
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to rename workspace");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save workspace
            </Button>
          </div>

          <form
            className="mt-4 flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newWorkspaceName.trim()) return;
              setBusy(true);
              try {
                const created = await client.createWorkspace({ name: newWorkspaceName.trim(), kind: "team" });
                await switchWorkspace(created.id);
                setNewWorkspaceName("");
                setMessage("Workspace created");
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create workspace");
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              className="h-9 flex-1 rounded-md border border-zinc-200 bg-stone-50 px-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="New team workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
            />
            <Button type="submit" className="gap-1" disabled={busy}>
              <Plus size={14} /> Create
            </Button>
          </form>

          {members.length > 0 ? (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Members</h3>
              <ul className="space-y-1 text-sm">
                {members.map((m) => (
                  <li key={m.id} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{m.name ?? m.email}</span>
                    <span className="text-xs capitalize">{m.role}</span>
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!workspaceId || !inviteEmail.trim()) return;
                  setBusy(true);
                  try {
                    await client.inviteToWorkspace(workspaceId, { email: inviteEmail.trim() });
                    setInviteEmail("");
                    setMessage("Invite sent");
                    await load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to send invite");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <input
                  type="email"
                  className="h-9 flex-1 rounded-md border border-zinc-200 bg-stone-50 px-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  placeholder="Invite by email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button type="submit" disabled={busy}>
                  Invite
                </Button>
              </form>
            </div>
          ) : null}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Route size={16} /> Routing
          </h2>
          <label className="mb-3 block space-y-1 text-sm">
            <span>Default strategy</span>
            <select
              className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
              value={routingMode}
              onChange={async (e) => {
                setRoutingMode(e.target.value);
                if (workspaceId) {
                  await client.updateWorkspace(workspaceId, { settings: { defaultRoutingMode: e.target.value } });
                }
              }}
            >
              {["auto", "cheapest", "fastest", "highest_quality", "free_only", "local_only", "vision", "reasoning"].map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRouting}
              onChange={async (e) => {
                setShowRouting(e.target.checked);
                if (workspaceId) {
                  await client.updateWorkspace(workspaceId, {
                    settings: { preferences: { showRouting: e.target.checked } }
                  });
                }
              }}
            />
            Show routing controls in chat header
          </label>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold">Theme</h2>
          <select
            className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
            value={theme}
            onChange={async (e) => {
              const t = e.target.value;
              setTheme(t);
              applyTheme(t);
              if (workspaceId) await client.updateWorkspace(workspaceId, { settings: { theme: t } });
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound size={16} /> API Keys
            </h2>
            <Link href="/providers">
              <Button variant="secondary" className="h-8 text-xs">
                Providers
              </Button>
            </Link>
          </div>
          {apiKeys.length === 0 ? (
            <p className="text-sm text-zinc-500">No API keys yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {apiKeys.map((k) => (
                <li key={k.id} className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                  <span>
                    {k.name} <span className="text-xs text-zinc-400">({new Date(k.createdAt).toLocaleDateString()})</span>
                  </span>
                  <Button
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs text-red-600"
                    onClick={async () => {
                      await client.revokeApiKey(k.id);
                      await load();
                      setMessage("API key revoked");
                    }}
                  >
                    <Trash2 size={12} /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            className="mt-3"
            variant="secondary"
            disabled={busy || !workspaceId}
            onClick={async () => {
              if (!workspaceId) return;
              setBusy(true);
              try {
                const created = await client.createApiKey(workspaceId, "Settings Key");
                window.prompt("Copy your API key (shown once):", created.apiKey);
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            Create API key
          </Button>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold">Keyboard shortcuts</h2>
          <ul className="space-y-2 text-sm">
            {KEYBOARD_SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex justify-between gap-4 text-zinc-600 dark:text-zinc-400">
                <span>{s.description}</span>
                <span className="shrink-0 font-mono text-xs">{s.keys}</span>
              </li>
            ))}
          </ul>
        </section>

        <Button
          variant="secondary"
          className="gap-2"
          onClick={async () => {
            await logout();
            router.replace("/auth");
          }}
        >
          <LogOut size={14} /> Log out
        </Button>
      </div>
    </main>
  );
}
