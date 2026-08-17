"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  Boxes,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  Heart,
  Image,
  LayoutGrid,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Pin,
  Plug,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Users,
  X
} from "lucide-react";
import { Button } from "@meowcode/ui";
import { useAuth } from "../../lib/auth";
import { ProviderModal } from "../ProviderModal";
import { MarkdownContent } from "../MarkdownContent";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { KEYBOARD_SHORTCUTS, useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import type {
  ChatFolder,
  ChatMessage,
  ConversationItem,
  ModelItem,
  ProviderItem,
  UsageMetrics,
  WorkspacePreferences
} from "../../lib/chat-types";
import { ROUTING_MODES } from "../../lib/chat-types";
import { capitalize, estimateTokens, formatCount, formatUsd } from "../../lib/format";
import { getPublicApiUrl } from "../../lib/api-url";

export function ChatApp(): React.ReactElement {
  const { ready, user, client, workspaceId, logout } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [routingMode, setRoutingMode] = React.useState("auto");
  const [selectedModel, setSelectedModel] = React.useState("auto");
  const [providers, setProviders] = React.useState<ProviderItem[]>([]);
  const [models, setModels] = React.useState<ModelItem[]>([]);
  const [usage, setUsage] = React.useState<UsageMetrics | null>(null);
  const [showRoutingMenu, setShowRoutingMenu] = React.useState(false);
  const [showModelMenu, setShowModelMenu] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loadingChats, setLoadingChats] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = React.useState("Workspace");
  const [hasProviders, setHasProviders] = React.useState(false);
  const [showProviderModal, setShowProviderModal] = React.useState(false);
  const [showRouting, setShowRouting] = React.useState(false);
  const [modelSearch, setModelSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [renamingChatId, setRenamingChatId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [folders, setFolders] = React.useState<ChatFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = React.useState<string | null>(null);
  const [showFolderMenu, setShowFolderMenu] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const [shareNotice, setShareNotice] = React.useState<string | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  React.useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/auth");
  }, [ready, user, router]);

  const loadSidebar = React.useCallback(async () => {
    if (!workspaceId) return;
    setLoadingChats(true);
    setError(null);
    try {
      const [chats, provs, modelPayload, usagePayload, ws] = await Promise.all([
        client.conversations(workspaceId, debouncedSearch || undefined),
        client.providers(workspaceId),
        client.models(workspaceId),
        client.usage(workspaceId),
        client.getWorkspace(workspaceId) as Promise<{
          name?: string;
          settings?: {
            defaultRoutingMode?: string;
            defaultModelId?: string | null;
            preferences?: WorkspacePreferences;
          };
        }>
      ]);

      setWorkspaceName(ws.name ?? "Workspace");
      if (ws.settings?.defaultRoutingMode) setRoutingMode(ws.settings.defaultRoutingMode);
      if (ws.settings?.defaultModelId) setSelectedModel(ws.settings.defaultModelId);
      const prefs = ws.settings?.preferences;
      setShowRouting(Boolean(prefs?.showRouting));
      setFolders(prefs?.chatFolders ?? []);

      const connected = provs.filter((p) => p.isConnected);
      setHasProviders(connected.length > 0);

      setConversations(
        chats.map((c) => ({
          id: c.id,
          title: c.title,
          meta: ws.name ?? "Workspace",
          pinned: c.pinned,
          favorite: c.favorite,
          shared: c.shared,
          folderId: c.folderId
        }))
      );
      setProviders(
        connected.map((p) => ({
          id: p.id ?? p.providerId,
          displayName: p.displayName,
          status: capitalize(p.healthStatus ?? "unknown"),
          modelsCount: p.modelsCount ?? 0
        }))
      );
      setModels(
        (modelPayload.data ?? []).map((m) => ({
          id: m.id,
          displayName: m.displayName || m.id,
          providerId: m.providerId,
          capabilities: m.capabilities ?? [],
          isFree: m.isFree,
          isLocal: m.isLocal
        }))
      );
      setUsage({
        requests: usagePayload.requests,
        latencyP50Ms: usagePayload.latencyP50Ms,
        costUsd: usagePayload.costUsd,
        models: usagePayload.models,
        inputTokens: usagePayload.inputTokens,
        outputTokens: usagePayload.outputTokens
      });

      if (!activeChatId && chats[0]) setActiveChatId(chats[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace data");
    } finally {
      setLoadingChats(false);
    }
  }, [client, workspaceId, debouncedSearch, activeChatId]);

  React.useEffect(() => {
    if (!ready || !user || !workspaceId) return;
    void loadSidebar();
  }, [ready, user, workspaceId, loadSidebar]);

  React.useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const msgs = await client.messages(activeChatId!);
        if (!cancelled) {
          setMessages(
            msgs
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                metadata: (m.metadata as ChatMessage["metadata"]) ?? undefined
              }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeChatId, client]);

  const refreshUsage = React.useCallback(async () => {
    if (!workspaceId) return;
    const usagePayload = await client.usage(workspaceId);
    setUsage({
      requests: usagePayload.requests,
      latencyP50Ms: usagePayload.latencyP50Ms,
      costUsd: usagePayload.costUsd,
      models: usagePayload.models,
      inputTokens: usagePayload.inputTokens,
      outputTokens: usagePayload.outputTokens
    });
  }, [client, workspaceId]);

  const streamAssistant = React.useCallback(
    async (params: {
      chatId: string;
      history: ChatMessage[];
      assistantMsgId: string;
      persistUser?: boolean;
    }) => {
      abortRef.current = new AbortController();
      setIsStreaming(true);
      setError(null);

      try {
        const stream = client.chatCompletionsStream({
          conversationId: params.chatId,
          workspaceId: workspaceId!,
          messages: params.history.map((m) => ({ role: m.role, content: m.content })),
          persistUser: params.persistUser ?? true,
          model: selectedModel !== "auto" ? selectedModel : undefined,
          routing: {
            mode: selectedModel !== "auto" ? "manual_model" : routingMode,
            manualModelId: selectedModel !== "auto" ? selectedModel : undefined
          },
          stream: true,
          signal: abortRef.current.signal
        });

        let full = "";
        for await (const delta of stream) {
          full += delta;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === params.assistantMsgId ? { ...msg, content: msg.content + delta } : msg))
          );
        }

        if (!full) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === params.assistantMsgId
                ? { ...msg, content: msg.content || "No response received from provider." }
                : msg
            )
          );
        }

        const refreshed = await client.conversations(workspaceId!);
        setConversations(
          refreshed.map((c) => ({
            id: c.id,
            title: c.title,
            meta: workspaceName,
            pinned: c.pinned,
            favorite: c.favorite,
            shared: c.shared,
            folderId: c.folderId
          }))
        );
        await refreshUsage();

        const serverMsgs = await client.messages(params.chatId);
        const assistant = [...serverMsgs].reverse().find((m) => m.role === "assistant");
        if (assistant) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === params.assistantMsgId
                ? {
                    id: assistant.id,
                    role: "assistant",
                    content: assistant.content,
                    metadata: (assistant.metadata as ChatMessage["metadata"]) ?? undefined
                  }
                : msg
            )
          );
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Generation failed");
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
          return prev;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [client, workspaceId, selectedModel, routingMode, workspaceName, refreshUsage]
  );

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || isStreaming || !workspaceId) return;
    if (!hasProviders) {
      setShowProviderModal(true);
      return;
    }

    let chatId = activeChatId;
    const userText = inputPrompt.trim();
    setInputPrompt("");
    setError(null);

    try {
      if (!chatId) {
        const created = await client.createConversation("New Conversation", workspaceId);
        chatId = created.id;
        setActiveChatId(chatId);
        setConversations((prev) => [
          { id: created.id, title: created.title, meta: workspaceName },
          ...prev
        ]);
      }

      const userMsgId = `local_usr_${Date.now()}`;
      const assistantMsgId = `local_ast_${Date.now()}`;
      const nextHistory = [...messages, { id: userMsgId, role: "user" as const, content: userText }];
      setMessages([...nextHistory, { id: assistantMsgId, role: "assistant", content: "" }]);

      await streamAssistant({ chatId: chatId as string, history: nextHistory, assistantMsgId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleRegenerate = async (assistantIndex: number) => {
    if (!workspaceId || !activeChatId || isStreaming) return;
    const prior = messages.slice(0, assistantIndex);
    const assistantMsgId = `local_regen_${Date.now()}`;
    setMessages([...prior, { id: assistantMsgId, role: "assistant", content: "" }]);
    await streamAssistant({ chatId: activeChatId, history: prior, assistantMsgId, persistUser: false });
  };

  const handleEditSave = async (messageId: string, index: number) => {
    if (!activeChatId || !editDraft.trim() || isStreaming) return;
    setError(null);
    try {
      if (!messageId.startsWith("local_")) {
        await client.updateMessage(activeChatId, messageId, editDraft.trim());
      }
      const updated = messages.slice(0, index + 1).map((m, i) =>
        i === index ? { ...m, content: editDraft.trim() } : m
      );
      for (const m of messages.slice(index + 1)) {
        if (!m.id.startsWith("local_")) {
          await client.deleteMessage(activeChatId, m.id);
        }
      }
      setEditingMessageId(null);
      setEditDraft("");
      const assistantMsgId = `local_edit_${Date.now()}`;
      setMessages([...updated, { id: assistantMsgId, role: "assistant", content: "" }]);
      await streamAssistant({ chatId: activeChatId, history: updated, assistantMsgId, persistUser: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit message");
    }
  };

  const handleNewChat = async () => {
    if (!workspaceId) return;
    try {
      const created = await client.createConversation("New Conversation", workspaceId);
      setConversations((prev) => [{ id: created.id, title: created.title, meta: workspaceName }, ...prev]);
      setActiveChatId(created.id);
      setMessages([]);
      setMobileSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat");
    }
  };

  const handleDeleteChat = async (id: string) => {
    await client.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const handleRenameChat = async (id: string) => {
    if (!renameDraft.trim()) return;
    await client.updateConversation(id, { title: renameDraft.trim() });
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: renameDraft.trim() } : c)));
    setRenamingChatId(null);
  };

  const persistRouting = async (mode: string) => {
    setRoutingMode(mode);
    setShowRoutingMenu(false);
    if (!workspaceId) return;
    try {
      await client.updateWorkspace(workspaceId, { settings: { defaultRoutingMode: mode } });
    } catch {
      // non-blocking
    }
  };

  const persistModel = async (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelMenu(false);
    if (!workspaceId) return;
    try {
      await client.updateWorkspace(workspaceId, {
        settings: { defaultModelId: modelId === "auto" ? null : modelId }
      });
    } catch {
      // non-blocking
    }
  };

  const persistFolders = async (nextFolders: ChatFolder[]) => {
    setFolders(nextFolders);
    if (!workspaceId) return;
    await client.updateWorkspace(workspaceId, {
      settings: { preferences: { chatFolders: nextFolders } }
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder: ChatFolder = { id: `fld_${Date.now()}`, name: newFolderName.trim() };
    await persistFolders([...folders, folder]);
    setNewFolderName("");
    setShowFolderMenu(false);
  };

  const moveChatToFolder = async (chatId: string, folderId: string | null) => {
    await client.updateConversation(chatId, { folderId: folderId ?? undefined });
    setConversations((prev) => prev.map((c) => (c.id === chatId ? { ...c, folderId: folderId ?? undefined } : c)));
  };

  const handleUpload = async (file: File | null) => {
    if (!file || !workspaceId) return;
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const access = window.localStorage.getItem("meow_access_token");
      const apiUrl = process.env.NEXT_PUBLIC_MEOW_API_URL ?? "http://localhost:4000";
      const response = await fetch(`${apiUrl}/v1/uploads?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: "POST",
        headers: access ? { authorization: `Bearer ${access}` } : {},
        body: form
      });
      if (!response.ok) throw new Error(await response.text());
      const uploaded = (await response.json()) as { filename: string; id: string };
      setInputPrompt((prev) => `${prev}${prev ? "\n" : ""}[Attached: ${uploaded.filename} (#${uploaded.id})]`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const exportConversation = async () => {
    const text = messages.map((m) => `## ${m.role}\n\n${m.content}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTitle.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareConversation = async () => {
    if (!activeChatId) return;
    try {
      await client.updateConversation(activeChatId, { shared: true });
      const url = `${window.location.origin}/?chat=${activeChatId}`;
      await navigator.clipboard.writeText(url);
      setShareNotice("Share link copied to clipboard");
      setConversations((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, shared: true, meta: `${workspaceName} • shared` } : c))
      );
      window.setTimeout(() => setShareNotice(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share conversation");
    }
  };

  const togglePin = async (chatId: string, pinned: boolean) => {
    await client.updateConversation(chatId, { pinned: !pinned });
    setConversations((prev) => prev.map((c) => (c.id === chatId ? { ...c, pinned: !pinned } : c)));
  };

  const toggleFavorite = async (chatId: string, favorite: boolean) => {
    await client.updateConversation(chatId, { favorite: !favorite });
    setConversations((prev) => prev.map((c) => (c.id === chatId ? { ...c, favorite: !favorite } : c)));
  };

  const closeMenus = () => {
    setShowRoutingMenu(false);
    setShowModelMenu(false);
    setShowFolderMenu(false);
    setMobileSidebarOpen(false);
  };

  useKeyboardShortcuts([
    { key: "n", meta: true, handler: () => void handleNewChat() },
    { key: "n", ctrl: true, handler: () => void handleNewChat() },
    { key: "k", meta: true, handler: () => searchInputRef.current?.focus(), allowInInput: true },
    { key: "k", ctrl: true, handler: () => searchInputRef.current?.focus(), allowInInput: true },
    { key: ",", meta: true, handler: () => router.push("/settings") },
    { key: ",", ctrl: true, handler: () => router.push("/settings") },
    {
      key: "c",
      meta: true,
      shift: true,
      handler: () => void exportConversation(),
      enabled: messages.length > 0
    },
    {
      key: "c",
      ctrl: true,
      shift: true,
      handler: () => void exportConversation(),
      enabled: messages.length > 0
    },
    { key: "Escape", handler: closeMenus, allowInInput: true }
  ]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chat = params.get("chat");
    if (chat) setActiveChatId(chat);
  }, []);

  const filteredModels = models.filter((m) => {
    if (
      modelSearch &&
      !m.displayName.toLowerCase().includes(modelSearch.toLowerCase()) &&
      !m.id.toLowerCase().includes(modelSearch.toLowerCase())
    ) {
      return false;
    }
    if (modelFilter === "free" && !m.isFree) return false;
    if (modelFilter === "local" && !m.isLocal) return false;
    if (modelFilter && modelFilter !== "free" && modelFilter !== "local" && !m.capabilities.includes(modelFilter)) {
      return false;
    }
    return true;
  });

  const visibleConversations = conversations.filter((c) => {
    if (activeFolderId === "__favorites") return c.favorite;
    if (activeFolderId === "__pinned") return c.pinned;
    if (activeFolderId) return c.folderId === activeFolderId;
    return true;
  });

  if (!ready || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 dark:bg-[#101014]">
        <Loader2 className="animate-spin text-cyan-500" />
      </main>
    );
  }

  const activeTitle = conversations.find((c) => c.id === activeChatId)?.title ?? "New chat";
  const activeConversation = conversations.find((c) => c.id === activeChatId);

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-cyan-500 font-bold text-zinc-950">
            <Bot size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold">Meow Code</div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{workspaceName}</div>
          </div>
        </div>
        <Button variant="ghost" className="size-9 px-0 lg:hidden" aria-label="Close sidebar" onClick={() => setMobileSidebarOpen(false)}>
          <X size={17} />
        </Button>
        <Button variant="ghost" className="hidden size-9 px-0 lg:inline-flex" aria-label="Settings" onClick={() => router.push("/settings")}>
          <Settings size={17} />
        </Button>
      </div>

      <div className="px-3">
        <Button className="w-full gap-2" onClick={() => void handleNewChat()}>
          <MessageSquarePlus size={16} /> New chat
        </Button>
        <div className="mt-3 flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <Search size={16} />
          <input
            ref={searchInputRef}
            className="w-full bg-transparent outline-none placeholder:text-zinc-500"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 px-3">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveFolderId(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] ${activeFolderId === null ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFolderId("__pinned")}
            className={`rounded-full px-2.5 py-1 text-[11px] ${activeFolderId === "__pinned" ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            Pinned
          </button>
          <button
            onClick={() => setActiveFolderId("__favorites")}
            className={`rounded-full px-2.5 py-1 text-[11px] ${activeFolderId === "__favorites" ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            Favorites
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${activeFolderId === folder.id ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" : "bg-zinc-100 dark:bg-zinc-800"}`}
            >
              {folder.name}
            </button>
          ))}
          <button
            onClick={() => setShowFolderMenu((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] dark:bg-zinc-800"
          >
            <FolderPlus size={12} /> Folder
          </button>
        </div>
        {showFolderMenu ? (
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateFolder();
            }}
          >
            <input
              className="h-8 flex-1 rounded-md border border-zinc-200 bg-stone-50 px-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="h-8 px-2 text-xs">
              Add
            </Button>
          </form>
        ) : null}
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-2">
        {loadingChats && visibleConversations.length === 0 ? (
          <div className="px-3 py-6 text-sm text-zinc-500">Loading conversations...</div>
        ) : null}
        {!loadingChats && visibleConversations.length === 0 ? (
          <div className="px-3 py-6 text-sm text-zinc-500">No conversations in this view.</div>
        ) : null}
        {visibleConversations.map((conversation) => (
          <div key={conversation.id} className="group relative">
            {renamingChatId === conversation.id ? (
              <form
                className="flex gap-1 px-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleRenameChat(conversation.id);
                }}
              >
                <input
                  className="h-8 flex-1 rounded-md border border-zinc-200 bg-stone-50 px-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  autoFocus
                />
              </form>
            ) : (
              <button
                onClick={() => {
                  setActiveChatId(conversation.id);
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition ${
                  activeChatId === conversation.id
                    ? "bg-cyan-500/12 font-medium text-cyan-800 dark:text-cyan-200"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
              >
                <FileText size={16} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{conversation.title}</span>
                  <span className="block truncate text-xs text-zinc-500">{conversation.meta}</span>
                </span>
                {conversation.pinned ? <Pin size={14} className="mt-0.5 shrink-0" /> : null}
                {conversation.favorite ? <Heart size={14} className="mt-0.5 shrink-0 fill-current text-rose-500" /> : null}
              </button>
            )}
            <div className="absolute right-2 top-2 hidden gap-0.5 group-hover:flex">
              {folders.length > 0 ? (
                <select
                  className="h-6 max-w-[72px] rounded border border-zinc-200 bg-white text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
                  value={conversation.folderId ?? ""}
                  onChange={(e) => void moveChatToFolder(conversation.id, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button
                variant="ghost"
                className="size-6 px-0"
                onClick={() => {
                  setRenamingChatId(conversation.id);
                  setRenameDraft(conversation.title);
                }}
              >
                <Pencil size={12} />
              </Button>
              <Button variant="ghost" className="size-6 px-0" onClick={() => void handleDeleteChat(conversation.id)}>
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Users size={14} />
          <span className="truncate">{user.name ?? user.email}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          <Button
            variant="ghost"
            className="size-10 px-0"
            title="Pin active chat"
            onClick={() => activeChatId && void togglePin(activeChatId, activeConversation?.pinned ?? false)}
          >
            <Pin size={17} />
          </Button>
          <Button
            variant="ghost"
            className="size-10 px-0"
            title="Favorite active chat"
            onClick={() => activeChatId && void toggleFavorite(activeChatId, activeConversation?.favorite ?? false)}
          >
            <Heart size={17} />
          </Button>
          <Button variant="ghost" className="size-10 px-0" onClick={() => router.push("/settings")}>
            <Settings size={17} />
          </Button>
          <Button variant="ghost" className="size-10 px-0" title="Export conversation" onClick={() => void exportConversation()}>
            <Download size={17} />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <main className="flex min-h-screen bg-stone-50 text-zinc-950 dark:bg-[#101014] dark:text-zinc-50">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 lg:flex">
        {sidebar}
      </aside>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/50" aria-label="Close sidebar overlay" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-stone-50/85 px-4 backdrop-blur dark:border-zinc-800 dark:bg-[#101014]/85">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" className="size-9 px-0 lg:hidden" aria-label="Open navigation" onClick={() => setMobileSidebarOpen(true)}>
              <LayoutGrid size={18} />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{activeTitle}</div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <GitBranch size={13} /> {workspaceName}
              </div>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            {showRouting ? (
              <div className="relative">
                <Button variant="secondary" className="gap-2 text-xs capitalize sm:text-sm" onClick={() => setShowRoutingMenu(!showRoutingMenu)}>
                  Router: {routingMode.replace(/_/g, " ")} <ChevronDown size={15} />
                </Button>
                {showRoutingMenu ? (
                  <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                    {ROUTING_MODES.map((mode) => (
                      <button key={mode} onClick={() => void persistRouting(mode)} className="block w-full px-4 py-2 text-left text-xs capitalize hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        {mode.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative">
              <Button variant="secondary" className="hidden gap-2 text-xs md:inline-flex sm:text-sm" onClick={() => setShowModelMenu(!showModelMenu)}>
                {selectedModel === "auto" ? "Model: Auto" : selectedModel} <ChevronDown size={15} />
              </Button>
              {showModelMenu ? (
                <div className="absolute right-0 top-10 z-50 max-h-80 w-72 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
                    <input
                      className="h-8 w-full rounded-md border border-zinc-200 bg-stone-50 px-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                      placeholder="Search models..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                    />
                  </div>
                  <button onClick={() => void persistModel("auto")} className="block w-full px-4 py-2 text-left text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    Auto (router selected)
                  </button>
                  {filteredModels.map((m) => (
                    <button key={`${m.providerId}:${m.id}`} onClick={() => void persistModel(m.id)} className="block w-full px-4 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <span className="font-medium">{m.displayName}</span>
                      <span className="ml-1 text-zinc-500">({m.providerId})</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <Button variant="ghost" className="size-9 px-0" aria-label="Share" onClick={() => void shareConversation()}>
              <ShieldCheck size={18} />
            </Button>
          </div>
        </header>

        {error ? (
          <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={14} />
            </button>
          </div>
        ) : null}
        {shareNotice ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {shareNotice}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
              <div className="mx-auto max-w-3xl space-y-6">
                {loadingMessages ? <div className="text-sm text-zinc-500">Loading messages...</div> : null}
                {!loadingMessages && messages.length === 0 && !hasProviders ? (
                  <div className="rounded-md border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                    <p className="text-sm font-medium">No AI providers connected yet.</p>
                    <p className="mt-2 text-sm text-zinc-500">Connect your first provider to begin chatting.</p>
                    <Button className="mt-4 gap-2" onClick={() => setShowProviderModal(true)}>
                      <Plug size={16} /> Connect provider
                    </Button>
                  </div>
                ) : null}
                {!loadingMessages && messages.length === 0 && hasProviders ? (
                  <div className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
                    Start a conversation. Your messages are saved to this workspace.
                  </div>
                ) : null}

                {messages.map((msg, index) => (
                  <article key={msg.id} className="flex gap-4">
                    <div
                      className={`grid size-8 shrink-0 place-items-center rounded-md ${
                        msg.role === "user" ? "bg-zinc-200 dark:bg-zinc-800" : "bg-cyan-500 font-bold text-zinc-950"
                      }`}
                    >
                      {msg.role === "user" ? <Users size={16} /> : <Bot size={16} />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="min-h-24 w-full rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button className="h-8 text-xs" onClick={() => void handleEditSave(msg.id, index)}>
                              Save & regenerate
                            </Button>
                            <Button variant="ghost" className="h-8 text-xs" onClick={() => setEditingMessageId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 prose prose-sm dark:prose-invert max-w-none">
                          {msg.content ? (
                            msg.role === "assistant" ? (
                              <MarkdownContent content={msg.content} />
                            ) : (
                              <div className="whitespace-pre-wrap">{msg.content}</div>
                            )
                          ) : isStreaming ? (
                            <span className="animate-pulse">Thinking...</span>
                          ) : (
                            ""
                          )}
                        </div>
                      )}

                      {msg.role === "assistant" && !isStreaming && editingMessageId !== msg.id ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <Button variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void handleRegenerate(index)}>
                            <RefreshCw size={12} /> Regenerate
                          </Button>
                          <Button variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void navigator.clipboard.writeText(msg.content)}>
                            <Copy size={12} /> Copy
                          </Button>
                          {msg.metadata?.providerId ? (
                            <span className="inline-flex h-7 items-center rounded-md bg-zinc-100 px-2 text-[10px] dark:bg-zinc-800">
                              {msg.metadata.providerId} / {msg.metadata.modelId}
                            </span>
                          ) : null}
                          <span className="inline-flex h-7 items-center rounded-md bg-zinc-100 px-2 text-[10px] text-zinc-500 dark:bg-zinc-800">
                            ~{estimateTokens(msg.content)} tokens
                          </span>
                        </div>
                      ) : null}

                      {msg.role === "user" && !isStreaming && editingMessageId !== msg.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditDraft(msg.content);
                            }}
                          >
                            <Pencil size={12} /> Edit
                          </Button>
                          {activeChatId ? (
                            <Button
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={async () => {
                                const branch = await client.branchConversation(activeChatId, msg.id);
                                setActiveChatId(branch.id);
                                setConversations((prev) => [{ id: branch.id, title: branch.title, meta: workspaceName }, ...prev]);
                              }}
                            >
                              <GitBranch size={12} /> Branch
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div
              className={`border-t border-zinc-200 bg-stone-50/90 p-4 dark:border-zinc-800 dark:bg-[#101014]/90 ${dragOver ? "ring-2 ring-inset ring-cyan-500" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleUpload(e.dataTransfer.files[0] ?? null);
              }}
            >
              <div className="mx-auto max-w-3xl rounded-md border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <textarea
                  ref={textareaRef}
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  className="min-h-24 w-full resize-none rounded-md bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400"
                  placeholder="Message Meow Code..."
                  disabled={isStreaming}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
                  <div className="flex items-center gap-1">
                    <label className="inline-flex">
                      <input type="file" className="hidden" accept="image/*,application/pdf,text/*,.md,.json,.csv" onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)} />
                      <Button type="button" variant="ghost" className="size-8 px-0" aria-label="Attach file" onClick={(e) => (e.currentTarget.parentElement as HTMLElement).querySelector("input")?.dispatchEvent(new MouseEvent("click"))}>
                        <Paperclip size={16} />
                      </Button>
                    </label>
                    <label className="inline-flex">
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)} />
                      <Button type="button" variant="ghost" className="size-8 px-0" aria-label="Attach image" onClick={(e) => (e.currentTarget.parentElement as HTMLElement).querySelector("input")?.dispatchEvent(new MouseEvent("click"))}>
                        <Image size={16} />
                      </Button>
                    </label>
                  </div>
                  {isStreaming ? (
                    <Button variant="secondary" className="gap-2" onClick={stopGeneration}>
                      <Square size={14} /> Stop
                    </Button>
                  ) : (
                    <Button className="gap-2" onClick={() => void handleSendMessage()} disabled={!inputPrompt.trim()}>
                      Send <Send size={15} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden min-h-0 border-l border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60 xl:block">
            <div className="space-y-5">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Providers</h2>
                  <Link href="/providers" className="text-xs text-cyan-600 hover:underline dark:text-cyan-400">
                    Manage
                  </Link>
                </div>
                <div className="space-y-2">
                  {providers.length === 0 ? (
                    <button onClick={() => setShowProviderModal(true)} className="w-full rounded-md border border-dashed border-zinc-300 p-3 text-left text-xs text-zinc-500 dark:border-zinc-700">
                      Connect a provider to start
                    </button>
                  ) : (
                    providers.map((provider) => (
                      <div key={provider.id} className="flex items-center justify-between rounded-md border border-zinc-200 bg-stone-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                        <div>
                          <div className="text-sm font-medium">{provider.displayName}</div>
                          <div className="text-xs text-zinc-500">{provider.modelsCount} models</div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">{provider.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold">Usage</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Requests", value: formatCount(usage?.requests ?? 0), icon: Activity },
                    { label: "Latency p50", value: `${usage?.latencyP50Ms ?? 0}ms`, icon: Clock3 },
                    { label: "Cost", value: formatUsd(usage?.costUsd ?? 0), icon: Sparkles },
                    { label: "Models", value: String(usage?.models ?? models.length), icon: Boxes }
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-md border border-zinc-200 bg-stone-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <metric.icon size={16} className="text-cyan-500" />
                      <div className="mt-3 text-lg font-semibold">{metric.value}</div>
                      <div className="text-xs text-zinc-500">{metric.label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {formatCount(usage?.inputTokens ?? 0)} input / {formatCount(usage?.outputTokens ?? 0)} output tokens
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-semibold">Shortcuts</h2>
                <ul className="space-y-1 text-xs text-zinc-500">
                  {KEYBOARD_SHORTCUTS.slice(0, 4).map((s) => (
                    <li key={s.keys} className="flex justify-between gap-2">
                      <span>{s.description}</span>
                      <span className="font-mono text-[10px]">{s.keys}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </div>
      </section>

      {workspaceId ? (
        <ProviderModal
          open={showProviderModal}
          onClose={() => setShowProviderModal(false)}
          client={client}
          workspaceId={workspaceId}
          onConnected={() => void loadSidebar()}
        />
      ) : null}
    </main>
  );
}
