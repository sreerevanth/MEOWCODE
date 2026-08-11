# API Specification

## Auth

- `POST /v1/auth/signup`: create account (email/password), returns access + refresh tokens.
- `POST /v1/auth/login`: authenticate, returns tokens and workspace context.
- `POST /v1/auth/refresh`: rotate tokens using refresh token.
- `POST /v1/auth/logout`: revoke session.
- `GET /v1/auth/me`: current principal, onboarding step, workspaces.
- `PATCH /v1/auth/me`: update profile / onboarding step / preferences.
- `POST /v1/auth/switch-workspace`: re-issue tokens for a workspace membership.
- `POST /v1/auth/api-keys`: create workspace API key.
- `GET /v1/auth/api-keys`: list API keys.
- `DELETE /v1/auth/api-keys/:id`: revoke API key.

All platform routes below require `Authorization: Bearer <accessToken|meow_api_key>`.

## Platform API

- `GET /health`: service health.
- `GET /v1/workspaces`: list accessible workspaces.
- `POST /v1/workspaces`: create a workspace.
- `GET /v1/workspaces/:id`: workspace detail + settings + counts.
- `PATCH /v1/workspaces/:id`: update workspace name/settings.
- `GET /v1/workspaces/:id/members`: list members.
- `POST /v1/workspaces/:id/invites`: invite teammate (optional during onboarding).
- `POST /v1/workspaces/:id/invites/skip`: skip invite step.
- `GET /v1/providers/catalog`: available provider plugins.
- `GET /v1/providers`: list configured workspace providers.
- `POST /v1/providers`: connect or update a provider (credentials encrypted).
- `PATCH /v1/providers/:id`: update provider connection.
- `POST /v1/providers/:id/verify`: verify credentials.
- `POST /v1/providers/:id/sync` / `sync-models`: synchronize dynamic model catalog.
- `DELETE /v1/providers/:id`: remove provider + models.
- `GET /v1/models`: list synchronized workspace models.
- `GET /v1/chats`: list conversations (supports `q` search).
- `POST /v1/chats`: create a conversation.
- `PATCH /v1/chats/:id`: update title/pin/favorite/shared.
- `DELETE /v1/chats/:id`: delete conversation.
- `GET /v1/chats/:id/messages`: list messages.
- `POST /v1/chats/:id/messages`: append user message and complete/stream.
- `GET /v1/usage`: token, cost, latency, and request analytics.
- `POST /v1/uploads`: multipart file upload (images/PDF/text).
- `GET /v1/uploads`: list workspace uploads.

## OpenAI-Compatible API

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`

The API accepts OpenAI-compatible payloads, enriches them with workspace routing context, forwards them through a provider plugin, persists conversation messages when `conversationId` is provided, records usage, and normalizes responses.

## Streaming

Streaming uses Server-Sent Events with OpenAI-compatible `data:` frames. Provider plugins can expose native streams or async iterables; the API normalizes both.
