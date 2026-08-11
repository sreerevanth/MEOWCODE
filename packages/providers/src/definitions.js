function logo(slug) {
    return `https://cdn.simpleicons.org/${slug}`;
}
export const PROVIDER_DEFINITIONS = [
    {
        providerId: "openai",
        displayName: "OpenAI",
        description: "GPT, o-series, embeddings, vision, and image models via the OpenAI API.",
        logoUrl: logo("openai"),
        defaultEndpoint: "https://api.openai.com/v1",
        capabilities: ["chat", "responses", "embeddings", "vision", "images", "speech", "tools", "json", "reasoning", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "anthropic",
        displayName: "Anthropic",
        description: "Claude family models with tool use, vision, and long context.",
        logoUrl: logo("anthropic"),
        defaultEndpoint: "https://api.anthropic.com/v1",
        capabilities: ["chat", "vision", "tools", "json", "reasoning", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "google-aistudio",
        displayName: "Google AI Studio",
        description: "Gemini models through the Google AI Studio OpenAI-compatible API.",
        logoUrl: logo("googlegemini"),
        defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
        capabilities: ["chat", "vision", "tools", "json", "reasoning", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "google-vertex",
        displayName: "Google Vertex AI",
        description: "Enterprise Gemini and partner models on Google Cloud Vertex AI.",
        logoUrl: logo("googlecloud"),
        defaultEndpoint: "https://us-central1-aiplatform.googleapis.com/v1",
        capabilities: ["chat", "vision", "embeddings", "tools", "json", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "openrouter",
        displayName: "OpenRouter",
        description: "Unified gateway to hundreds of models from many providers.",
        logoUrl: logo("openrouter"),
        defaultEndpoint: "https://openrouter.ai/api/v1",
        capabilities: ["chat", "vision", "tools", "json", "reasoning", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "groq",
        displayName: "Groq",
        description: "Ultra-fast inference for Llama, Mixtral, and other open models.",
        logoUrl: logo("groq"),
        defaultEndpoint: "https://api.groq.com/openai/v1",
        capabilities: ["chat", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "deepseek",
        displayName: "DeepSeek",
        description: "DeepSeek chat and reasoning models with competitive pricing.",
        logoUrl: logo("deepseek"),
        defaultEndpoint: "https://api.deepseek.com/v1",
        capabilities: ["chat", "reasoning", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "xai",
        displayName: "xAI",
        description: "Grok models from xAI with real-time knowledge capabilities.",
        logoUrl: logo("x"),
        defaultEndpoint: "https://api.x.ai/v1",
        capabilities: ["chat", "vision", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "mistral",
        displayName: "Mistral",
        description: "Mistral, Mixtral, and Codestral models from Mistral AI.",
        logoUrl: logo("mistralai"),
        defaultEndpoint: "https://api.mistral.ai/v1",
        capabilities: ["chat", "vision", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "cohere",
        displayName: "Cohere",
        description: "Command, Embed, and Rerank models via Cohere API.",
        logoUrl: logo("cohere"),
        defaultEndpoint: "https://api.cohere.com/compatibility/v1",
        capabilities: ["chat", "embeddings", "reranking", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "together",
        displayName: "Together AI",
        description: "Open-source model hosting and fine-tuning platform.",
        logoUrl: logo("together"),
        defaultEndpoint: "https://api.together.xyz/v1",
        capabilities: ["chat", "vision", "tools", "json", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "fireworks",
        displayName: "Fireworks AI",
        description: "Fast inference for open and proprietary models.",
        logoUrl: logo("fireworks"),
        defaultEndpoint: "https://api.fireworks.ai/inference/v1",
        capabilities: ["chat", "vision", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "deepinfra",
        displayName: "DeepInfra",
        description: "Serverless GPU inference for popular open models.",
        logoUrl: logo("deepinfra"),
        defaultEndpoint: "https://api.deepinfra.com/v1/openai",
        capabilities: ["chat", "embeddings", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "replicate",
        displayName: "Replicate",
        description: "Run and deploy ML models via Replicate API.",
        logoUrl: logo("replicate"),
        defaultEndpoint: "https://api.replicate.com/v1",
        capabilities: ["chat", "images", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "huggingface",
        displayName: "Hugging Face",
        description: "Inference API for models on the Hugging Face Hub.",
        logoUrl: logo("huggingface"),
        defaultEndpoint: "https://api-inference.huggingface.co/v1",
        capabilities: ["chat", "embeddings", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "cerebras",
        displayName: "Cerebras",
        description: "High-speed inference on Cerebras wafer-scale hardware.",
        defaultEndpoint: "https://api.cerebras.ai/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "sambanova",
        displayName: "SambaNova",
        description: "Enterprise AI platform with fast Llama inference.",
        defaultEndpoint: "https://api.sambanova.ai/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "nebius",
        displayName: "Nebius",
        description: "Token Factory inference for open models on Nebius cloud.",
        defaultEndpoint: "https://api.tokenfactory.nebius.com/v1",
        capabilities: ["chat", "embeddings", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "novita",
        displayName: "Novita",
        description: "Affordable GPU inference for open-source LLMs.",
        defaultEndpoint: "https://api.novita.ai/v3/openai",
        capabilities: ["chat", "images", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "siliconflow",
        displayName: "SiliconFlow",
        description: "High-performance inference platform for Asian and global models.",
        defaultEndpoint: "https://api.siliconflow.cn/v1",
        capabilities: ["chat", "embeddings", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "hyperbolic",
        displayName: "Hyperbolic",
        description: "Decentralized GPU inference marketplace.",
        defaultEndpoint: "https://api.hyperbolic.xyz/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "infermatic",
        displayName: "Infermatic",
        description: "OpenAI-compatible gateway for multiple model providers.",
        defaultEndpoint: "https://api.totalgpt.ai/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "featherless",
        displayName: "Featherless",
        description: "Serverless inference for open-weight language models.",
        defaultEndpoint: "https://api.featherless.ai/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "parasail",
        displayName: "Parasail",
        description: "GPU cloud inference with OpenAI-compatible endpoints.",
        defaultEndpoint: "https://api.parasail.io/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: true
    },
    {
        providerId: "modelscope",
        displayName: "ModelScope",
        description: "Alibaba ModelScope inference API for Chinese and global models.",
        defaultEndpoint: "https://api-inference.modelscope.cn/v1",
        capabilities: ["chat", "embeddings", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "github-models",
        displayName: "GitHub Models",
        description: "AI models available through GitHub Models marketplace.",
        logoUrl: logo("github"),
        defaultEndpoint: "https://models.inference.ai.azure.com",
        capabilities: ["chat", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "perplexity",
        displayName: "Perplexity",
        description: "Online LLMs with built-in web search and citations.",
        logoUrl: logo("perplexity"),
        defaultEndpoint: "https://api.perplexity.ai",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "moonshot",
        displayName: "Moonshot (Kimi)",
        description: "Kimi long-context models from Moonshot AI.",
        defaultEndpoint: "https://api.moonshot.cn/v1",
        capabilities: ["chat", "tools", "json", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "ai21",
        displayName: "AI21",
        description: "Jamba and Jurassic models from AI21 Labs.",
        defaultEndpoint: "https://api.ai21.com/studio/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "voyage",
        displayName: "Voyage AI",
        description: "State-of-the-art embedding and reranking models.",
        defaultEndpoint: "https://api.voyageai.com/v1",
        capabilities: ["embeddings", "reranking"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "jina",
        displayName: "Jina AI",
        description: "Embeddings, rerankers, and multimodal models from Jina.",
        logoUrl: logo("jina"),
        defaultEndpoint: "https://api.jina.ai/v1",
        capabilities: ["embeddings", "reranking", "vision"],
        supportsCustomEndpoint: false,
        requiresApiKey: true
    },
    {
        providerId: "litellm",
        displayName: "LiteLLM",
        description: "Self-hosted OpenAI-compatible proxy for 100+ providers.",
        logoUrl: logo("python"),
        defaultEndpoint: "http://localhost:4000/v1",
        capabilities: ["chat", "embeddings", "vision", "tools", "json", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "vllm",
        displayName: "vLLM",
        description: "High-throughput local inference server with OpenAI API.",
        defaultEndpoint: "http://localhost:8000/v1",
        capabilities: ["chat", "embeddings", "tools", "json", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "lmstudio",
        displayName: "LM Studio",
        description: "Local model runner with OpenAI-compatible server.",
        defaultEndpoint: "http://localhost:1234/v1",
        capabilities: ["chat", "tools", "json", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "ollama",
        displayName: "Ollama",
        description: "Run Llama, Mistral, and other models locally.",
        logoUrl: logo("ollama"),
        defaultEndpoint: "http://localhost:11434/v1",
        capabilities: ["chat", "vision", "tools", "json", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "open-webui",
        displayName: "Open WebUI",
        description: "Self-hosted AI interface with OpenAI-compatible API.",
        defaultEndpoint: "http://localhost:3000/api/v1",
        capabilities: ["chat", "vision", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "localai",
        displayName: "LocalAI",
        description: "Self-hosted OpenAI-compatible local inference stack.",
        defaultEndpoint: "http://localhost:8080/v1",
        capabilities: ["chat", "embeddings", "images", "speech", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "llama-cpp",
        displayName: "llama.cpp",
        description: "llama.cpp server with OpenAI-compatible HTTP API.",
        defaultEndpoint: "http://localhost:8080/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "tgi",
        displayName: "TGI",
        description: "Hugging Face Text Generation Inference server.",
        logoUrl: logo("huggingface"),
        defaultEndpoint: "http://localhost:8080/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "sglang",
        displayName: "SGLang",
        description: "Fast structured generation and serving framework.",
        defaultEndpoint: "http://localhost:30000/v1",
        capabilities: ["chat", "json", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "fastchat",
        displayName: "FastChat",
        description: "Multi-model chat serving with OpenAI-compatible API.",
        defaultEndpoint: "http://localhost:8000/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "xinference",
        displayName: "Xinference",
        description: "Distributed inference engine for local and cluster deployment.",
        defaultEndpoint: "http://localhost:9997/v1",
        capabilities: ["chat", "embeddings", "images", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "aphrodite",
        displayName: "Aphrodite",
        description: "High-performance OpenAI-compatible inference engine.",
        defaultEndpoint: "http://localhost:2242/v1",
        capabilities: ["chat", "streaming"],
        supportsCustomEndpoint: true,
        local: true,
        requiresApiKey: false
    },
    {
        providerId: "custom-openai",
        displayName: "Custom OpenAI-Compatible",
        description: "Connect any unknown provider with an OpenAI-compatible API endpoint.",
        defaultEndpoint: "http://localhost:8000/v1",
        capabilities: ["chat", "embeddings", "vision", "tools", "json", "streaming"],
        supportsCustomEndpoint: true,
        requiresApiKey: false
    }
];
export function getProviderDefinition(providerId) {
    return PROVIDER_DEFINITIONS.find((p) => p.providerId === providerId);
}
export function inferCapabilitiesFromModel(modelId, baseCapabilities, metadata) {
    const id = modelId.toLowerCase();
    const caps = new Set(["streaming"]);
    for (const cap of baseCapabilities) {
        if (cap !== "streaming")
            caps.add(cap);
    }
    if (/embed|embedding|text-embedding|voyage|jina-embed|bge-|e5-/.test(id)) {
        caps.add("embeddings");
        caps.delete("chat");
    }
    if (/rerank|reranker|cohere-rerank|jina-rerank/.test(id)) {
        caps.add("reranking");
    }
    if (/whisper|tts|speech|audio|voice|transcri/.test(id)) {
        caps.add("speech");
        caps.add("audio");
    }
    if (/dall-e|stable-diffusion|flux|image|midjourney|sdxl|playground-v/.test(id)) {
        caps.add("images");
    }
    if (/vision|gpt-4o|gpt-4-turbo|claude-3|gemini|llava|pixtral|qwen-vl|moondream|bakllava/.test(id)) {
        caps.add("vision");
    }
    if (/o1|o3|o4|deepseek-r|reason|think|qwq|r1/.test(id)) {
        caps.add("reasoning");
    }
    if (/gpt-|claude|gemini|llama|mistral|mixtral|command|qwen|deepseek|grok|chat/.test(id) && !caps.has("embeddings")) {
        caps.add("chat");
        caps.add("tools");
        caps.add("json");
    }
    const metaCaps = metadata?.capabilities ?? metadata?.capability;
    if (Array.isArray(metaCaps)) {
        for (const c of metaCaps) {
            if (typeof c === "string")
                caps.add(c);
        }
    }
    return [...caps];
}
export function parseContextWindow(metadata, modelId) {
    if (typeof metadata?.context_length === "number")
        return metadata.context_length;
    if (typeof metadata?.contextWindow === "number")
        return metadata.contextWindow;
    if (typeof metadata?.max_context === "number")
        return metadata.max_context;
    const id = (modelId ?? "").toLowerCase();
    if (/128k|128000/.test(id))
        return 128_000;
    if (/200k|200000/.test(id))
        return 200_000;
    if (/1m|1000000|1280000/.test(id))
        return 1_000_000;
    if (/32k|32000/.test(id))
        return 32_000;
    if (/8k|8000/.test(id))
        return 8_000;
    return undefined;
}
export function parsePricing(metadata) {
    const pricing = metadata?.pricing;
    if (pricing) {
        return {
            inputPerMillion: typeof pricing.prompt === "number" ? pricing.prompt * 1_000_000 : typeof pricing.input === "number" ? pricing.input : undefined,
            outputPerMillion: typeof pricing.completion === "number" ? pricing.completion * 1_000_000 : typeof pricing.output === "number" ? pricing.output : undefined
        };
    }
    if (typeof metadata?.input_price_per_million === "number" || typeof metadata?.output_price_per_million === "number") {
        return {
            inputPerMillion: metadata.input_price_per_million,
            outputPerMillion: metadata.output_price_per_million
        };
    }
    return {};
}
