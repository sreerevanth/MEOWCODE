"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bot,
  Clock3,
  Loader2,
  Plug,
  PlugZap,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Zap
} from "lucide-react";
import { Button, StatusPill } from "@meowcode/ui";
import { useAuth } from "../lib/auth";
import type { ProviderSummary } from "@meowcode/sdk";

type ActionState = { id: string; action: string } | null;

export default function ProvidersPage(): React.ReactElement {
  const { ready, user, client, workspaceId } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = React.useState<ProviderSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionState, setActionState] = React.useState<ActionState>(null);
  const [connectingId, setConnectingId] = React.useState<string | null>(null);
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    apiKey: "",
    endpoint: "",
    organizationId: "",
    projectId: "",
    customHeaders: "",
    timeoutMs: "60000"
  });

  React.useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/auth");
    }
  }, [ready, user, router]);

  const loadProviders = React.useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.providers(workspaceId);
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [client, workspaceId]);

  React.useEffect(() => {
    if (!ready || !user || !workspaceId) return;
    void loadProviders();
  }, [ready, user, workspaceId, loadProviders]);

  const runAction = async (provider: ProviderSummary, action: string, fn: () => Promise<void>) => {
    const key = provider.id ?? provider.providerId;
    setActionState({ id: key, action });
    setError(null);
    try {
      await fn();
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setActionState(null);
    }
  };

  const handleConnect = async (provider: ProviderSummary) => {
    if (!workspaceId) return;
    setConnectingId(provider.providerId);
    setForm({
      apiKey: "",
      endpoint: provider.endpoint ?? provider.defaultEndpoint ?? "",
      organizationId: provider.organizationId ?? "",
      projectId: provider.projectId ?? "",
      customHeaders: provider.customHeaders ? JSON.stringify(provider.customHeaders, null, 2) : "",
      timeoutMs: String(provider.timeoutMs ?? 60000)
    });
  };

  const submitConnect = async (provider: ProviderSummary) => {
    if (!workspaceId) return;
    let customHeaders: Record<string, string> | undefined;
    if (form.customHeaders.trim()) {
      try {
        customHeaders = JSON.parse(form.customHeaders) as Record<string, string>;
      } catch {
        setError("Custom headers must be valid JSON");
        return;
      }
    }
    const connected = provider.isConnected ?? false;
    await runAction(provider, connected ? "update" : "connect", async () => {
      if (connected && provider.id) {
        await client.updateProvider(provider.id, {
          apiKey: form.apiKey || undefined,
          endpoint: form.endpoint || undefined,
          organizationId: form.organizationId || undefined,
          projectId: form.projectId || undefined,
          customHeaders,
          timeoutMs: Number(form.timeoutMs) || 60000
        });
        await client.verifyProvider(provider.id);
      } else {
        await client.addProvider({
          workspaceId,
          providerId: provider.providerId,
          displayName: provider.displayName,
          apiKey: form.apiKey || undefined,
          endpoint: form.endpoint || undefined,
          organizationId: form.organizationId || undefined,
          projectId: form.projectId || undefined,
          customHeaders,
          timeoutMs: Number(form.timeoutMs) || 60000
        });
      }
      setConnectingId(null);
      setSettingsId(null);
    });
  };

  const isBusy = (provider: ProviderSummary, action: string) =>
    actionState?.id === (provider.id ?? provider.providerId) && actionState.action === action;

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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              <ArrowLeft size={16} /> Back to chat
            </Link>
            <div className="hidden h-5 w-px bg-zinc-300 dark:bg-zinc-700 sm:block" />
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-md bg-cyan-500 text-zinc-950 font-bold">
                <Bot size={18} />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Providers</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Control center for every AI provider</p>
              </div>
            </div>
          </div>
          <Button variant="secondary" className="gap-2" onClick={() => void loadProviders()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 md:px-8">
          {error}
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        {loading && providers.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 size={16} className="animate-spin" /> Loading providers...
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
            const cardKey = provider.id ?? provider.providerId;
            const connected = provider.isConnected ?? false;
            const endpoint = provider.endpoint ?? provider.defaultEndpoint ?? "—";
            const latency = provider.latency?.p50Ms ?? provider.latency?.avgMs;
            const showForm = connectingId === provider.providerId || settingsId === provider.providerId;

            return (
              <article
                key={cardKey}
                className="flex flex-col rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-start gap-3">
                    <ProviderLogo provider={provider} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="truncate text-sm font-semibold">{provider.displayName}</h2>
                        <HealthBadge status={provider.healthStatus ?? "unknown"} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {provider.description ?? "AI provider integration"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4 text-xs">
                  <InfoRow label="Connection" value={connected ? "Connected" : "Disconnected"} />
                  <InfoRow label="Health" value={formatHealth(provider.healthStatus ?? "unknown")} />
                  <InfoRow label="Latency p50" value={latency != null ? `${latency}ms` : connected ? "—" : "N/A"} />
                  <InfoRow label="Models" value={connected ? String(provider.modelsCount ?? 0) : "—"} />
                  <InfoRow
                    label="Last sync"
                    value={provider.lastSyncAt ? formatDate(provider.lastSyncAt) : connected ? "Never" : "—"}
                  />
                  <InfoRow
                    label="Last health check"
                    value={provider.lastHealthCheckAt ? formatDate(provider.lastHealthCheckAt) : connected ? "Never" : "—"}
                  />
                  <InfoRow label="Capabilities" value={(provider.capabilities ?? []).slice(0, 6).join(", ") || "—"} />
                  <InfoRow label="API endpoint" value={endpoint} mono />
                  {connected && provider.healthStats ? (
                    <InfoRow
                      label="Availability"
                      value={
                        provider.healthStats.availabilityPct != null
                          ? `${provider.healthStats.availabilityPct.toFixed(1)}%`
                          : "—"
                      }
                    />
                  ) : null}
                  {provider.lastHealthMessage ? (
                    <p className="rounded-md bg-zinc-50 px-2 py-1.5 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      {provider.lastHealthMessage}
                    </p>
                  ) : null}
                </div>

                {showForm ? (
                  <div className="space-y-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">API key</span>
                      <input
                        type="password"
                        className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        value={form.apiKey}
                        onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                        placeholder="sk-..."
                      />
                    </label>
                    {provider.supportsCustomEndpoint !== false ? (
                      <label className="block space-y-1 text-xs">
                        <span className="font-medium">Endpoint</span>
                        <input
                          className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                          value={form.endpoint}
                          onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                        />
                      </label>
                    ) : null}
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">Organization ID (optional)</span>
                      <input
                        className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        value={form.organizationId}
                        onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
                      />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">Project ID (optional)</span>
                      <input
                        className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        value={form.projectId}
                        onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                      />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">Custom headers (JSON, optional)</span>
                      <textarea
                        className="min-h-16 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900"
                        value={form.customHeaders}
                        onChange={(e) => setForm((f) => ({ ...f, customHeaders: e.target.value }))}
                        placeholder='{"X-Custom-Header": "value"}'
                      />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">Timeout (ms)</span>
                      <input
                        className="h-9 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        value={form.timeoutMs}
                        onChange={(e) => setForm((f) => ({ ...f, timeoutMs: e.target.value }))}
                      />
                    </label>
                    <div className="flex gap-2 pt-1">
                      <Button className="flex-1 gap-1" disabled={!!actionState} onClick={() => void submitConnect(provider)}>
                        {isBusy(provider, connected ? "update" : "connect") ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Plug size={14} />
                        )}
                        {connected ? "Save & verify" : "Connect"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setConnectingId(null);
                          setSettingsId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
                  {!connected ? (
                    <Button className="gap-1" onClick={() => void handleConnect(provider)}>
                      <Plug size={14} /> Connect
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        className="gap-1"
                        disabled={!!actionState || !provider.id}
                        onClick={() =>
                          provider.id &&
                          void runAction(provider, "verify", async () => {
                            await client.verifyProvider(provider.id!);
                          })
                        }
                      >
                        {isBusy(provider, "verify") ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        Verify
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-1"
                        disabled={!!actionState || !provider.id}
                        onClick={() =>
                          provider.id &&
                          void runAction(provider, "sync", async () => {
                            await client.syncProvider(provider.id!);
                          })
                        }
                      >
                        {isBusy(provider, "sync") ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Sync models
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-1"
                        disabled={!!actionState || !provider.id}
                        onClick={() =>
                          provider.id &&
                          void runAction(provider, "health", async () => {
                            await client.healthCheckProvider(provider.id!);
                          })
                        }
                      >
                        {isBusy(provider, "health") ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                        Health
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-1"
                        disabled={!!actionState || !provider.id}
                        onClick={() =>
                          provider.id &&
                          void runAction(provider, "latency", async () => {
                            await client.latencyTestProvider(provider.id!);
                          })
                        }
                      >
                        {isBusy(provider, "latency") ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        Latency
                      </Button>
                      <Button
                        variant="ghost"
                        className="gap-1"
                        disabled={!!actionState || !provider.id}
                        onClick={() => {
                          setSettingsId(provider.providerId);
                          setForm({
                            apiKey: "",
                            endpoint: provider.endpoint ?? provider.defaultEndpoint ?? "",
                            organizationId: provider.organizationId ?? "",
                            projectId: provider.projectId ?? "",
                            customHeaders: provider.customHeaders ? JSON.stringify(provider.customHeaders, null, 2) : "",
                            timeoutMs: String(provider.timeoutMs ?? 60000)
                          });
                        }}
                      >
                        <Settings size={14} /> Settings
                      </Button>
                      <Button
                        variant="ghost"
                        className="gap-1"
                        disabled={!!actionState || !provider.id}
                        onClick={() =>
                          provider.id &&
                          void runAction(provider, "disconnect", async () => {
                            await client.disconnectProvider(provider.id!);
                          })
                        }
                      >
                        {isBusy(provider, "disconnect") ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
                        Disconnect
                      </Button>
                      <Button
                        variant="ghost"
                        className="gap-1 text-red-600 dark:text-red-400"
                        disabled={!!actionState || !provider.id}
                        onClick={() =>
                          provider.id &&
                          void runAction(provider, "delete", async () => {
                            await client.deleteProvider(provider.id!);
                          })
                        }
                      >
                        {isBusy(provider, "delete") ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function ProviderLogo({ provider }: { provider: ProviderSummary }): React.ReactElement {
  if (provider.logoUrl) {
    return (
      <img
        src={provider.logoUrl}
        alt=""
        className="size-10 rounded-md border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-800"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-cyan-500/15 text-sm font-bold text-cyan-700 dark:text-cyan-300">
      {provider.displayName.slice(0, 2).toUpperCase()}
    </div>
  );
}

function HealthBadge({ status }: { status: string }): React.ReactElement {
  const tone =
    status === "healthy"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "slow" || status === "degraded"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : status === "unknown"
          ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
          : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`truncate text-right ${mono ? "font-mono text-[10px]" : "font-medium"}`} title={value}>
        {value}
      </span>
    </div>
  );
}

function formatHealth(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
