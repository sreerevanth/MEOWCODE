export const DB_NAME = "MeowCodeDB";
export const DB_VERSION = 1;

export interface LocalConversation {
  id: string;
  workspaceId: string;
  title: string;
  folderId?: string;
  pinned: boolean;
  favorite: boolean;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalMessage {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
  metadata?: any;
}

export interface LocalApiKey {
  id: string; // workspaceId_providerId
  workspaceId: string;
  providerId: string;
  apiKey: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("conversations")) {
        const store = db.createObjectStore("conversations", { keyPath: "id" });
        store.createIndex("workspaceId", "workspaceId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("messages")) {
        const store = db.createObjectStore("messages", { keyPath: "id" });
        store.createIndex("conversationId", "conversationId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("apiKeys")) {
        db.createObjectStore("apiKeys", { keyPath: "id" });
      }
    };
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

// Conversations
export const saveConversation = (conv: LocalConversation) => tx("conversations", "readwrite", (s) => s.put(conv));
export const getConversation = (id: string) => tx<LocalConversation>("conversations", "readonly", (s) => s.get(id));
export const deleteConversation = (id: string) => tx("conversations", "readwrite", (s) => s.delete(id));

export const getWorkspaceConversations = async (workspaceId: string): Promise<LocalConversation[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("conversations", "readonly");
    const store = transaction.objectStore("conversations");
    const index = store.index("workspaceId");
    const request = index.getAll(IDBKeyRange.only(workspaceId));
    request.onsuccess = () => {
      const results = request.result as LocalConversation[];
      results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

// Messages
export const saveMessage = (msg: LocalMessage) => tx("messages", "readwrite", (s) => s.put(msg));
export const getMessage = (id: string) => tx<LocalMessage>("messages", "readonly", (s) => s.get(id));
export const deleteMessage = (id: string) => tx("messages", "readwrite", (s) => s.delete(id));

export const getConversationMessages = async (conversationId: string): Promise<LocalMessage[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("messages", "readonly");
    const store = transaction.objectStore("messages");
    const index = store.index("conversationId");
    const request = index.getAll(IDBKeyRange.only(conversationId));
    request.onsuccess = () => {
      const results = request.result as LocalMessage[];
      results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteConversationMessages = async (conversationId: string) => {
  const msgs = await getConversationMessages(conversationId);
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("messages", "readwrite");
    const store = transaction.objectStore("messages");
    msgs.forEach((m) => store.delete(m.id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// API Keys
export const saveApiKey = (workspaceId: string, providerId: string, apiKey: string) =>
  tx("apiKeys", "readwrite", (s) => s.put({ id: `${workspaceId}_${providerId}`, workspaceId, providerId, apiKey }));

export const getApiKey = (workspaceId: string, providerId: string) =>
  tx<LocalApiKey>("apiKeys", "readonly", (s) => s.get(`${workspaceId}_${providerId}`));

export const getAllApiKeys = async (workspaceId: string): Promise<Record<string, string>> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("apiKeys", "readonly");
    const store = transaction.objectStore("apiKeys");
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as LocalApiKey[];
      const map: Record<string, string> = {};
      results.filter((r) => r.workspaceId === workspaceId).forEach((r) => (map[r.providerId] = r.apiKey));
      resolve(map);
    };
    request.onerror = () => reject(request.error);
  });
};
