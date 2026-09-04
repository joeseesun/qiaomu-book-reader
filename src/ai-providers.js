// Provider metadata lives outside the settings UI so endpoints, model aliases
// and help links can be reviewed and updated without touching reader logic.
export const AI_PROVIDER_CATEGORIES = [
  { id: "cli", label: "本机账号（无需 API 密钥）" },
  { id: "china", label: "国产模型" },
  { id: "aggregator", label: "聚合服务" },
  { id: "international", label: "国际服务" },
  { id: "local", label: "本地模型" },
  { id: "advanced", label: "高级" },
];

export const AI_PROVIDERS = {
  "codex-cli": {
    label: "Codex CLI",
    category: "cli",
    transport: "cli",
    needsKey: false,
    binary: "codex",
    model: "",
    models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.4-mini"],
    desktopOnly: true,
    description: "复用本机 Codex 的 ChatGPT 登录，无需再填 API 密钥。",
  },
  "claude-cli": {
    label: "Claude Code CLI",
    category: "cli",
    transport: "cli",
    needsKey: false,
    binary: "claude",
    model: "",
    models: ["haiku", "sonnet", "opus"],
    desktopOnly: true,
    description: "复用本机 Claude Code 登录，无需再填 API 密钥。",
  },
  "grok-cli": {
    label: "Grok CLI",
    category: "cli",
    transport: "cli",
    needsKey: false,
    binary: "grok",
    model: "",
    models: ["grok-4.6", "grok-4.5"],
    desktopOnly: true,
    description: "复用本机 Grok 登录，无需再填 API 密钥。",
  },
  "kimi-cli": {
    label: "Kimi Code CLI",
    category: "cli",
    transport: "cli",
    needsKey: false,
    binary: "kimi",
    model: "",
    models: [],
    desktopOnly: true,
    description: "通过 Kimi Code CLI 内置 ACP 复用本机登录。",
  },
  "zcode-cli": {
    label: "ZCode CLI",
    category: "cli",
    transport: "cli",
    needsKey: false,
    binary: "zcode-acp",
    model: "",
    models: [],
    desktopOnly: true,
    description: "通过社区 ZCode ACP 适配器连接本机 ZCode 登录。",
  },
  deepseek: {
    label: "DeepSeek",
    category: "china",
    needsKey: true,
    base: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    description: "DeepSeek 官方接口，中文阅读推荐。",
    recommended: true,
    supportsThinking: true,
  },
  kimi: {
    label: "Kimi（Moonshot）",
    category: "china",
    needsKey: true,
    base: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
    models: ["kimi-k2.6"],
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    description: "月之暗面 Kimi 官方接口。",
    recommended: true,
  },
  qwen: {
    label: "通义千问（阿里百炼）",
    category: "china",
    needsKey: true,
    base: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    apiKeyUrl: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    description: "阿里云百炼 OpenAI 兼容接口。",
    recommended: true,
  },
  zhipu: {
    label: "智谱 GLM",
    category: "china",
    needsKey: true,
    base: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5.3",
    models: ["glm-5.3"],
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys",
    description: "智谱 AI 开放平台官方接口。",
  },
  minimax: {
    label: "MiniMax",
    category: "china",
    needsKey: true,
    base: "https://api.minimax.cn/v1",
    model: "MiniMax-M3",
    models: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.5"],
    apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    description: "MiniMax 国内开放平台 OpenAI 兼容接口。",
  },
  siliconflow: {
    label: "硅基流动",
    category: "aggregator",
    needsKey: true,
    base: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen3-8B",
    models: ["Qwen/Qwen3-8B", "deepseek-ai/DeepSeek-V3"],
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    description: "国内多模型聚合服务。",
    recommended: true,
  },
  doubao: {
    label: "豆包（火山方舟）",
    category: "aggregator",
    needsKey: true,
    base: "https://ark.cn-beijing.volces.com/api/v3",
    model: "",
    models: [],
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    description: "模型栏需填写你在火山方舟创建的推理接入点 ID。",
  },
  openrouter: {
    label: "OpenRouter",
    category: "aggregator",
    needsKey: true,
    base: "https://openrouter.ai/api/v1",
    model: "deepseek/deepseek-chat",
    models: ["deepseek/deepseek-chat", "openai/gpt-4.1-mini", "google/gemini-2.5-flash"],
    apiKeyUrl: "https://openrouter.ai/settings/keys",
    description: "国际多模型聚合服务。",
  },
  openai: {
    label: "OpenAI",
    category: "international",
    needsKey: true,
    base: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    models: ["gpt-4.1-mini", "gpt-4.1"],
    apiKeyUrl: "https://platform.openai.com/api-keys",
    description: "OpenAI 官方接口。",
  },
  ollama: {
    label: "Ollama",
    category: "local",
    needsKey: false,
    base: "http://localhost:11434/v1",
    model: "qwen3:8b",
    models: ["qwen3:8b", "qwen3:4b", "deepseek-r1:8b"],
    description: "在本机运行模型，默认端口 11434。",
    local: true,
  },
  lmstudio: {
    label: "LM Studio",
    category: "local",
    needsKey: false,
    base: "http://localhost:1234/v1",
    model: "",
    models: [],
    description: "在本机运行模型，默认端口 1234。",
    local: true,
  },
  custom: {
    label: "自定义 OpenAI 兼容接口",
    category: "advanced",
    needsKey: false,
    base: "",
    model: "",
    models: [],
    description: "填写自己的 Base URL、模型名称和可选密钥。",
  },
};

export function aiProviderFor(id) {
  return AI_PROVIDERS[id] || null;
}

export function normalizeAiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function classifyAiHttpStatus(status) {
  if (status >= 200 && status < 300) return "";
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 429) return "limit";
  return "http";
}

export function buildAiRequestBody(providerId, model, messages, options = {}) {
  const body = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: options.connectionTest ? 16 : 2400,
  };
  if (options.stream) body.stream = true;
  // A connection check needs one short answer. In real reading conversations
  // DeepSeek may return reasoning_content, which the UI shows separately.
  if (providerId === "deepseek") {
    body.thinking = {
      type: options.connectionTest || options.thinkingEnabled === false
        ? "disabled"
        : "enabled",
    };
  }
  return body;
}

export function buildAiRequestOptions(base, key, body) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  return {
    url: `${base}/chat/completions`,
    method: "POST",
    headers,
    throw: false,
    body: JSON.stringify(body),
  };
}
