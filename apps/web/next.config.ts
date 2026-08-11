import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";

const webDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(webDir, "../..");
loadEnvConfig(rootDir);

const serverApiUrl = (process.env.MEOW_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");

/** Browser uses same-origin /v1/*; Next rewrites to the API server. */
const clientApiUrl = process.env.NEXT_PUBLIC_MEOW_API_URL?.replace(/\/$/, "") ?? "";

const nextConfig = {
  transpilePackages: ["@meowcode/ui", "@meowcode/sdk"],
  env: {
    NEXT_PUBLIC_MEOW_API_URL: clientApiUrl
  },
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${serverApiUrl}/v1/:path*`
      }
    ];
  },
  async redirects() {
    return [
      { source: "/auth/login", destination: "/auth", permanent: true },
      { source: "/auth/signup", destination: "/auth", permanent: true },
      { source: "/onboarding", destination: "/", permanent: false }
    ];
  }
};

export default nextConfig;
