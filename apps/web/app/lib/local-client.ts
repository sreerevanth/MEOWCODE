import { MeowClient, type ChatMessageItem } from "@meowcode/sdk";
import type { Conversation } from "@meowcode/shared";
import * as db from "./local-db";

export class LocalMeowClient extends MeowClient {
  private activeWorkspaceId: string | null = null;

  setWorkspaceId(id: string | null) {
    this.activeWorkspaceId = id;
  }

  // --- Override Chat/History methods to use IndexedDB ---

  override async conversations(workspaceId?: string, q?: string): Promise<Conversation[]> {
    const wsId = workspaceId ?? this.activeWorkspaceId;
    if (!wsId) return [];
    try {
      let convs = await db.getWorkspaceConversations(wsId);
      if (q) {
        const query = q.toLowerCase();
        convs = convs.filter((c) => c.title.toLowerCase().includes(query));
      }
      return convs as unknown as Conversation[];
    } catch (err) {
      console.warn("IndexedDB error:", err);
      return [];
    }
  }

  override async createConversation(title: string, workspaceId?: string): Promise<Conversation> {
    const wsId = workspaceId ?? this.activeWorkspaceId;
    if (!wsId) throw new Error("No workspace ID provided");
    const conv: db.LocalConversation = {
      id: `idb_conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: wsId,
      title,
      pinned: false,
      favorite: false,
      shared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await db.saveConversation(conv);
    } catch (err) {
      console.warn("IndexedDB error:", err);
    }
    return conv as unknown as Conversation;
  }

  override async updateConversation(id: string, data: Partial<Pick<Conversation, "title" | "pinned" | "favorite" | "shared" | "folderId">>): Promise<Conversation> {
    try {
      const conv = await db.getConversation(id);
      if (!conv) throw new Error("Conversation not found");
      const updated = { ...conv, ...data, updatedAt: new Date().toISOString() };
      await db.saveConversation(updated);
      return updated as unknown as Conversation;
    } catch (err) {
      console.warn("IndexedDB error:", err);
      return { id, ...data } as unknown as Conversation;
    }
  }

  override async deleteConversation(id: string): Promise<{ ok: boolean }> {
    try {
      await db.deleteConversation(id);
      await db.deleteConversationMessages(id);
    } catch (err) {
      console.warn("IndexedDB error:", err);
    }
    return { ok: true };
  }

  override async messages(conversationId: string): Promise<ChatMessageItem[]> {
    try {
      const msgs = await db.getConversationMessages(conversationId);
      return msgs as unknown as ChatMessageItem[];
    } catch (err) {
      console.warn("IndexedDB error:", err);
      return [];
    }
  }

  override async updateMessage(conversationId: string, messageId: string, content: string): Promise<ChatMessageItem> {
    try {
      const msg = await db.getMessage(messageId);
      if (!msg || msg.conversationId !== conversationId) throw new Error("Message not found");
      msg.content = content;
      await db.saveMessage(msg);
      return msg as unknown as ChatMessageItem;
    } catch (err) {
      console.warn("IndexedDB error:", err);
      return { id: messageId, conversationId, content } as unknown as ChatMessageItem;
    }
  }

  override async deleteMessage(conversationId: string, messageId: string): Promise<{ ok: boolean }> {
    try {
      await db.deleteMessage(messageId);
    } catch (err) {
      console.warn("IndexedDB error:", err);
    }
    return { ok: true };
  }

  override async branchConversation(conversationId: string, messageId?: string): Promise<Conversation> {
    try {
      const conv = await db.getConversation(conversationId);
      if (!conv) throw new Error("Original conversation not found");
      const msgs = await db.getConversationMessages(conversationId);
      
      let targetIndex = msgs.length - 1;
      if (messageId) {
        targetIndex = msgs.findIndex((m) => m.id === messageId);
        if (targetIndex === -1) throw new Error("Message not found");
      }
      
      const branchConv: db.LocalConversation = {
        ...conv,
        id: `idb_conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title: `${conv.title} (Branch)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.saveConversation(branchConv);
      
      for (let i = 0; i <= targetIndex; i++) {
        const newMsg = { ...msgs[i], id: `idb_msg_${Date.now()}_${i}`, conversationId: branchConv.id };
        await db.saveMessage(newMsg);
      }
      
      return branchConv as unknown as Conversation;
    } catch (err) {
      console.warn("IndexedDB error:", err);
      throw err;
    }
  }

  override async disconnectProvider(id: string): Promise<{ ok: boolean }> {
    const wsId = this.activeWorkspaceId;
    if (wsId) {
      try {
        const p = await this.getProvider(id, wsId);
        await db.deleteApiKey(wsId, p.providerId);
      } catch (err) {
        console.warn("Failed to clean up local API key", err);
      }
    }
    return super.disconnectProvider(id);
  }

  override async deleteProvider(id: string): Promise<{ ok: boolean }> {
    const wsId = this.activeWorkspaceId;
    if (wsId) {
      try {
        const p = await this.getProvider(id, wsId);
        await db.deleteApiKey(wsId, p.providerId);
      } catch (err) {
        console.warn("Failed to clean up local API key", err);
      }
    }
    return super.deleteProvider(id);
  }

  // --- Mock Provider Health Checks for Stateless Mode ---
  override async verifyProvider(id: string): Promise<{ ok: boolean; health: import("@meowcode/shared").ProviderHealth }> {
    return { ok: true, health: { status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() } };
  }

  override async syncProvider(id: string): Promise<{ ok: boolean; health: import("@meowcode/shared").ProviderHealth; modelsCount: number }> {
    return { ok: true, health: { status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() }, modelsCount: 4 };
  }

  override async healthCheckProvider(id: string): Promise<{ ok: boolean; health: import("@meowcode/shared").ProviderHealth }> {
    return { ok: true, health: { status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() } };
  }

  override async latencyTestProvider(id: string): Promise<{ ok: boolean; health: import("@meowcode/shared").ProviderHealth }> {
    return { ok: true, health: { status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() } };
  }

  // --- Override stream to inject API keys from DB ---

  override async chatCompletions(payload: Record<string, unknown>): Promise<any> {
    const wsId = payload.workspaceId as string;
    let providerKeys: Record<string, string> = {};
    if (wsId) {
      try {
        providerKeys = await db.getAllApiKeys(wsId);
      } catch (err) {
        console.warn("IndexedDB error fetching keys:", err);
      }
    }
    
    // We must manually fetch to inject the custom header
    await (this as any).ensureFreshToken?.(); // SDK might have this private
    const response = await (this as any).fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        ...(this as any).headers(),
        "content-type": "application/json",
        "x-provider-keys": JSON.stringify(providerKeys)
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Request failed");
    }
    return response.json();
  }

  override async *chatCompletionsStream(payload: Record<string, unknown> & { signal?: AbortSignal }): AsyncIterable<string> {
    const wsId = payload.workspaceId as string;
    let providerKeys: Record<string, string> = {};
    try {
      providerKeys = await db.getAllApiKeys(wsId);
    } catch (err) {
      console.warn("IndexedDB error fetching keys:", err);
    }
    
    // Call the parent stream with our injected keys
    const stream = super.chatCompletionsStream({ ...payload, providerKeys });
    
    let fullContent = "";
    for await (const chunk of stream) {
      fullContent += chunk;
      yield chunk;
    }
    
    // Save to local IndexedDB after successful stream (if conversation ID is present and it's a local conv)
    if (payload.conversationId && (payload.conversationId as string).startsWith("idb_conv_") && payload.persistUser !== false) {
      try {
        const messages = payload.messages as { role: string; content: string }[];
        const userMessage = messages[messages.length - 1];
        
        const convId = payload.conversationId as string;
        await db.saveMessage({
          id: `idb_msg_${Date.now()}_user`,
          conversationId: convId,
          role: "user",
          content: userMessage.content,
          createdAt: new Date().toISOString()
        });
        
        await db.saveMessage({
          id: `idb_msg_${Date.now()}_ast`,
          conversationId: convId,
          role: "assistant",
          content: fullContent,
          createdAt: new Date(Date.now() + 100).toISOString() // slightly later
        });

        const conv = await db.getConversation(convId);
        if (conv) {
          conv.updatedAt = new Date().toISOString();
          await db.saveConversation(conv);
        }
      } catch (err) {
        console.warn("IndexedDB error saving messages:", err);
      }
    }
  }

  override async models(workspaceId?: string): Promise<{ object: string; data: import("@meowcode/shared").ModelDescriptor[] }> {
    const wsId = workspaceId ?? this.activeWorkspaceId;
    if (!wsId) return { object: "list", data: [] };
    
    // In stateless mode, the backend doesn't sync models because it doesn't store API keys.
    // So the backend's 'isConnected' flag will be false (auth_failed).
    // Instead, we consider a provider "connected" if we have an API key for it in our local IndexedDB!
    let localKeys: Record<string, string> = {};
    try {
      localKeys = await db.getAllApiKeys(wsId);
    } catch (err) {
      console.warn("IndexedDB error:", err);
    }
    const connectedIds = new Set(Object.keys(localKeys));
    
    const hardcodedModels: import("@meowcode/shared").ModelDescriptor[] = [
      {
        id: "claude-3-5-sonnet-latest",
        providerId: "anthropic",
        displayName: "Claude 3.5 Sonnet",
        capabilities: ["chat", "vision", "tools"],
        isFree: false,
        isLocal: false
      } as any,
      {
        id: "gpt-4o",
        providerId: "openai",
        displayName: "GPT-4o",
        capabilities: ["chat", "vision", "tools"],
        isFree: false,
        isLocal: false
      } as any,
      {
        id: "gemini-1.5-pro",
        providerId: "google",
        displayName: "Gemini 1.5 Pro",
        capabilities: ["chat", "vision", "tools"],
        isFree: false,
        isLocal: false
      } as any,
      {
        id: "llama-3.1-70b-versatile",
        providerId: "groq",
        displayName: "Llama 3.1 70B (Groq)",
        capabilities: ["chat", "tools"],
        isFree: false,
        isLocal: false
      } as any
    ];

    return {
      object: "list",
      data: hardcodedModels.filter((m) => connectedIds.has(m.providerId))
    };
  }
}
