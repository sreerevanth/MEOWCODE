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
    let convs = await db.getWorkspaceConversations(wsId);
    if (q) {
      const query = q.toLowerCase();
      convs = convs.filter((c) => c.title.toLowerCase().includes(query));
    }
    return convs as unknown as Conversation[];
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
    await db.saveConversation(conv);
    return conv as unknown as Conversation;
  }

  override async updateConversation(id: string, data: Partial<Pick<Conversation, "title" | "pinned" | "favorite" | "shared" | "folderId">>): Promise<Conversation> {
    const conv = await db.getConversation(id);
    if (!conv) throw new Error("Conversation not found");
    const updated = { ...conv, ...data, updatedAt: new Date().toISOString() };
    await db.saveConversation(updated);
    return updated as unknown as Conversation;
  }

  override async deleteConversation(id: string): Promise<{ ok: boolean }> {
    await db.deleteConversation(id);
    await db.deleteConversationMessages(id);
    return { ok: true };
  }

  override async messages(conversationId: string): Promise<ChatMessageItem[]> {
    const msgs = await db.getConversationMessages(conversationId);
    return msgs as unknown as ChatMessageItem[];
  }

  override async updateMessage(conversationId: string, messageId: string, content: string): Promise<ChatMessageItem> {
    const msg = await db.getMessage(messageId);
    if (!msg || msg.conversationId !== conversationId) throw new Error("Message not found");
    msg.content = content;
    await db.saveMessage(msg);
    return msg as unknown as ChatMessageItem;
  }

  override async deleteMessage(conversationId: string, messageId: string): Promise<{ ok: boolean }> {
    await db.deleteMessage(messageId);
    return { ok: true };
  }

  override async branchConversation(conversationId: string, messageId?: string): Promise<Conversation> {
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
  }

  // --- Override stream to inject API keys from DB ---

  override async *chatCompletionsStream(payload: Record<string, unknown> & { signal?: AbortSignal }): AsyncIterable<string> {
    const wsId = payload.workspaceId as string;
    const providerKeys = await db.getAllApiKeys(wsId);
    
    // Call the parent stream with our injected keys
    const stream = super.chatCompletionsStream({ ...payload, providerKeys });
    
    let fullContent = "";
    for await (const chunk of stream) {
      fullContent += chunk;
      yield chunk;
    }
    
    // Save to local IndexedDB after successful stream (if conversation ID is present and it's a local conv)
    if (payload.conversationId && (payload.conversationId as string).startsWith("idb_conv_") && payload.persistUser !== false) {
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
    }
  }

  override async models(workspaceId?: string): Promise<{ object: string; data: import("@meowcode/shared").ModelDescriptor[] }> {
    const wsId = workspaceId ?? this.activeWorkspaceId;
    if (!wsId) return { object: "list", data: [] };
    
    // In stateless mode, the backend doesn't sync models because it doesn't store API keys.
    // Return a static list of the most common models. They will work as long as the provider is connected and key is correct.
    const allProviders = await this.providers(wsId);
    const connectedIds = new Set(allProviders.filter((p) => p.isConnected).map((p) => p.providerId));
    
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
