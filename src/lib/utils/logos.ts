/**
 * Local logo utilities
 * Provides paths for AI model and cryptocurrency logos stored under /public/logos
 */

type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'deepseek'
  | 'xai'
  | 'alibaba'
  | 'meta'
  | 'mistral'
  | 'benchmark';

const AI_MODEL_PROVIDER_MAP: Record<string, AIProvider> = {
  // Anthropic models
  'anthropic/claude-3.5-sonnet': 'anthropic',
  'anthropic/claude-3.5-sonnet-20241022': 'anthropic',
  'anthropic/claude-sonnet-4.5': 'anthropic',
  'anthropic/claude-3-opus': 'anthropic',
  'anthropic/claude-3-sonnet': 'anthropic',
  'anthropic/claude-3-haiku': 'anthropic',

  // OpenAI models
  'openai/gpt-4o': 'openai',
  'openai/gpt-5': 'openai',
  'openai/gpt-4': 'openai',
  'openai/gpt-3.5-turbo': 'openai',
  'openai/o1': 'openai',

  // Google models
  'google/gemini-2.0-flash-exp': 'google',
  'google/gemini-2.0-flash-exp:free': 'google',
  'google/gemini-2.5-pro': 'google',
  'google/gemini-pro': 'google',
  'google/gemini-1.5-pro': 'google',

  // DeepSeek models
  'deepseek/deepseek-chat': 'deepseek',
  'deepseek/deepseek-chat-v3.1': 'deepseek',
  'deepseek/deepseek-coder': 'deepseek',

  // xAI models
  'xai/grok-2-1212': 'xai',
  'xai/grok-beta': 'xai',
  'x-ai/grok-2-1212': 'xai',
  'x-ai/grok-4': 'xai',
  'x-ai/grok-beta': 'xai',

  // Alibaba/Qwen models
  'alibaba/qwen2.5-72b-instruct': 'alibaba',
  'qwen/qwen-2.5': 'alibaba',
  'qwen/qwen-2.5-72b-instruct': 'alibaba',
  'qwen/qwen3-max': 'alibaba',

  // Meta models
  'meta/llama-3': 'meta',
  'meta-llama/llama-3.1': 'meta',

  // Mistral models
  'mistralai/mistral-large': 'mistral',
  'mistralai/mistral-medium-3.1': 'mistral',
   'mistralai/mixtral': 'mistral',

  // Benchmark baseline
  'btc-hodl': 'benchmark',
};

const MODEL_API_ALIASES: Record<string, string> = {
  'google/gemini-2.5-pro': 'mistralai/mistral-medium-3.1',
  'google/gemini-2.0-flash-exp': 'mistralai/mistral-medium-3.1',
  'google/gemini-2.0-flash-exp:free': 'mistralai/mistral-medium-3.1',
};

const resolveApiModelAlias = (apiModel: string): string =>
  MODEL_API_ALIASES[apiModel] ?? apiModel;

const AI_PROVIDER_LOGO_MAP: Partial<Record<AIProvider, string>> = {
  anthropic: '/logos/anthropic-1.svg',
  openai: '/logos/openai-2.svg',
  google: '/logos/gemini-icon-logo.svg',
  deepseek: '/logos/deepseek-2.svg',
  xai: '/logos/grok-1.svg',
  alibaba: '/logos/qwen_logo.svg',
  mistral: '/logos/Mistral.svg',
  benchmark: '/logos/ethereum-1.svg',
};

const AI_PROVIDER_EMOJI_FALLBACK: Record<AIProvider, string> = {
  anthropic: '🌟',
  openai: '🌀',
  google: '✦',
  deepseek: '🦜',
  xai: '⚡',
  alibaba: '🔷',
  meta: '🔵',
  mistral: '🌊',
  benchmark: '◆',
};

const DARK_MODE_INVERT_PROVIDERS = new Set<AIProvider>(['benchmark']);
const DARK_MODE_INVERT_CRYPTO_SYMBOLS = new Set(['ETH', 'ETHUSDT', 'ETHUSD']);

const CRYPTO_LOGO_MAP: Record<string, string> = {
  BTC: '/logos/bitcoin.svg',
  BTCUSDT: '/logos/bitcoin.svg',
  ETH: '/logos/ethereum-1.svg',
  ETHUSDT: '/logos/ethereum-1.svg',
  SOL: '/logos/solana.svg',
  SOLUSDT: '/logos/solana.svg',
  SUI: '/logos/sui_logo.svg',
  SUIUSDT: '/logos/sui_logo.svg',
  DOGE: '/logos/dogecoin.svg',
  DOGEUSDT: '/logos/dogecoin.svg',
  BNB: '/logos/binance-coin-bnb-.svg',
  BNBUSDT: '/logos/binance-coin-bnb-.svg',
};

