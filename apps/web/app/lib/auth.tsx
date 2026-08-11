"use client";

import * as React from "react";
import { MeowClient, type AuthUser } from "@meowcode/sdk";

import { getPublicApiUrl } from "./api-url";

const ACCESS_KEY = "meow_access_token";
const REFRESH_KEY = "meow_refresh_token";

function getApiUrl(): string {
  return getPublicApiUrl();
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
}

export interface AuthContextValue {
  ready: boolean;
  user: AuthUser | null;
  client: MeowClient;
  workspaceId: string | null;
  completeOAuth: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<AuthUser | null>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  setWorkspaceId: (id: string | null) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(null);

  const clientRef = React.useRef(
    new MeowClient({
      baseUrl: getApiUrl(),
      accessToken: undefined,
      refreshToken: undefined,
      onTokensUpdated: ({ accessToken, refreshToken }) => {
        writeStorage(ACCESS_KEY, accessToken);
        writeStorage(REFRESH_KEY, refreshToken);
        clientRef.current.setTokens(accessToken, refreshToken);
      }
    })
  );

  const refreshMe = React.useCallback(async () => {
    try {
      const me = await clientRef.current.me();
      setUser(me);
      const ws = me.workspaceId ?? me.workspaces?.[0]?.id ?? null;
      setWorkspaceId(ws);
      return me;
    } catch {
      setUser(null);
      setWorkspaceId(null);
      return null;
    }
  }, []);

  React.useEffect(() => {
    async function boot() {
      const access = readStorage(ACCESS_KEY);
      const refresh = readStorage(REFRESH_KEY);
      clientRef.current.setTokens(access ?? undefined, refresh ?? undefined);
      if (refresh || access) {
        try {
          if (!access && refresh) {
            const tokens = await clientRef.current.refresh();
            writeStorage(ACCESS_KEY, tokens.accessToken);
            writeStorage(REFRESH_KEY, tokens.refreshToken);
            clientRef.current.setTokens(tokens.accessToken, tokens.refreshToken);
          }
          await refreshMe();
        } catch {
          writeStorage(ACCESS_KEY, null);
          writeStorage(REFRESH_KEY, null);
          clientRef.current.setTokens(undefined, undefined);
          setUser(null);
        }
      }
      setReady(true);
    }
    void boot();
  }, [refreshMe]);

  const completeOAuth = React.useCallback(
    async (accessToken: string, refreshToken: string) => {
      writeStorage(ACCESS_KEY, accessToken);
      writeStorage(REFRESH_KEY, refreshToken);
      clientRef.current.setSessionTokens(accessToken, refreshToken);
      await refreshMe();
    },
    [refreshMe]
  );

  const logout = React.useCallback(async () => {
    try {
      await clientRef.current.logout();
    } catch {
      // ignore network logout failures
    }
    writeStorage(ACCESS_KEY, null);
    writeStorage(REFRESH_KEY, null);
    clientRef.current.setTokens(undefined, undefined);
    setUser(null);
    setWorkspaceId(null);
  }, []);

  const switchWorkspace = React.useCallback(
    async (id: string) => {
      const result = await clientRef.current.switchWorkspace(id);
      writeStorage(ACCESS_KEY, result.accessToken);
      writeStorage(REFRESH_KEY, result.refreshToken);
      clientRef.current.setTokens(result.accessToken, result.refreshToken);
      setWorkspaceId(result.workspaceId);
      await refreshMe();
    },
    [refreshMe]
  );

  const value: AuthContextValue = {
    ready,
    user,
    client: clientRef.current,
    workspaceId,
    completeOAuth,
    logout,
    refreshMe,
    switchWorkspace,
    setWorkspaceId
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
