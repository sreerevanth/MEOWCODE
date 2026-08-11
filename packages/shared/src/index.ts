export type ID = string;

export type WorkspaceRole = "owner" | "admin" | "developer" | "viewer";

export type WorkspaceKind = "personal" | "team";

export interface Workspace {
  id: ID;
  name: string;
  kind: WorkspaceKind;
  slug: string;
  createdAt: string;
}

export type ProviderCapability =
  | "chat"
  | "responses"
  | "embeddings"
  | "vision"
  | "images"
  | "audio"
  | "speech"
  | "reranking"
  | "video"
  | "tools"
  | "json"
  | "structured_outputs"
  | "reasoning"
  | "streaming";

export type ProviderId = string;

export interface ProviderConnectionConfig {
  providerId: ProviderId;
  apiKey?: string;
  endpoint?: string;
  organizationId?: string;
  projectId?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retryPolicy?: ProviderRetryPolicy;
  metadata?: Record<string, string>;
}

export interface ProviderRetryPolicy {
  maxRetries?: number;
  backoffMs?: number;
}

export type ProviderHealthStatus =
  | "healthy"
  | "slow"
  | "degraded"
  | "offline"
  | "auth_failed"
  | "rate_limited"
  | "invalid_endpoint"
  | "unknown_error"
  | "unknown";

export interface ProviderLatencyMetrics {
  connectionMs?: number;
  ttfbMs?: number;
  totalMs?: number;
  avgMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  lastRequestAt?: string;
}

export interface ProviderHealth {
  status: ProviderHealthStatus;
  latencyMs?: number;
  latency?: ProviderLatencyMetrics;
  checkedAt: string;
  message?: string;
  failureCount?: number;
  successCount?: number;
  availabilityPct?: number;
}

export interface ProviderCatalogEntry {
  providerId: ProviderId;
  displayName: string;
  description: string;
  logoUrl?: string;
  defaultEndpoint: string;
  capabilities: ProviderCapability[];
  supportsCustomEndpoint: boolean;
  local?: boolean;
  requiresApiKey?: boolean;
}

export interface ModelPricing {
  inputPerMillion?: number;
  outputPerMillion?: number;
  currency: "USD";
}

export interface ModelDescriptor {
  id: string;
  providerId: ProviderId;
  displayName: string;
  family?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  capabilities: ProviderCapability[];
  pricing?: ModelPricing;
  isFree?: boolean;
  isLocal?: boolean;
  qualityScore?: number;
  latencyP50Ms?: number;
  metadata?: Record<string, unknown>;
  discoveredAt: string;
}

export type RoutingMode =
  | "auto"
  | "cheapest"
  | "fastest"
  | "highest_quality"
  | "free_only"
  | "local_only"
  | "vision"
  | "reasoning"
  | "manual_provider"
  | "manual_model";

export interface RoutingRule {
  id: ID;
  workspaceId: ID;
  mode: RoutingMode;
  manualProviderId?: ProviderId;
  manualModelId?: string;
  requiredCapabilities?: ProviderCapability[];
  fallbackModelIds: string[];
  retryCount: number;
  timeoutMs: number;
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id: ID;
  role: ChatRole;
  content: string;
  createdAt: string;
  parentId?: ID;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: ID;
  workspaceId: ID;
  title: string;
  folderId?: ID;
  pinned: boolean;
  favorite: boolean;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  workspaceId: ID;
  providerId: ProviderId;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  createdAt: string;
}

export interface ProviderStatistics {
  providerId: ProviderId;
  connectionId?: string;
  requests: number;
  successRate: number;
  avgLatencyMs: number;
  costUsd: number;
  modelsCount: number;
  lastSeenAt?: string;
}

export function isProviderRoutable(status: ProviderHealthStatus): boolean {
  return status === "healthy" || status === "slow" || status === "degraded" || status === "unknown";
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
