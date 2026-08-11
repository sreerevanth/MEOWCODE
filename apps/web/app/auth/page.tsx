"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Loader2, Mail } from "lucide-react";
import { Button } from "@meowcode/ui";
import { MeowClient } from "@meowcode/sdk";
import { useAuth } from "../lib/auth";

import { getPublicApiUrl } from "../lib/api-url";

const API_URL = getPublicApiUrl();

const PROVIDER_ICONS: Record<string, string> = {
  google: "G",
  github: "GH",
  microsoft: "MS",
  discord: "D"
};

function AuthContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, user } = useAuth();
  const error = searchParams.get("error");
  const [providers, setProviders] = React.useState<Array<{ id: string; displayName: string; enabled: boolean }>>([]);
  const [magicEmail, setMagicEmail] = React.useState("");
  const [magicSent, setMagicSent] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!ready) return;
    if (user) router.replace("/");
  }, [ready, user, router]);

  React.useEffect(() => {
    const client = new MeowClient({ baseUrl: API_URL });
    void client.oauthProviders().then((items) => {
      setProviders(items);
      setLoading(false);
    });
  }, []);

  const continueWith = (providerId: string) => {
    window.location.href = `${API_URL}/v1/auth/oauth/${providerId}`;
  };

  const sendMagicLink = async () => {
    if (!magicEmail.trim()) return;
    setBusy(true);
    try {
      const client = new MeowClient({ baseUrl: API_URL });
      const result = await client.requestMagicLink(magicEmail.trim());
      setMagicSent(result.link ?? result.message);
    } catch (err) {
      setMagicSent(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setBusy(false);
    }
  };

  if (ready && user) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 dark:bg-[#101014]">
        <Loader2 className="animate-spin text-cyan-500" />
      </main>
    );
  }

  const sorted = [...providers].sort((a, b) => {
    const order = ["google", "github", "microsoft", "discord"];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 text-zinc-950 dark:bg-[#101014] dark:text-zinc-50">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-md bg-cyan-500 text-zinc-950">
            <Bot size={26} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Meow Code</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Sign in to chat with any AI model</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Sign in failed: {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-cyan-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((provider) => (
              <Button
                key={provider.id}
                variant={provider.id === "google" ? "primary" : "secondary"}
                className="h-11 w-full justify-start gap-3 text-sm font-medium"
                disabled={!provider.enabled}
                onClick={() => continueWith(provider.id)}
              >
                <span className="grid size-7 place-items-center rounded-md bg-zinc-200 text-xs font-bold dark:bg-zinc-800">
                  {PROVIDER_ICONS[provider.id] ?? provider.displayName.slice(0, 2)}
                </span>
                Continue with {provider.displayName}
              </Button>
            ))}
          </div>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-xs text-zinc-500">or</span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="space-y-2">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Magic link</span>
            <input
              type="email"
              className="h-10 w-full rounded-md border border-zinc-200 bg-stone-50 px-3 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="you@company.com"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
            />
          </label>
          <Button className="w-full gap-2" variant="ghost" disabled={busy || !magicEmail.trim()} onClick={() => void sendMagicLink()}>
            <Mail size={16} /> Email me a sign-in link
          </Button>
          {magicSent ? <p className="break-all text-xs text-zinc-500">{magicSent}</p> : null}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          First sign-in creates your account and personal workspace automatically.
        </p>
      </div>
    </main>
  );
}

export default function AuthPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-stone-50 dark:bg-[#101014]">
          <Loader2 className="animate-spin text-cyan-500" />
        </main>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
