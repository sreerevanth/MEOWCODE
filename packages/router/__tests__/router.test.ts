import { describe, expect, it } from "vitest";
import { ModelRouter } from "../src/index";
import type { ModelDescriptor } from "@meowcode/shared";

const discoveredAt = new Date(0).toISOString();

const models: ModelDescriptor[] = [
  {
    id: "cheap",
    providerId: "a",
    displayName: "Cheap",
    capabilities: ["chat"],
    isFree: true,
    latencyP50Ms: 800,
    qualityScore: 40,
    discoveredAt
  },
  {
    id: "quality",
    providerId: "b",
    displayName: "Quality",
    capabilities: ["chat", "vision"],
    pricing: { inputPerMillion: 5, outputPerMillion: 15, currency: "USD" },
    latencyP50Ms: 400,
    qualityScore: 95,
    discoveredAt
  }
];

describe("ModelRouter", () => {
  it("routes to free models for free_only", () => {
    const plan = new ModelRouter().route({
      mode: "free_only",
      models,
      healthByProvider: new Map()
    });
    expect(plan.primary.id).toBe("cheap");
  });

  it("routes to capable models for vision", () => {
    const plan = new ModelRouter().route({
      mode: "vision",
      models,
      healthByProvider: new Map()
    });
    expect(plan.primary.id).toBe("quality");
  });
});
