# Meow Code

Meow Code is a TypeScript monorepo for a universal AI platform: a Claude/ChatGPT-style web app, a Claude Code-style CLI, and a unified backend for providers, routing, workspaces, analytics, and OpenAI-compatible APIs.

## Workspace

```text
apps/
  web      Next.js App Router UI
  api      Fastify API and OpenAI-compatible endpoints
  cli      `meow` terminal assistant
packages/
  auth     auth, RBAC, secret encryption contracts
  database Prisma schema and database client
  providers provider plugin registry and adapters
  router   routing policies, fallback, health scoring
  sdk      typed API client
  shared   domain types and utilities
  ui       shared React primitives
```

## Start

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:generate
npx prisma db push --schema packages/database/prisma/schema.prisma
npm run dev:api
npm run dev
```

Postgres is exposed on `localhost:5433` and Redis on `localhost:6380` by default (to avoid common local port clashes). Update `.env` if you change those mappings.

The CLI package exposes the `meow` binary:

```bash
npm install -g @meowcode/cli
meow login you@example.com your-password
meow
```

Unauthenticated web visits redirect to `/auth`. OAuth sign-in creates a personal workspace and sends you straight to chat.
## Design Principles

- Providers are plugins. Core code depends on the `ProviderPlugin` contract, not concrete provider SDKs.
- Models are discovered dynamically through provider APIs and persisted per workspace.
- Routing is policy-driven and can combine cost, latency, health, modality, locality, and fallback chains.
- Web and CLI use the same account, workspaces, provider credentials, routing rules, prompts, and chats.
- Public API compatibility follows OpenAI request/response shapes where possible.

See [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md), and [docs/providers.md](docs/providers.md).
