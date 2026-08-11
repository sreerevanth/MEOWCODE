"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth";

import { getPublicApiUrl } from "../../lib/api-url";

const API_URL = getPublicApiUrl();

function CallbackContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, completeOAuth } = useAuth();

  React.useEffect(() => {
    if (!ready) return;

    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const magicToken = searchParams.get("magic_token");

    async function finish() {
      if (magicToken) {
        window.location.href = `${API_URL}/v1/auth/magic-link/verify?token=${encodeURIComponent(magicToken)}`;
        return;
      }
      if (accessToken && refreshToken) {
        await completeOAuth(accessToken, refreshToken);
        router.replace("/");
        return;
      }
      router.replace("/auth?error=missing_tokens");
    }

    void finish();
  }, [ready, searchParams, completeOAuth, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 dark:bg-[#101014]">
      <Loader2 className="animate-spin text-cyan-500" />
    </main>
  );
}

export default function AuthCallbackPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-stone-50 dark:bg-[#101014]">
          <Loader2 className="animate-spin text-cyan-500" />
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
