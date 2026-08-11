# Architecture

Meow Code is split into three product surfaces and shared platform packages.

## Product Surfaces

- **Web**: Next.js App Router application with chat, workspace, provider, model, prompt, and analytics experiences.
- **CLI**: Native-feeling developer assistant launched with `meow`, sharing identity, workspaces, routing, chats, and provider credentials with the web app.
- **API**: Fastify backend exposing platform APIs and OpenAI-compatible endpoints.

## Core Flow

1. A user signs in and selects a workspace.
2. Provider credentials are encrypted and stored at workspace or user scope.
3. Provider plugins synchronize model metadata dynamically.
4. Routing rules select candidate models by policy.
5. The API normalizes requests, streams provider responses, records usage, and syncs conversations.

## Packages

- `@meowcode/shared`: canonical domain types.
- `@meowcode/providers`: plugin contracts, registry, OpenAI-compatible provider adapter.
- `@meowcode/router`: routing policies, health scoring, fallbacks.
- `@meowcode/auth`: RBAC and authentication contracts.
- `@meowcode/database`: Prisma schema and client lifecycle.
- `@meowcode/sdk`: typed client used by web, CLI, and integrations.
- `@meowcode/ui`: shared UI primitives.

## Security

- Secrets are encrypted before persistence.
- Workspace access is role-based.
- Audit events are recorded for authentication, provider changes, secret access, routing changes, and API key activity.
- Public API keys are scoped, rotatable, and rate-limited.

## Operations

The deployment is Docker-first and Kubernetes-ready. OpenTelemetry hooks, Prometheus metrics, Redis queues, and Postgres persistence are part of the platform baseline.
