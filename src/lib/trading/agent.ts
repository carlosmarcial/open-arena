/**
 * LLM Trading Agent
 * Uses OpenRouter to make autonomous trading decisions
 */

import { OpenRouterClient, LLMMessage, OPENROUTER_MODELS } from '../openrouter';
import { jsonrepair } from 'jsonrepair';
import { normalizeApiModel } from '../utils/modelOverrides';

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  takeProfitPercent?: number | null;
  stopLossPercent?: number | null;
  maxHoldMinutes?: number | null;
}

export interface Portfolio {
  equity: number;
  availableCash: number;
  totalPnl: number;
  pnlPercentage: number;
  positions: Position[];
}

export interface TradingDecision {
  action: 'HOLD' | 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE';
  symbol?: string;
  size?: number;
  leverage?: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
  maxHoldMinutes?: number;
  reasoning: string;
  confidence: number; // 0-100
  // Future extension: trailing stops (not yet acted upon by executors)
  trailingStopPercent?: number;
}

export interface RecentDecisionSummary {
  decision: string;
  reasoning: string;
  confidence: number;
  timestamp: string;
}

export interface MarketRegimeSummary {
  label: string;
  commentary: string;
  metrics: Record<string, string | number>;
}

export interface IndicatorHighlight {
  symbol: string;
  summary: string;
}

export interface TradingContext {
  recentDecisions?: RecentDecisionSummary[];
  indicatorHighlights?: IndicatorHighlight[];
  marketRegime?: MarketRegimeSummary | null;
}

export class LLMTradingAgent {
  private client: OpenRouterClient;
  private model: string;
  private name: string;

  constructor(apiKey: string, model: string, name: string) {
    this.client = new OpenRouterClient(apiKey);
    this.model = model;
    this.name = name;
  }

