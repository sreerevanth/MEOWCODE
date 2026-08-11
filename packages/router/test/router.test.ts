import { describe, expect, it } from "vitest";
import { ModelRouter } from "../src/index";
import type { ModelDescriptor, ProviderHealth } from "@meowcode/shared";

describe("ModelRouter health-aware routing", () => {
  const router = new ModelRouter();
  const discoveredAt = new Date(0).toISOString();

  const models: ModelDescriptor[] = [
    {
      id: "good-model",
      providerId: "good",
      displayName: "Good",
      capabilities: ["chat"],
      latencyP50Ms: 200,
      discoveredAt
    },
    {
      id: "slow-model",
      providerId: "slow",
      displayName: "Slow",
      capabilities: ["chat"],
      latencyP50Ms: 100,
      discoveredAt
    },
    {
      id: "offline-model",
      providerId: "offline",
      displayName: "Offline",
      capabilities: ["chat"],
      discoveredAt
    }
  ];

  it("avoids offline providers", () => {
    const plan = router.route({
      mode: "fastest",
      models,
      healthByProvider: new Map<string, ProviderHealth>([
        ["good", { status: "healthy", checkedAt: discoveredAt, latencyMs: 200 }],
        ["slow", { status: "slow", checkedAt: discoveredAt, latencyMs: 3000 }],
        ["offline", { status: "offline", checkedAt: discoveredAt }]
      ])
    });
    expect(plan.primary.providerId).not.toBe("offline");
  });

  it("prefers lower latency in fastest mode", () => {
    const plan = router.route({
      mode: "fastest",
      models: models.filter((m) => m.providerId !== "offline"),
      healthByProvider: new Map<string, ProviderHealth>([
        ["good", { status: "healthy", checkedAt: discoveredAt, latencyMs: 500 }],
        ["slow", { status: "healthy", checkedAt: discoveredAt, latencyMs: 100 }]
      ])
    });
    expect(plan.primary.id).toBe("slow-model");
  });

  it("respects connected provider filter", () => {
    expect(() =>
      router.route({
        mode: "auto",
        models,
        healthByProvider: new Map(),
        connectedProviderIds: new Set(["missing"])
      })
    ).toThrow();
  });
});
