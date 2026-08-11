import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider, ProviderRegistry } from "../src/index";

describe("ProviderRegistry", () => {
  it("registers and retrieves plugins", () => {
    const registry = new ProviderRegistry();
    const plugin = new OpenAICompatibleProvider({
      id: "test",
      displayName: "Test",
      defaultEndpoint: "http://localhost:1/v1"
    });
    registry.register(plugin);
    expect(registry.get("test")).toBe(plugin);
  });

  it("rejects duplicate provider ids", () => {
    const registry = new ProviderRegistry();
    const plugin = new OpenAICompatibleProvider({
      id: "test",
      displayName: "Test",
      defaultEndpoint: "http://localhost:1/v1"
    });
    registry.register(plugin);
    expect(() => registry.register(plugin)).toThrow("already registered");
  });
});
