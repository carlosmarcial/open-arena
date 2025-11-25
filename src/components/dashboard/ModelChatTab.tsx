/**
 * MODELCHAT Tab
 * Shows AI reasoning and decision-making logs
 */

'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { ModelReasoning, Model } from '@/lib/supabase';
import { ModelFilterDropdown } from '@/components/ui/ModelFilterDropdown';
import { cn } from '@/lib/utils';
import { getAIModelLogo, shouldInvertAIModelLogo } from '@/lib/utils/logos';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

interface ReasoningData {
  reasoning: (ModelReasoning & { model: Model })[];
  lastUpdated: string;
}

interface ModelOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  api_model: string;
}

function getPrimarySummary(item: ModelReasoning & { model: Model }) {
  const reasoning = item.reasoning_text?.trim();
  if (reasoning) {
    return reasoning;
  }

  const snapshotSummary = typeof item.market_snapshot?.summary === 'string'
    ? item.market_snapshot.summary.trim()
    : '';

  if (snapshotSummary) {
    return snapshotSummary;
  }

  return item.decision;
}

export function ModelChatTab() {
  const [data, setData] = useState<ReasoningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchModels();
    fetchReasoning();
  }, [selectedModel]);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      const filteredModels = data.models as ModelOption[];
      setModels(filteredModels.map((model) => applyModelUIOverrides(model)));
    } catch (err) {
      console.error('Error fetching models:', err);
    }
  };

  const fetchReasoning = async () => {
    try {
      setLoading(true);
      const url = selectedModel === 'all'
        ? '/api/reasoning'
        : `/api/reasoning?modelId=${selectedModel}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch reasoning');
      const data = await response.json();
      const normalizedReasoning = data.reasoning.map(
        (item: ModelReasoning & { model: Model }) => ({
          ...item,
          model: applyModelUIOverrides(item.model),
        })
      );
      setData({
        reasoning: normalizedReasoning,
        lastUpdated: data.lastUpdated,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
                <div className="h-12 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading reasoning: {error}</p>
        <button
          onClick={fetchReasoning}
          className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">FILTER:</span>
          <ModelFilterDropdown
            models={models}
            selectedModelId={selectedModel}
            onSelectModel={setSelectedModel}
          />
        </div>
        {data.reasoning.length > 0 && (
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-right">
            Showing {data.reasoning.length} reasoning log{data.reasoning.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Reasoning Feed */}
      <div className="space-y-3">
        {data.reasoning.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="mb-3 text-4xl">🤖</div>
            <p className="text-sm font-medium">No reasoning logs yet</p>
            <p className="text-xs mt-1">AI models will share their thoughts here as they analyze markets</p>
          </div>
        ) : (
          data.reasoning.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const logo = getAIModelLogo(item.model.api_model);
            const isDeepSeek = item.model.api_model?.toLowerCase().includes('deepseek');
            const summaryText = getPrimarySummary(item);

            return (
              <div
                key={item.id}
                className="rounded-lg border-2 bg-card transition-all duration-200 hover:shadow-md"
                style={{ borderColor: item.model.color }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-3 py-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Model Logo */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                      {logo ? (
                        <Image
                          src={logo}
                          alt={item.model.name}
                          width={isDeepSeek ? 40 : 36}
                          height={isDeepSeek ? 40 : 36}
                          className={cn(
                            isDeepSeek ? 'h-10 w-10' : 'h-9 w-9',
                            'object-contain',
                            shouldInvertAIModelLogo(item.model.api_model) && 'invert-on-dark'
                          )}
                          unoptimized
                        />
                      ) : (
                        <span className="text-2xl">{item.model.icon}</span>
                      )}
                    </div>

                    {/* Model Name & Timestamp */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 
                          className="text-base font-bold uppercase tracking-wide"
                          style={{ color: item.model.color }}
                        >
                          {item.model.name}
                        </h3>
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">
                        {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })},{' '}
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reasoning Text */}
                <div className="px-3 pb-3">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                    {summaryText}
                  </p>

                  {(item.decision || Number.isFinite(item.confidence)) && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {item.decision && (
                        <span className="font-medium uppercase tracking-wide">
                          Decision: <span className="text-foreground">{item.decision}</span>
                        </span>
                      )}
                      {Number.isFinite(item.confidence) && (
                        <span className="font-medium uppercase tracking-wide">
                          Confidence: <span className="text-foreground">{Math.round(item.confidence)}%</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="mt-3 text-xs italic text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? 'click to collapse' : 'click to expand'}
                  </button>

                  {/* Expanded Sections */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      {/* USER_PROMPT Section */}
                      {item.market_snapshot?.user_prompt && (
                        <ExpandableSection 
                          title="USER_PROMPT" 
                          defaultExpanded={false}
                        >
                          <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed text-muted-foreground">
                            {item.market_snapshot.user_prompt}
                          </pre>
                        </ExpandableSection>
                      )}

                      {/* CHAIN_OF_THOUGHT Section */}
                      <ExpandableSection 
                        title="CHAIN_OF_THOUGHT" 
                        defaultExpanded={false}
                      >
                        {item.reasoning_text ? (
                          <p className="text-sm leading-relaxed text-foreground">
                            {item.reasoning_text}
                          </p>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">
                            Chain of Thought is not available for this model
                          </p>
                        )}
                      </ExpandableSection>

                      {/* TRADING_DECISIONS Section */}
                      {item.market_snapshot?.trading_decisions && (
                        <ExpandableSection 
                          title="TRADING_DECISIONS" 
                          defaultExpanded={false}
                        >
                          <div className="space-y-2">
                            {item.market_snapshot.trading_decisions.map((decision: any, idx: number) => (
                              <div key={idx} className="rounded border border-border bg-muted/30 p-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-bold text-foreground">{decision.symbol}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      QUANTITY: {decision.quantity}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={cn(
                                      'text-sm font-bold',
                                      decision.action === 'HOLD' && 'text-blue-600',
                                      decision.action === 'BUY' && 'text-green-600',
                                      decision.action === 'SELL' && 'text-red-600'
                                    )}>
                                      {decision.action}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {decision.confidence}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ExpandableSection>
                      )}

                      {/* RECENT_DECISIONS Section */}
                      {item.market_snapshot?.recent_decisions && item.market_snapshot.recent_decisions.length > 0 && (
                        <ExpandableSection
                          title="RECENT_DECISIONS"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2">
                            {item.market_snapshot.recent_decisions.map((decision: any, idx: number) => {
                              const timestamp = new Date(decision.timestamp);
                              return (
                                <div key={idx} className="rounded border border-border bg-muted/30 p-2">
                                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                    {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <div className="text-sm font-bold text-foreground mt-0.5">{decision.decision}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Confidence: {Math.round(decision.confidence)}%
                                  </div>
                                  {decision.reasoning && (
                                    <p className="text-xs text-foreground mt-2 leading-snug">
                                      {decision.reasoning}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ExpandableSection>
                      )}

                      {/* MARKET_REGIME Section */}
                      {item.market_snapshot?.market_regime && (
                        <ExpandableSection
                          title="MARKET_REGIME"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2 text-sm text-foreground">
                            <div className="font-bold">{item.market_snapshot.market_regime.label}</div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.market_snapshot.market_regime.commentary}
                            </p>
                            <div className="space-y-1">
                              {Object.entries(item.market_snapshot.market_regime.metrics || {}).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground uppercase tracking-wide">{key}</span>
                                  <span className="font-mono">{value as any}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </ExpandableSection>
                      )}

                      {/* TECHNICAL_HIGHLIGHTS Section */}
                      {item.market_snapshot?.indicator_highlights && item.market_snapshot.indicator_highlights.length > 0 && (
                        <ExpandableSection
                          title="TECHNICAL_HIGHLIGHTS"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2">
                            {item.market_snapshot.indicator_highlights.map((highlight: any, idx: number) => (
                              <div key={idx} className="rounded border border-border bg-muted/30 p-2">
                                <div className="text-sm font-bold text-foreground">{highlight.symbol}</div>
                                <div className="text-xs text-muted-foreground mt-1 leading-snug">
                                  {highlight.summary}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ExpandableSection>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        Last updated {new Date(data.lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </div>
    </div>
  );
}

/**
 * ExpandableSection Component
 * Nested expandable section within reasoning cards
 */
function ExpandableSection({ 
  title, 
  defaultExpanded = false,
  children 
}: { 
  title: string; 
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <ChevronDown 
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            {title}
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border px-3 py-2.5">
          {children}
        </div>
      )}
    </div>
  );
}
