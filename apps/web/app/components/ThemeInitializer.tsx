"use client";

import * as React from "react";
import { useAuth } from "../lib/auth";

function applyTheme(theme: string): void {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeInitializer(): null {
  const { ready, user, client, workspaceId } = useAuth();

  React.useEffect(() => {
    if (!ready || !user || !workspaceId) return;
    let cancelled = false;
    void client
      .getWorkspace(workspaceId)
      .then((ws) => {
        if (cancelled) return;
        const theme = (ws as { settings?: { theme?: string } }).settings?.theme ?? "system";
        applyTheme(theme);
      })
      .catch(() => {
        // keep default theme from layout
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user, client, workspaceId]);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      void client.getWorkspace(workspaceId ?? "").then((ws) => {
        const theme = (ws as { settings?: { theme?: string } }).settings?.theme ?? "system";
        if (theme === "system") applyTheme("system");
      }).catch(() => undefined);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [client, workspaceId]);

  return null;
}
