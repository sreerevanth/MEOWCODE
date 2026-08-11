import { describe, it, expect } from "vitest";
import { createDefaultProviderRegistry, PROVIDER_DEFINITIONS } from "../src/index.js";
import { inferCapabilitiesFromModel } from "../src/definitions.js";

describe("Providers Package", () => {
  it("registers all catalog providers", () => {
    const registry = createDefaultProviderRegistry();
    const providers = registry.list();
    expect(providers.length).toBe(PROVIDER_DEFINITIONS.length);

    const openai = registry.get("openai");
    expect(openai.displayName).toBe("OpenAI");
    expect(openai.supportsCustomEndpoint).toBe(true);
  });

  it("includes anthropic as a dedicated plugin", () => {
    const registry = createDefaultProviderRegistry();
    const anthropic = registry.get("anthropic");
    expect(anthropic.displayName).toBe("Anthropic");
  });

  it("includes local and custom openai-compatible providers", () => {
    const registry = createDefaultProviderRegistry();
    expect(registry.has("ollama")).toBe(true);
    expect(registry.has("custom-openai")).toBe(true);
    expect(registry.has("litellm")).toBe(true);
  });

  it("infers model capabilities from model id", () => {
    const caps = inferCapabilitiesFromModel("gpt-4o", ["chat"], {});
    expect(caps).toContain("vision");
    expect(caps).toContain("chat");
  });

  it("detects embedding models", () => {
    const caps = inferCapabilitiesFromModel("text-embedding-3-large", ["embeddings"], {});
    expect(caps).toContain("embeddings");
  });
});
