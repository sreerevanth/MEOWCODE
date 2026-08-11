#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { MeowClient } from "@meowcode/sdk";

const program = new Command();
program.name("meow").description("Meow Code CLI").version("0.1.0");

const configDir = join(homedir(), ".meow");
const configPath = join(configDir, "config.json");

interface CliConfig {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  workspaceId?: string;
  baseUrl?: string;
}

function loadConfig(): CliConfig {
  try {
    if (!existsSync(configPath)) return {};
    return JSON.parse(readFileSync(configPath, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

function saveConfig(config: CliConfig): void {
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

function createClient(config: CliConfig): MeowClient {
  return new MeowClient({
    baseUrl: config.baseUrl ?? process.env.MEOW_API_URL ?? "http://localhost:4000",
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    apiKey: config.apiKey,
    onTokensUpdated: ({ accessToken, refreshToken }) => {
      const next = { ...loadConfig(), accessToken, refreshToken };
      saveConfig(next);
    }
  });
}

let currentRoutingMode = "auto";
let currentModel: string | undefined = undefined;
let currentConversationId: string | undefined = undefined;

program
  .command("login")
  .argument("<email>")
  .argument("<password>")
  .action(async (email: string, password: string) => {
    const config = loadConfig();
    const client = createClient(config);
    const result = await client.login({ email, password });
    saveConfig({
      ...config,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      workspaceId: result.user.workspaceId ?? config.workspaceId
    });
    output.write(`Logged in as ${result.user.email}\n`);
  });

program
  .command("logout")
  .action(async () => {
    const config = loadConfig();
    const client = createClient(config);
    try {
      await client.logout();
    } catch {
      // ignore
    }
    saveConfig({ baseUrl: config.baseUrl });
    output.write("Logged out.\n");
  });

program.action(async () => {
  const config = loadConfig();
  const client = createClient(config);

  if (!config.accessToken && !config.apiKey && !config.refreshToken) {
    output.write("Not authenticated. Run: meow login <email> <password>\n");
    process.exitCode = 1;
    return;
  }

  let workspaceLabel = config.workspaceId ?? "unknown";
  try {
    const me = await client.me();
    workspaceLabel = me.workspaceId ?? me.workspaces?.[0]?.id ?? workspaceLabel;
    if (me.workspaceId && me.workspaceId !== config.workspaceId) {
      saveConfig({ ...config, workspaceId: me.workspaceId });
    }
  } catch (err) {
    output.write(`Auth error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  const terminal = readline.createInterface({ input, output, prompt: "meow> " });

  output.write(`
╭────────────────────────────────────────────╮
│              Meow Code CLI v0.1            │
│ Workspace : ${workspaceLabel.slice(0, 31).padEnd(31)}│
│ Router    : ${currentRoutingMode.padEnd(31)}│
╰────────────────────────────────────────────╯
Type /help for commands or start chatting.

`);

  terminal.prompt();
  for await (const line of terminal) {
    const text = line.trim();
    if (!text) {
      terminal.prompt();
      continue;
    }
    if (text === "/exit" || text === "/quit") break;
    if (text === "/clear") {
      output.write("\x1Bc");
      terminal.prompt();
      continue;
    }
    if (text === "/help") {
      output.write(commandsHelp());
      terminal.prompt();
      continue;
    }
    if (text === "/providers") {
      await printProviders(client, loadConfig().workspaceId);
      terminal.prompt();
      continue;
    }
    if (text === "/models") {
      await printModels(client, loadConfig().workspaceId);
      terminal.prompt();
      continue;
    }
    if (text === "/whoami") {
      try {
        const me = await client.me();
        output.write(`${me.email} · workspace ${me.workspaceId ?? "none"} · ${me.onboardingStep}\n`);
      } catch (err) {
        output.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      terminal.prompt();
      continue;
    }
    if (text === "/workspaces") {
      try {
        const workspaces = await client.workspaces();
        for (const ws of workspaces) {
          output.write(`${ws.id.padEnd(28)} ${ws.name} (${ws.kind})\n`);
        }
      } catch (err) {
        output.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      terminal.prompt();
      continue;
    }
    if (text.startsWith("/workspace ")) {
      const id = text.split(" ")[1];
      if (id) {
        try {
          const result = await client.switchWorkspace(id);
          saveConfig({
            ...loadConfig(),
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            workspaceId: result.workspaceId
          });
          client.setTokens(result.accessToken, result.refreshToken);
          output.write(`Switched to workspace ${result.workspaceId}\n`);
        } catch (err) {
          output.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        }
      }
      terminal.prompt();
      continue;
    }
    if (text.startsWith("/router")) {
      const mode = text.split(" ")[1];
      if (mode) {
        currentRoutingMode = mode;
        output.write(`Routing mode set to: ${currentRoutingMode}\n`);
      } else {
        output.write(
          `Current routing mode: ${currentRoutingMode}\nAvailable: auto, cheapest, fastest, highest_quality, free_only, local_only, vision, reasoning\n`
        );
      }
      terminal.prompt();
      continue;
    }
    if (text.startsWith("/model")) {
      const modelId = text.split(" ")[1];
      if (modelId) {
        currentModel = modelId;
        currentRoutingMode = "manual_model";
        output.write(`Model locked to: ${currentModel}\n`);
      } else {
        output.write(`Current selected model: ${currentModel ?? "None (Auto)"}\n`);
      }
      terminal.prompt();
      continue;
    }
    if (text === "/history") {
      await printHistory(client, loadConfig().workspaceId);
      terminal.prompt();
      continue;
    }
    if (text === "/new") {
      try {
        const chat = await client.createConversation("CLI Conversation", loadConfig().workspaceId);
        currentConversationId = chat.id;
        output.write(`Started conversation ${chat.id}\n`);
      } catch (err) {
        output.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      terminal.prompt();
      continue;
    }
    if (text.startsWith("/")) {
      output.write(`Unknown command ${text}. Type /help for supported commands.\n`);
      terminal.prompt();
      continue;
    }

    await streamPrompt(client, text, loadConfig().workspaceId);
    terminal.prompt();
  }

  terminal.close();
});

program.parseAsync();

function commandsHelp(): string {
  return `
/help                  Show commands menu
/whoami                Show authenticated user
/workspaces            List workspaces
/workspace <id>        Switch workspace
/models                List synchronized models
/providers             List provider connections
/router [mode]         Set routing policy
/model [model_id]      Force specific model
/history               Show conversation history
/new                   Start a new conversation
/clear                 Clear screen
/exit                  Exit shell

`;
}

async function printProviders(client: MeowClient, workspaceId?: string): Promise<void> {
  try {
    const providers = await client.providers(workspaceId);
    output.write("\n── Configured Providers ──────────────────\n");
    if (providers.length === 0) {
      output.write("No providers connected.\n\n");
      return;
    }
    for (const provider of providers) {
      const status = provider.healthStatus ?? provider.health?.status ?? "unknown";
      output.write(`${provider.displayName.padEnd(16)} ${provider.providerId.padEnd(12)} [${status}]\n`);
    }
    output.write("\n");
  } catch (err) {
    output.write(`Error fetching providers: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}

async function printModels(client: MeowClient, workspaceId?: string): Promise<void> {
  try {
    const payload = await client.models(workspaceId);
    const models = payload.data ?? [];
    output.write("\n── Synchronized Models ──────────────────\n");
    if (models.length === 0) {
      output.write("No models synchronized.\n\n");
      return;
    }
    for (const model of models) {
      output.write(`${model.id.padEnd(28)} ${model.providerId.padEnd(14)} ${model.displayName}\n`);
    }
    output.write("\n");
  } catch (err) {
    output.write(`Error fetching models: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}

async function printHistory(client: MeowClient, workspaceId?: string): Promise<void> {
  try {
    const chats = await client.conversations(workspaceId);
    output.write("\n── Active Conversations ─────────────────\n");
    if (chats.length === 0) {
      output.write("No conversations yet.\n\n");
      return;
    }
    for (const chat of chats) {
      output.write(`${chat.id.padEnd(28)} ${chat.title}\n`);
    }
    output.write("\n");
  } catch (err) {
    output.write(`Error fetching history: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}

async function streamPrompt(client: MeowClient, text: string, workspaceId?: string): Promise<void> {
  output.write("Assistant: ");
  try {
    if (!currentConversationId) {
      const chat = await client.createConversation(text.slice(0, 60) || "CLI Conversation", workspaceId);
      currentConversationId = chat.id;
    }

    const stream = client.chatCompletionsStream({
      conversationId: currentConversationId,
      workspaceId,
      messages: [{ role: "user", content: text }],
      model: currentModel,
      routing: { mode: currentRoutingMode, manualModelId: currentModel }
    });
    for await (const delta of stream) {
      output.write(delta);
    }
    output.write("\n\n");
  } catch (err) {
    output.write(
      `\nError: ${err instanceof Error ? err.message : "Unable to connect to Meow API server."}\n\n`
    );
  }
}
