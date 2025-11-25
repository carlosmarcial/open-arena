import { normalizeModelName } from '@/lib/utils/modelOverrides';

type CredentialEntry = {
  apiKeyVar: string;
  apiSecretVar: string;
};

const MODEL_ENV_MAP: Record<string, CredentialEntry> = {
  'Claude Sonnet 4.5': {
    apiKeyVar: 'CLAUDE_ASTER_API_KEY',
    apiSecretVar: 'CLAUDE_ASTER_API_SECRET',
  },
  'GPT 5': {
    apiKeyVar: 'GPT_ASTER_API_KEY',
    apiSecretVar: 'GPT_ASTER_API_SECRET',
  },
  'Mistral Medium 3.1': {
    apiKeyVar: 'MISTRAL_ASTER_API_KEY',
    apiSecretVar: 'MISTRAL_ASTER_API_SECRET',
  },
  'DeepSeek Chat V3.1': {
    apiKeyVar: 'DEEPSEEK_ASTER_API_KEY',
    apiSecretVar: 'DEEPSEEK_ASTER_API_SECRET',
  },
  'Grok 4': {
    apiKeyVar: 'GROK_ASTER_API_KEY',
    apiSecretVar: 'GROK_ASTER_API_SECRET',
  },
  'Qwen3 Max': {
    apiKeyVar: 'QWEN_ASTER_API_KEY',
    apiSecretVar: 'QWEN_ASTER_API_SECRET',
  },
  // Legacy alias ensures backward compatibility if normalization fails upstream.
  'Gemini 2.5 Pro': {
    apiKeyVar: 'MISTRAL_ASTER_API_KEY',
    apiSecretVar: 'MISTRAL_ASTER_API_SECRET',
  },
};

export function getAsterCredentials(modelName: string): { apiKey: string; apiSecret: string } {
  const normalizedName = normalizeModelName(modelName);
  const trimmedOriginalName = modelName?.trim?.() ?? '';

  const candidateNames = Array.from(
    new Set(
      [normalizedName, trimmedOriginalName].filter((name): name is string => Boolean(name.length))
    )
  );

  for (const name of candidateNames) {
    const entry = MODEL_ENV_MAP[name];
    if (!entry) {
      continue;
    }
    const apiKey = process.env[entry.apiKeyVar];
    const apiSecret = process.env[entry.apiSecretVar];
    if (!apiKey || !apiSecret) {
      break;
    }
    return { apiKey, apiSecret };
  }

  throw new Error(`Missing Aster API credentials for model: ${modelName}`);
}
