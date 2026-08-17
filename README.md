<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cat.svg" width="80" height="80" alt="Meow Code Logo" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.2));" />
  <h1>🐱 MEOW CODE</h1>
  <p><b>One workspace. Every AI. Your data, your rules.</b></p>
  <p>
    <img src="https://img.shields.io/badge/Architecture-100%25%20Stateless-blueviolet?style=for-the-badge" alt="Stateless" />
    <img src="https://img.shields.io/badge/Privacy-Edge%20Encrypted-success?style=for-the-badge" alt="Privacy" />
    <img src="https://img.shields.io/badge/AI-Multi--Agent%20Orchestrator-ff69b4?style=for-the-badge" alt="AI" />
    <img src="https://img.shields.io/badge/Tech-Next.js%20%7C%20Fastify-black?style=for-the-badge" alt="Tech Stack" />
  </p>
  <p>
    <i>Meow Code is a privacy-first, unified AI workspace where authorized AI providers become interchangeable workers behind one persistent project, memory, tool, connector, agent, and workflow layer.</i>
  </p>
</div>

---

## 🌟 The Vision

Every day, builders jump between five different AI tabs — one for coding, one for research, one for images, one for "the model that's actually good at this specific thing." Each tab forgets everything the moment you close it. None of them know what the others just did.

**Meow Code** doesn't replace those models. It **orchestrates** them — behind one continuous interface, with one persistent memory, one project state, and an **uncompromising privacy-first architecture** that treats your credentials and your work as yours by default.

### 🛡️ The Three Laws of Meow

1. **Meow owns the workspace, not your AI credentials.** (100% Stateless backend).
2. **Memory belongs to your project, not to a single AI session.**
3. **Orchestration stays out of the hot path** — so Meow feels as fast and native as talking to the provider directly.

---

## 🚀 God-Tier Features (Showcase Ready)

Meow Code has evolved far beyond a standard AI wrapper. It is a fully autonomous, sandboxed, multi-agent operating system.

### 1. 🤖 Multi-Agent Orchestration (`spawn_subagent`)
When you assign Meow a massive task, it doesn't just try to answer in one go. The main agent can **spawn recursive background subagents**, passing them explicit tool access and goals. 
- Subagents execute isolated reasoning loops up to a depth of 5 to prevent infinite runaway.
- They utilize the exact same filesystem and shell tools as the primary agent.
- The UI seamlessly pauses the main stream, waits for the background worker to finish, and streams the synthesized result.

### 2. ⚡ Live Artifact Rendering (Interactive Previews)
Why copy and paste code when you can see it? Meow intercepts any generated `HTML` or `SVG` block and provides a **Live Preview** toggle button.
- **Sandboxed Execution**: Code runs inside a securely constrained `iframe` (`sandbox="allow-scripts allow-forms allow-same-origin"`).
- **Rapid Prototyping**: Tell Meow to *"Build a React-style tic-tac-toe game in a single HTML file"* and literally play it inside the chat UI seconds later.

### 3. 🌐 Native Internet & RAG (`fetch_url`)
Meow doesn't hallucinate APIs. Armed with the `fetch_url` tool, the agent can natively fetch documentation, crawl sites, and ingest live data directly into its context window on demand. 
- It bypasses standard LLM training cut-offs by actively researching modern libraries mid-conversation.

### 4. 🎛️ Real-Time Telemetry & Transparency
Enterprise AI requires trust. Meow Code features a beautiful **Telemetry UI**. 
- Whenever the agent thinks, uses a tool, or spawns a subagent, the frontend renders pulsating status badges (`🤖 Running Tool...`, `✅ Tool Output`).
- You can watch the exact bash commands, file modifications, and web scraping operations the AI is performing in real-time.

### 5. 🧠 Prompt Overrides & Planners
By typing `/plan` before your prompt, you can force the AI into an architectural mindset. The frontend dynamically intercepts this slash command, injecting a stealth system prompt that forces the LLM to output a meticulous Markdown checklist rather than jumping straight into code.

---

## 🏗️ 100% Stateless Privacy Architecture

Most AI platforms store your API keys and chat logs in their cloud databases. **Meow Code does not.**

