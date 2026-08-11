export interface ChatFolder {
  id: string;
  name: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  meta: string;
  pinned?: boolean;
  favorite?: boolean;
  shared?: boolean;
  folderId?: string;
}

export interface ProviderItem {
  id: string;
  displayName: string;
  status: string;
  modelsCount: number;
}

export interface ModelItem {
  id: string;
  displayName: string;
  providerId: string;
  capabilities: string[];
  isFree?: boolean;
  isLocal?: boolean;
}

export interface MessageMetadata {
  modelId?: string;
  providerId?: string;
  routeReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  streamed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: MessageMetadata;
}

export interface UsageMetrics {
  requests: number;
  latencyP50Ms: number;
  costUsd: number;
  models: number;
  inputTokens: number;
  outputTokens: number;
}

export interface WorkspacePreferences {
  showRouting?: boolean;
  chatFolders?: ChatFolder[];
}

export const ROUTING_MODES = [
  "auto",
  "cheapest",
  "fastest",
  "highest_quality",
  "free_only",
  "local_only",
  "vision",
  "reasoning"
] as const;

export type RoutingMode = (typeof ROUTING_MODES)[number];

export const MODEL_FILTERS = [null, "vision", "reasoning", "local", "free", "streaming", "tools", "json"] as const;
