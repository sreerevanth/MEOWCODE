"use client";

import * as React from "react";
import { Loader2, Plug, Search, X } from "lucide-react";
import { Button } from "@meowcode/ui";
import type { MeowClient, ProviderSummary } from "@meowcode/sdk";
import { saveApiKey } from "../lib/local-db";

interface ProviderModalProps {
  open: boolean;
  onClose: () => void;
  client: MeowClient;
  workspaceId: string;
  onConnected: () => void;
}

export function ProviderModal({ open, onClose, client, workspaceId, onConnected }: ProviderModalProps): React.ReactElement | null {
  const [providers, setProviders] = React.useState<ProviderSummary[]>([]);
  const [catalog, setCatalog] = React.useState<ProviderSummary[]>([]);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<ProviderSummary | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [endpoint, setEndpoint] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<"pick" | "connect" | "syncing">("pick");

  React.useEffect(() => {
    if (!open || !workspaceId) return;
    void Promise.all([
      client.providers(workspaceId), 
      client.providerCatalog(),
      import("../lib/local-db").then(m => m.getAllApiKeys(workspaceId).catch(() => ({} as Record<string, string>)))
    ]).then(([connected, cat, localKeys]) => {
      setProviders(connected);
      setCatalog(
        cat.map((c) => ({
          id: null,
          providerId: c.providerId,
          displayName: c.displayName,
          description: c.description,
          logoUrl: c.logoUrl,
          defaultEndpoint: c.defaultEndpoint,
          capabilities: c.capabilities,
          supportsCustomEndpoint: c.supportsCustomEndpoint,
          local: c.local,
          isConnected: !!localKeys[c.providerId]
        }))
      );
    });
  }, [open, workspaceId, client]);

  if (!open) return null;

  const filtered = catalog.filter(
    (p) =>
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.providerId.toLowerCase().includes(search.toLowerCase())
  );

  const pickProvider = (provider: ProviderSummary) => {
    setSelected(provider);
    setEndpoint(provider.endpoint ?? provider.defaultEndpoint ?? "");
    setApiKey("");
    setStep("connect");
    setError(null);
  };

  const handleConnect = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setStep("syncing");
    try {
      if (apiKey) {
        try {
          await saveApiKey(workspaceId, selected.providerId, apiKey);
        } catch (e) {
          console.warn("Failed to save API key to IndexedDB", e);
        }
      }
      const added = await client.addProvider({
        workspaceId,
        providerId: selected.providerId,
        displayName: selected.displayName,
        endpoint: endpoint || undefined
      });
      // Skip syncProvider for stateless mode because we can't sync securely on backend without passing keys in header.
      onConnected();
      onClose();
      setStep("pick");
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStep("connect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-md border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">
            {step === "pick" ? "Connect a provider" : step === "syncing" ? "Connecting..." : selected?.displayName}
          </h2>
          <Button variant="ghost" className="size-8 px-0" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        {step === "pick" ? (
          <>
            <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-stone-50 px-3 dark:border-zinc-800 dark:bg-zinc-900">
                <Search size={14} className="text-zinc-500" />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Search providers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filtered.map((p) => (
                <button
                  key={p.providerId}
                  onClick={() => pickProvider(p)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-cyan-500/15 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                    {p.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.displayName}</div>
                    <div className="truncate text-xs text-zinc-500">{p.description ?? p.providerId}</div>
                  </div>
                  {p.isConnected ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Connected</span>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === "connect" && selected ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{selected.description}</p>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">API key</span>
              <input
                type="password"
                className="h-10 w-full rounded-md border border-zinc-200 bg-stone-50 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selected.local ? "Optional for local" : "Required"}
              />
            </label>
            {selected.supportsCustomEndpoint !== false ? (
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Endpoint</span>
                <input
                  className="h-10 w-full rounded-md border border-zinc-200 bg-stone-50 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </label>
            ) : null}
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("pick")}>
                Back
              </Button>
              <Button className="flex-1 gap-2" disabled={busy} onClick={() => void handleConnect()}>
                <Plug size={14} /> Connect & sync models
              </Button>
            </div>
          </div>
        ) : null}

        {step === "syncing" ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="animate-spin text-cyan-500" />
            <p className="text-sm text-zinc-500">Verifying credentials and syncing models...</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