```mermaid
sequenceDiagram
    participant User
    participant IndexedDB
    participant Client
    participant MeowServer
    participant AIProvider

    User->>IndexedDB: Securely save Provider API Keys (Local Only)
    Client->>IndexedDB: Retrieve Keys
    Client->>MeowServer: Send Chat + `x-provider-keys` header
    Note over MeowServer: 100% Stateless. No DB.<br/>Parses header in-memory.
    MeowServer->>AIProvider: Execute Query with intercepted Keys
    AIProvider-->>MeowServer: Stream Response
    MeowServer-->>Client: Stream Response + Telemetry
```

**Privacy Guarantees:**
- 🚫 **No Accounts Required**: No Gmail, OAuth, or passwords.
- 🚫 **No Server-Side Key Storage**: Your API keys never touch a database.
- 🚫 **No Persistent Logs**: Chat logs exist locally in your browser memory.
- ✅ **Edge-Encrypted**: Keys are kept in the browser's **IndexedDB** using `idb-keyval`.
- ✅ **Stateless Bridge**: The Node.js Fastify backend acts as an ephemeral proxy, decoding the `x-provider-keys` header on the fly.

---

## 🛠️ The Agent Bridge (God Mode Tools)

The backend provides the AI with a suite of native filesystem and execution tools. Through recursive `TOOL_CALL` intercepts, the AI operates as a fully autonomous developer on your machine.

| Tool Identifier | Capability & Security Scope |
|-----------------|-----------------------------|
| `execute_command` | Full terminal access. Executes shell commands (npm, git, bash) locally. |
| `read_file` | Read the exact state of your local codebase files to prevent blind edits. |
| `write_file` | Scaffold new applications, config files, and components instantly. |
| `append_file` | Add lines to logs or `.env` files safely. |
| `replace_file_content` | Precision patching. Replaces specific strings to avoid rewriting entire files. |
| `list_dir` | Directory traversal to understand the structure of the project. |
| `fetch_url` | Web scraping and documentation ingestion. |
| `spawn_subagent` | **Parallel background workers** that share the exact same toolset. |

### How the Bridge Works Under the Hood
1. The AI outputs a block formatted as `TOOL_CALL: {"name": "...", "args": {...}}`.
2. The Fastify server intercepts the stream, pauses it, and executes the native Node.js function (`execSync`, `readFileSync`, etc).
3. The server appends the tool's output to the message history.
4. The server **re-invokes** the AI with the updated history, repeating this recursive loop until the AI stops calling tools and provides a final answer to the user.

---

## ⚙️ Tech Stack & Architecture

Meow Code is built as an `npm workspace` monorepo for maximum modularity.

- **Frontend (Web)**: [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/) (Headless accessibility).
- **Backend (API)**: [Fastify](https://fastify.dev/) for ultra-high-performance routing, stream handling, and tool execution.
- **AI SDK**: `@ai-sdk/core` for seamless multi-provider streaming (Claude, OpenAI, Gemini).
- **Local Storage**: `idb-keyval` for secure, browser-native IndexedDB credential management.
- **Styling**: `@meowcode/ui` custom design system (Minimalist, dark-mode native, high-contrast).

---

## 💻 Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### 1. Install Dependencies
From the root of the monorepo, install all workspace packages:
```bash
npm install
```

### 2. Run the Development Server
This will concurrently boot the Next.js frontend and the Fastify backend:
```bash
npm run dev
```

### 3. Build for Production
To compile the TypeScript project and build the optimized Next.js bundle:
```bash
npm run build
```

The Web UI will be available at `http://localhost:3000` and the API layer at `http://localhost:4000`.

---

## 🗺️ Roadmap

- **Phase 1 (Web)**: Stateless Architecture, Multi-Agent Bridge, Live Artifacts, Local Key Management. *(Completed)*
- **Phase 2 (CLI)**: Bring the exact same Orchestrator directly to the terminal for headless operations.
- **Phase 3 (Desktop)**: Native OS integrations (Electron/Tauri) and persistent local Vector DB memory for Cross-Chat Intelligence.
- **Phase 4 (Mobile)**: Remote session control, workflow management, and agent monitoring on the go.

---

## 🤝 Contributing & Extending Tools

To add a new tool to the AI's God-Mode arsenal:
1. Open `apps/api/src/routes/chats.ts`.
2. Add your tool signature to the `AGENT_TOOLS` system prompt string.
3. Implement the execution logic inside the `executeTool()` function.
4. The LLM will automatically understand and utilize your new capability.

---

<div align="center">
  <p><i>Built for builders who refuse to compromise on power or privacy.</i></p>
</div>