const CRYPTO_EMOJI_FALLBACK: Record<string, string> = {
  BTC: '₿',
  BTCUSDT: '₿',
  ETH: '◆',
  ETHUSDT: '◆',
  SOL: '◎',
  SOLUSDT: '◎',
  SUI: '💧',
  SUIUSDT: '💧',
  DOGE: 'Ð',
  DOGEUSDT: 'Ð',
  BNB: '🟡',
  BNBUSDT: '🟡',
  ADAUSDT: '₳',
  MATICUSDT: '⬡',
  DOTUSDT: '●',
  AVAXUSDT: '▲',
  LINKUSDT: '⬡',
  UNIUSDT: '🦄',
  ATOMUSDT: '⚛',
  NEARUSDT: 'Ⓝ',
  APTUSDT: 'Ⓐ',
  ARBUSDT: '🔷',
  OPUSDT: '🔴',
};

type LogoOptions = {
  size?: number;
};

/**
 * Gets the local logo path for an AI model
 * @param apiModel - The API model identifier (e.g., 'anthropic/claude-3.5-sonnet')
 * @param _options - Preserved for API compatibility (size handled via styling)
 * @returns Logo path or null if not found
 */
export function getAIModelLogo(apiModel: string, _options: LogoOptions = {}): string | null {
  const resolvedModel = resolveApiModelAlias(apiModel);
  const provider = AI_MODEL_PROVIDER_MAP[resolvedModel] ?? AI_MODEL_PROVIDER_MAP[apiModel];
  if (!provider) {
    return null;
  }

  return AI_PROVIDER_LOGO_MAP[provider] ?? null;
}

/**
 * Gets the local logo path for a cryptocurrency
 * @param symbol - The trading symbol (e.g., 'BTCUSDT')
 * @param _options - Preserved for API compatibility (size handled via styling)
 * @returns Logo path or null if not found
 */
export function getCryptoLogo(symbol: string, _options: LogoOptions = {}): string | null {
  const normalized = symbol.toUpperCase();
  if (CRYPTO_LOGO_MAP[normalized]) {
    return CRYPTO_LOGO_MAP[normalized];
  }

  const base = normalized.replace(/(USDT|USD)$/, '');
  return CRYPTO_LOGO_MAP[base] ?? null;
}

/**
 * Gets the fallback emoji for an AI model
 * @param apiModel - The API model identifier
 * @returns Emoji string
 */
export function getAIModelEmoji(apiModel: string): string {
  const resolvedModel = resolveApiModelAlias(apiModel);
  const provider = AI_MODEL_PROVIDER_MAP[resolvedModel] ?? AI_MODEL_PROVIDER_MAP[apiModel];
  return provider ? AI_PROVIDER_EMOJI_FALLBACK[provider] || '🤖' : '🤖';
}

/**
 * Gets the fallback emoji for a cryptocurrency
 * @param symbol - The trading symbol
 * @returns Emoji string
 */
export function getCryptoEmoji(symbol: string): string {
  const normalized = symbol.toUpperCase();
  return (
    CRYPTO_EMOJI_FALLBACK[normalized] ||
    CRYPTO_EMOJI_FALLBACK[`${normalized}USDT`] ||
    CRYPTO_EMOJI_FALLBACK[`${normalized}USD`] ||
    '●'
  );
}

/**
 * Gets the crypto symbol without the quote currency (e.g., 'BTC' from 'BTCUSDT')
 * @param symbol - The trading symbol
 * @returns Base currency symbol
 */
export function getCryptoSymbolName(symbol: string): string {
  return symbol.replace('USDT', '').replace('USD', '');
}

/**
 * Determines if an AI model logo should invert in dark mode for visibility.
 */
export function shouldInvertAIModelLogo(apiModel?: string | null): boolean {
  if (!apiModel) {
    return false;
  }

  const resolvedModel = resolveApiModelAlias(apiModel);
  const provider = AI_MODEL_PROVIDER_MAP[resolvedModel] ?? AI_MODEL_PROVIDER_MAP[apiModel];
  return provider ? DARK_MODE_INVERT_PROVIDERS.has(provider) : false;
}

/**
 * Determines if a crypto logo should invert in dark mode for visibility.
 */
export function shouldInvertCryptoLogo(symbol?: string | null): boolean {
  if (!symbol) {
    return false;
  }

  const normalized = symbol.toUpperCase();
  if (DARK_MODE_INVERT_CRYPTO_SYMBOLS.has(normalized)) {
    return true;
  }

  const base = normalized.replace(/(USDT|USD)$/, '');
  return DARK_MODE_INVERT_CRYPTO_SYMBOLS.has(base);
}
