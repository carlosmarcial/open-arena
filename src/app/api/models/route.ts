/**
 * GET /api/models
 * Returns the list of AI models for filtering
 */

import { NextResponse } from 'next/server';
import { supabase, Model } from '@/lib/supabase';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

// Color override map - ensures correct brand colors
const COLOR_OVERRIDES: Record<string, string> = {
  'Claude Sonnet 4.5': '#f97316',       // Orange
  'GPT 5': '#10b981',                   // Emerald green
  'Mistral Medium 3.1': '#0ea5e9',          // Ocean blue
  'Grok 4': '#06b6d4',                  // Cyan
  'DeepSeek Chat V3.1': '#3b82f6',      // Blue
  'Qwen3 Max': '#8b5cf6',               // Purple
};

export async function GET() {
  try {
    const { data: models, error } = await supabase
      .from('models')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching models:', error);
      return NextResponse.json(
        { error: 'Failed to fetch models data' },
        { status: 500 }
      );
    }

    const normalizedModels = models?.map((model) => applyModelUIOverrides(model)) || [];

    // Apply color overrides
    const modelsWithCorrectColors = normalizedModels.map(model => ({
      ...model,
      color: COLOR_OVERRIDES[model.name] || model.color
    }));

    return NextResponse.json({
      models: modelsWithCorrectColors as Model[],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in models API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
