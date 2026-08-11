# Provider Plugin System

Provider plugins implement `ProviderPlugin` from `@meowcode/providers`.

```ts
export interface ProviderPlugin {
  id: ProviderId;
  displayName: string;
  capabilities: ProviderCapability[];
  supportsCustomEndpoint: boolean;
  verify(config: ProviderConnectionConfig): Promise<ProviderHealth>;
  listModels(config: ProviderConnectionConfig): Promise<ModelDescriptor[]>;
  chat(request: ProviderChatRequest): Promise<ProviderChatResponse>;
  streamChat?(request: ProviderChatRequest): AsyncIterable<ProviderStreamEvent>;
}
```

The core platform ships generic adapters for OpenAI-compatible servers and provider-specific plugins can be added without changing router or API code.

## Built-In Families

- Direct providers: OpenAI, Anthropic, Google, xAI, DeepSeek, Mistral, Cohere, and others.
- Routers and gateways: OpenRouter, LiteLLM, Portkey, Cloudflare AI Gateway, Helicone AI Gateway, and compatible proxies.
- Self-hosted servers: vLLM, Ollama, LocalAI, llama.cpp server, TGI, SGLang, LM Studio, FastChat, and Xinference.

## Dynamic Models

No model list is hardcoded into product logic. Plugins discover models, map capabilities, and persist metadata for routing.
