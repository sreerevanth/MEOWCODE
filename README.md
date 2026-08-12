# 🐱 Meow Code

**One workspace. Every AI. Your data, your rules.**

> Meow Code is a privacy-first, unified AI workspace where authorized AI providers become interchangeable workers behind one persistent project, memory, tool, connector, agent, and workflow layer.

```
                     ╭──────────────────╮
                     │     MEOW CORE     │
                     ╰────────┬─────────╯
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
            WEB             CLI            DESKTOP
                                                │
                                             MOBILE
```

---

## Why Meow?

Every day, builders jump between five different AI tabs — one for coding, one for research, one for images, one for "the model that's actually good at this specific thing." Each tab forgets everything the moment you close it. None of them know what the others just did.

Meow doesn't replace those models. It **orchestrates** them — behind one continuous interface, with one persistent memory, one project state, and one privacy-first architecture that treats your credentials and your work as yours by default.

**The three laws Meow is built on:**

1. **Meow owns the workspace, not your AI credentials.**
2. **Memory belongs to your project, not to a single AI session.**
3. **Orchestration stays out of the hot path** — so Meow feels as fast and native as talking to the provider directly.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Core Systems](#core-systems)
- [Privacy & Security](#privacy--security)
- [Local-First Storage](#local-first-storage)
- [Roadmap](#roadmap)
- [Design Principles](#design-principles)
- [A Note on Provider Compliance](#a-note-on-provider-compliance)

---

## How It Works

```
  You                Meow                  AI Provider
   │                   │                        │
   │  "fix the bug"    │                        │
   ├──────────────────►│                        │
   │                   │  route to best worker  │
   │                   ├───────────────────────►│
   │                   │                        │
   │                   │◄───────────────────────┤
   │◄──────────────────┤     stream response    │
   │                   │                        │
   │                   │  (async, in background) │
   │                   ├─── update memory ───┐   │
   │                   ├─── update state  ───┤   │
   │                   └─── index session ───┘   │
```

You send one message into one chat. Meow's **Orchestrator** figures out which authorized provider and model is best suited for the task, executes it, streams the response back — and only *afterward*, quietly in the background, updates your project's memory and state. Nothing expensive happens in the path between your message and your answer.

---

## Architecture

### The Orchestrator

The brain of Meow. Every request flows through it, but it stays deliberately thin.

```
Meow Orchestrator
├── Session Orchestrator   → tracks live sessions & workers
├── Model Router           → picks the right model for the task
├── Context Manager        → decides what the AI actually needs to see
├── Task Planner           → breaks work into steps
├── Memory Manager         → persists what's worth remembering
├── State Manager          → tracks what's happening right now
├── Workflow Engine        → runs automations & multi-step agents
└── Permission Manager     → enforces scopes on every tool & connector
```

### The Provider Layer

AI providers are pluggable, replaceable **workers** — never the source of truth.

```
AIProvider
├── identity        ├── sessions      ├── files
├── authorization    ├── messages      ├── tools
├── capabilities     ├── streaming     └── usage
└── models
```

```
providers/
├── claude/
├── openai/
├── gemini/
├── openrouter/
├── local/
└── ...
```

Each adapter speaks the same interface, so Meow can route a coding task to a coding-strong model, an image task to an image-capable provider, and a quick question to whatever's fastest — without you lifting a finger.

### Memory: Hot, Warm, Cold

Meow never dumps your entire history into a prompt. It retrieves only what's relevant.

```
🔥 Hot Memory    → current task + current state
🌤️  Warm Memory   → session summaries + key facts
🧊 Cold Memory   → full historical sessions, compressed & indexed
```

```
New Task → Memory Query → Relevant Memory + Session + Files → Context Builder → AI
```

**Memory** is what happened and what was learned. **State** is what's happening right now. Meow keeps the two distinct on purpose — conflating them is how workspaces rot into noise.

### Session Handoff

When Meow moves work between authorized workers, it passes a lean handoff packet — not your whole conversation history:

```
Current Task · Project State · Key Decisions · Recent Discoveries
Files Changed · Failed Approaches · Unfinished Work · Next Action
```

Minimum necessary context, every time.

---

## Core Systems

| System | What it does |
|---|---|
| **Unified Chat** | One conversation surface — streaming, markdown, code, files, history, search, regeneration, export |
| **Project Workspace** | Every project isolated with its own files, sessions, memory, workflows, connectors, and settings |
| **Connectors** | GitHub, Google Drive, Slack, Notion, databases, REST APIs, terminal, and custom integrations |
| **Agents** | Goal-driven workers with their own tools, memory, and permissions — capable of planning, tool use, and self-correction |
| **Multi-Agent Orchestration** | Research, Coding, and Review agents (and more) sharing one workspace state, coordinated by a main agent |
| **Cross-Chat Intelligence** | Knowledge from an architecture discussion in Chat A is available to the implementation work in Chat B |
| **Workflow Engine** | Trigger → Task → AI reasoning → Tool → Result → Next Step, for automation without babysitting |
| **Event Bus** | `SESSION_STARTED`, `TOOL_COMPLETED`, `MEMORY_CREATED`, and friends — keeps UI, logging, and background processing decoupled from the request path |
| **Output System** | Everything Meow produces — code, docs, reports, generated media — becomes a tracked, exportable artifact |
| **Project Export** | Full ZIP export of files, memory, conversations, and workflow definitions. Secrets and tokens are never included. |

---

## Privacy & Security

> **Your AI connections and project data belong to you.**

**Meow never stores:**
- Provider passwords (you're never asked to paste one)
- Raw OAuth secrets in ordinary database tables
- Full AI transcripts, centrally, by default
- Entire codebases in the cloud, unless you explicitly opt in
- Credentials your workflows don't actually need

**Meow prefers:**
- Official provider OAuth, using officially granted scopes only
- Client-side encrypted credential storage
- Local-first project and session data
- A minimal cloud control plane — metadata, not content
- Explicit, revocable, auditable permissions

The cloud database (e.g. Supabase) stays a **control plane**: users, projects, permissions, settings. It does not become a warehouse for millions of chat transcripts and tool calls.

**Also baked in:** encryption at rest and in transit, OAuth state validation, CSRF protection, session expiration, token rotation, tool sandboxing, connector isolation, audit logs, rate limiting, secret redaction, and strict project/user isolation.

---

## Local-First Storage

```
.meow/
├── workspace.db
├── sessions/          → per-provider session logs
├── memory/
│   ├── facts/
│   ├── decisions/
│   ├── discoveries/
│   ├── failures/
│   └── summaries/
├── state/              → project.json · tasks.json · current.json
├── indexes/
├── files/
└── vault/              → encrypted credentials
```

Heavy, sensitive workspace data lives with the user wherever practical. The cloud only ever sees what it needs to coordinate access — not the content of your work.

---

## Roadmap

### Phase 1 — Web
Authentication · Projects · Unified Chat · Provider Connections · Model Router · Orchestrator · Memory · Sessions · Basic Tools & Connectors · Export

### Phase 2 — CLI
Same Meow Core, now in your terminal — project access, agent execution, git, local tools, workflows.

### Phase 3 — Desktop
Local filesystem and memory, terminal, git, background agents, local model support, native OS integrations.

### Phase 4 — Mobile
Unified chat, project access, workflow control, agent monitoring, notifications, remote session control.

**One core. Four clients.** Web, CLI, Desktop, and Mobile all sit on top of the same shared Meow Core — provider abstraction, model router, session manager, memory, agent engine, workflow engine, connectors, permissions, and tools. No app reinvents the brain; each just gives it a different face.

### Looking further out

- Full multimodal capability layer — text, image, audio, video, vision, declared per-model and used by the router automatically
- Deeper automation: issue triage, PR assistance, scheduled research, content pipelines, cloud operations
- The long-term vision — **you describe the outcome, Meow coordinates the models, tools, connectors, and workflows needed to get there.**

---

## Design Principles

- **Thin hot path.** Nothing expensive — no summarization, no big retrieval, no heavy writes — sits between your message and your answer. That work happens asynchronously, after you already have your response.
- **Memory outlives the session.** A provider's context window is not your workspace's memory. Meow's memory layer persists independently of which model you happened to be talking to.
- **Isolation by default.** Every project, every user, every connector is sandboxed from the others.
- **Retrieve, don't dump.** Context sent to any model is the *minimum necessary* — never the entire project, never the entire history.
- **Replaceable workers, permanent workspace.** Providers can be swapped, added, or dropped. Your project, memory, and state persist regardless of who's doing the work underneath.

---

## A Note on Provider Compliance

Meow orchestrates **authorized** provider connections and sessions, strictly according to the capabilities and restrictions those providers expose through their official APIs and authorization scopes.

To be explicit about what that means:

- OAuth authorization grants access to what the provider's API scopes allow — it does not imply control over a provider's consumer web interface.
- Every adapter uses official APIs and official authorization flows. If a provider doesn't officially support a given automation path, that adapter doesn't pretend otherwise.
- Meow is not designed to circumvent provider limits, rate limits, or account restrictions by rotating credentials or accounts. It's designed to make working across the providers *you've* legitimately connected feel like one continuous workspace.

This isn't a legal disclaimer bolted on afterward — it's a load-bearing architectural constraint. Building around official, documented provider capabilities is what keeps Meow durable when a provider's policies or interfaces change, instead of breaking (or getting shut down) the moment they do.

---

<p align="center"><i>Meow Code — the workspace remembers, even when the model changes.</i></p>