  async analyzeAndDecide(
    portfolio: Portfolio,
    marketData: MarketData[],
    context: TradingContext = {}
  ): Promise<TradingDecision> {
    const systemPrompt = `You are an autonomous cryptocurrency trader in a high-energy trading competition.

Your mandate is to MAXIMIZE RISK-ADJUSTED RETURNS while showcasing distinctive trading styles.

RISK GUARDRAILS (MUST follow when proposing trades):
- Maximum leverage: 10x
- Maximum position size: 35% of equity per trade
- Maximum 3 concurrent positions

EXIT POLICY (MODEL-DRIVEN):
- You MAY omit fixed take-profit/stop-loss/hold time. If omitted, you are responsible for future CLOSE decisions.
- If you provide explicit targets, keep them within sane bounds: TP between +0.5% and +100%, SL between -0.2% and -20%.
- Holding time is optional. If provided, choose between 30 minutes and 48 hours; otherwise manage dynamically.
- You may propose dynamic techniques (e.g., trailing stops) but only include fields defined in the schema.

STRATEGY PLAYBOOK:
- Seek momentum bursts, mean reversion pivots, and regime shifts across supported symbols
- Be willing to flip bias (LONG ⇄ SHORT) on the same asset if market structure invalidates your prior view
- Diversify risk profiles: mix aggressive scalps with higher-conviction swing ideas when appropriate
- Clearly articulate why your proposed risk targets (if any) fit the trade thesis
- Protect capital, but do not be afraid to express bold convictions within the guardrails

RESPONSE FORMAT (JSON only):
{
  "action": "HOLD" | "OPEN_LONG" | "OPEN_SHORT" | "CLOSE",
  "symbol": "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "BNBUSDT" | "DOGEUSDT" | "SUIUSDT" (required for OPEN/CLOSE),
  "size": number (USD amount, 10-125 range, only for OPEN),
  "leverage": number (1-10, only for OPEN),
  "takeProfitPercent": number (e.g. 0.08 for +8%, optional for OPEN),
  "stopLossPercent": number (e.g. 0.04 for -4%, optional for OPEN),
  "maxHoldMinutes": number (between 30 and 2880, optional for OPEN),
  "reasoning": "Brief analysis of why this action",
  "confidence": number (0-100)
}`;

    const recentDecisionsSection = context.recentDecisions?.length
      ? `RECENT DECISIONS (newest first):
${context.recentDecisions
        .slice(0, 5)
        .map((d) => {
          const ts = new Date(d.timestamp).toISOString();
          const reason = d.reasoning ? truncate(d.reasoning, 220) : 'No reasoning captured';
          return `- ${ts} | ${d.decision} | Confidence: ${Math.round(d.confidence)}%
  ${reason}`;
        })
        .join('\n')}
`
      : 'RECENT DECISIONS: None logged yet.';

    const indicatorHighlightsSection = context.indicatorHighlights?.length
      ? `
KEY TECHNICAL HIGHLIGHTS:
${context.indicatorHighlights
        .map((h) => `- ${h.symbol}: ${h.summary}`)
        .join('\n')}
`
      : '';

    const marketRegimeSection = context.marketRegime
      ? `
MARKET REGIME ASSESSMENT: ${context.marketRegime.label.toUpperCase()}
${context.marketRegime.commentary}
${Object.entries(context.marketRegime.metrics)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n')}
`
      : '';

    const userPrompt = `CURRENT PORTFOLIO:
- Equity: $${portfolio.equity.toFixed(2)}
- Available Cash: $${portfolio.availableCash.toFixed(2)}
- Total P&L: ${portfolio.totalPnl >= 0 ? '+' : ''}$${portfolio.totalPnl.toFixed(2)} (${portfolio.pnlPercentage.toFixed(2)}%)
- Open Positions: ${portfolio.positions.length}/3

${portfolio.positions.length > 0 ? `OPEN POSITIONS:
${portfolio.positions.map(p => {
  const pnlPercent = ((p.unrealizedPnl / (p.entryPrice * p.quantity)) * 100).toFixed(2);
  const tp = p.takeProfitPercent ? ` | TP: ${(p.takeProfitPercent * 100).toFixed(1)}%` : '';
  const sl = p.stopLossPercent ? ` | SL: ${(p.stopLossPercent * 100).toFixed(1)}%` : '';
  const hold = p.maxHoldMinutes ? ` | Max hold: ${p.maxHoldMinutes}m` : '';
  return `- ${p.side} ${p.symbol} @ $${p.entryPrice.toFixed(2)} | P&L: ${p.unrealizedPnl >= 0 ? '+' : ''}$${p.unrealizedPnl.toFixed(2)} (${pnlPercent}%)${tp}${sl}${hold}`;
}).join('\n')}

You may close, tighten risk, or reverse if conditions changed.` : 'POSITIONS: None - Look for high-probability entry opportunities with engaging risk profiles!'}

${recentDecisionsSection}
${indicatorHighlightsSection}
${marketRegimeSection}

MARKET DATA (last 24h):
${marketData.map(m =>
  `- ${m.symbol}: $${m.price.toFixed(2)} (${m.change24h >= 0 ? '+' : ''}${m.change24h.toFixed(2)}% trend)`
).join('\n')}

DECISION TIME: Analyze momentum, trends, and your positions. Take action!
Respond with JSON only (no explanations outside JSON).`;

    try {
      const normalizedModelId = normalizeApiModel(this.model);

      const response = await this.client.chat(this.model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.7,
        max_tokens: normalizedModelId.includes('mistral-medium-3.1') ? 900 : 500,
      });

      // Parse JSON response (handle markdown wrappers and stray text)
      let jsonText = response.content.trim();

      const fencedBlock = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fencedBlock) {
        jsonText = fencedBlock[1].trim();
      } else {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/```$/, '')
          .trim();
      }

      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        jsonText = jsonText.slice(firstBrace, lastBrace + 1);
      }

      let result;
      try {
        result = JSON.parse(jsonText);
      } catch (parseError) {
        try {
          const repaired = jsonrepair(jsonText);
          result = JSON.parse(repaired);
        } catch (repairError) {
          console.error('LLM Agent JSON parse failure', {
            model: this.model,
            name: this.name,
            rawResponse: truncate(response.content, 800),
            sanitized: truncate(jsonText, 800),
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            repairError: repairError instanceof Error ? repairError.message : String(repairError),
          });
          throw parseError;
        }
      }

      const normalizeNumber = (value: unknown): number | undefined => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
      };

      const normalized = {
        size: normalizeNumber(result.size),
        leverage: normalizeNumber(result.leverage),
        takeProfitPercent: normalizeNumber(result.takeProfitPercent),
        stopLossPercent: normalizeNumber(result.stopLossPercent),
        maxHoldMinutes:
          Number.isInteger(result.maxHoldMinutes) || typeof result.maxHoldMinutes === 'number'
            ? Math.round(Number(result.maxHoldMinutes))
            : undefined,
        confidence: normalizeNumber(result.confidence),
        trailingStopPercent: normalizeNumber((result as any).trailingStopPercent),
      };

      const issues: string[] = [];
      const action = typeof result.action === 'string' ? result.action : '';
      const validActions = ['HOLD', 'OPEN_LONG', 'OPEN_SHORT', 'CLOSE'] as const;

      if (!validActions.includes(action as typeof validActions[number])) {
        issues.push('Invalid or missing action');
      }

      const symbol = typeof result.symbol === 'string' ? result.symbol : undefined;
      const isOpenAction = action === 'OPEN_LONG' || action === 'OPEN_SHORT';

      if (isOpenAction) {
        if (!symbol) issues.push('Missing symbol for open action');
        if (normalized.size === undefined) issues.push('Missing size for open action');
        if (normalized.leverage === undefined) issues.push('Missing leverage for open action');
      }

      if (action === 'CLOSE' && !symbol) {
        issues.push('Missing symbol for close action');
      }

      if (issues.length > 0) {
        console.warn('LLM Agent incomplete decision', {
          model: this.model,
          name: this.name,
          issues,
          payload: truncate(JSON.stringify(result), 800),
        });

        return {
          action: 'HOLD' as const,
          reasoning:
            result.reasoning ||
            `Received incomplete decision from model: ${issues.join('; ')}. Holding current positions.`,
          confidence: Math.max(0, Math.min(100, normalized.confidence ?? 0)),
        };
      }

      return {
        action,
        symbol,
        size: normalized.size,
        leverage: normalized.leverage,
        takeProfitPercent: normalized.takeProfitPercent,
        stopLossPercent: normalized.stopLossPercent,
        maxHoldMinutes: normalized.maxHoldMinutes,
        reasoning: result.reasoning || 'No reasoning provided',
        confidence: Math.max(0, Math.min(100, normalized.confidence ?? 50)),
        trailingStopPercent: normalized.trailingStopPercent,
      };

    } catch (error) {
      console.error('LLM Agent Error:', error);
      const message = error instanceof Error ? error.message : String(error);
      // Return safe default decision
      return {
        action: 'HOLD',
        reasoning: `Error occurred during analysis: ${message}. Holding current positions.`,
        confidence: 0,
      };
    }
  }

  getName(): string {
    return this.name;
  }

  getModel(): string {
    return this.model;
  }
}

function truncate(value: string, limit = 220): string {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

// Factory function to create agents for different models
export function createTradingAgent(apiKey: string, modelName: string): LLMTradingAgent {
  const modelMap: Record<string, string> = {
    'Claude Sonnet 4.5': OPENROUTER_MODELS.CLAUDE_3_5_SONNET,
    'GPT 5': OPENROUTER_MODELS.GPT_4O,
    'Mistral Medium 3.1': OPENROUTER_MODELS.MISTRAL_MEDIUM_3_1,
    'DeepSeek Chat V3.1': OPENROUTER_MODELS.DEEPSEEK_CHAT,
    'Grok 4': OPENROUTER_MODELS.GROK_2,
    'Qwen3 Max': OPENROUTER_MODELS.QWEN_72B,
  };

  const model = modelMap[modelName] || OPENROUTER_MODELS.GPT_4O; // Default fallback

  return new LLMTradingAgent(apiKey, model, modelName);
}
