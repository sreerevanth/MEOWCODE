import type { ModelDescriptor, ProviderCapability, ProviderHealth, RoutingMode, RoutingRule } from "@meowcode/shared";
import { isProviderRoutable } from "@meowcode/shared";

export interface RouteRequest {
  mode: RoutingMode;
  models: ModelDescriptor[];
  healthByProvider: Map<string, ProviderHealth>;
  requiredCapabilities?: ProviderCapability[];
  manualProviderId?: string;
  manualModelId?: string;
  connectedProviderIds?: Set<string>;
}

export interface RoutePlan {
  primary: ModelDescriptor;
  fallbacks: ModelDescriptor[];
  reason: string;
}

export class ModelRouter {
  route(request: RouteRequest): RoutePlan {
    const candidates = this.filterCandidates(request);
    if (candidates.length === 0) {
      throw new Error("No model candidates match the routing request");
    }

    const ranked = [...candidates].sort((a, b) => this.score(b, request) - this.score(a, request));
    return {
      primary: ranked[0],
      fallbacks: ranked.slice(1, 4),
      reason: `Selected ${ranked[0].id} using ${request.mode} routing`
    };
  }

  fromRule(rule: RoutingRule, models: ModelDescriptor[], healthByProvider: Map<string, ProviderHealth>): RoutePlan {
    const plan = this.route({
      mode: rule.mode,
      models,
      healthByProvider,
      requiredCapabilities: rule.requiredCapabilities,
      manualProviderId: rule.manualProviderId,
      manualModelId: rule.manualModelId
    });
    const explicitFallbacks = rule.fallbackModelIds
      .map((id) => models.find((model) => model.id === id))
      .filter((model): model is ModelDescriptor => Boolean(model));
    return { ...plan, fallbacks: explicitFallbacks.length > 0 ? explicitFallbacks : plan.fallbacks };
  }

  async executeWithFallback<T>(
    plan: RoutePlan,
    executor: (model: ModelDescriptor) => Promise<T>
  ): Promise<{ result: T; usedModel: ModelDescriptor }> {
    const chain = [plan.primary, ...plan.fallbacks];
    let lastError: unknown;
    for (const model of chain) {
      try {
        const result = await executor(model);
        return { result, usedModel: model };
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(
      `All models in route plan failed. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private filterCandidates(request: RouteRequest): ModelDescriptor[] {
    return request.models.filter((model) => {
      if (request.connectedProviderIds && !request.connectedProviderIds.has(model.providerId)) {
        return false;
      }

      const health = request.healthByProvider.get(model.providerId);
      const healthyEnough = !health || isProviderRoutable(health.status);
      const capabilityMatch = (request.requiredCapabilities ?? []).every((capability) =>
        model.capabilities.includes(capability)
      );
      if (!healthyEnough || !capabilityMatch) return false;
      if (request.mode === "free_only" && !model.isFree) return false;
      if (request.mode === "local_only" && !model.isLocal) return false;
      if (request.mode === "vision" && !model.capabilities.includes("vision")) return false;
      if (request.mode === "reasoning" && !model.capabilities.includes("reasoning")) return false;
      if (request.mode === "manual_provider" && model.providerId !== request.manualProviderId) return false;
      if (request.mode === "manual_model" && model.id !== request.manualModelId) return false;
      return true;
    });
  }

  private score(model: ModelDescriptor, request: RouteRequest): number {
    const health = request.healthByProvider.get(model.providerId);
    const healthScore = this.healthScore(health?.status);
    const quality = model.qualityScore ?? 50;
    const providerLatency = health?.latency?.p50Ms ?? health?.latencyMs;
    const modelLatency = model.latencyP50Ms;
    const latencyMs = providerLatency ?? modelLatency ?? 500;
    const latency = Math.max(0, 40 - latencyMs / 100);
    const cost = model.pricing?.inputPerMillion ? Math.max(0, 30 - model.pricing.inputPerMillion) : model.isFree ? 35 : 15;

    switch (request.mode) {
      case "cheapest":
      case "free_only":
        return cost * 3 + healthScore + latency;
      case "fastest":
        return latency * 3 + healthScore + quality / 4;
      case "highest_quality":
      case "reasoning":
        return quality * 2 + healthScore + latency / 2;
      case "local_only":
        return (model.isLocal ? 100 : -100) + latency + healthScore;
      case "vision":
        return (model.capabilities.includes("vision") ? 80 : -100) + quality + healthScore;
      case "manual_provider":
      case "manual_model":
        return 1000 + healthScore;
      case "auto":
        return quality + latency + cost + healthScore;
      default:
        return quality + healthScore;
    }
  }

  private healthScore(status?: ProviderHealth["status"]): number {
    switch (status) {
      case "healthy":
        return 30;
      case "slow":
        return 20;
      case "degraded":
        return 10;
      case "unknown":
      case undefined:
        return 5;
      default:
        return -100;
    }
  }
}
