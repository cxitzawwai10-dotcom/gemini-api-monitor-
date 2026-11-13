import { CostBreakdown, ModelPricing, UsageRecord } from '../types/monitor';

export type { ModelPricing };

const DEFAULT_UPDATED_AT = '2026-11-01T00:00:00.000Z';

/**
 * Editable reference pricing catalog (USD per 1M tokens).
 * Users can modify, add, or reset rates directly in the Cost Monitor UI.
 * Clearly labeled as estimated pricing, separate from actual Google Cloud billing.
 */
export const DEFAULT_PRICING_CATALOG: ModelPricing[] = [
  {
    id: 'price_gemini_4_hydrogen',
    modelPattern: 'gemini-4-hydrogen',
    displayName: 'Gemini 4 Hydrogen (Flash)',
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.60,
    thinkingPerMillionUsd: 0.60,
    notes: 'Reference rate per 1M tokens (editable)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_4_argon',
    modelPattern: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon (Pro)',
    inputPerMillionUsd: 1.25,
    outputPerMillionUsd: 5.00,
    thinkingPerMillionUsd: 5.00,
    notes: 'Reference rate per 1M tokens (editable)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_4_carbon',
    modelPattern: 'gemini-4-carbon',
    displayName: 'Gemini 4 Carbon',
    inputPerMillionUsd: 2.50,
    outputPerMillionUsd: 10.00,
    thinkingPerMillionUsd: 10.00,
    notes: 'Reference rate per 1M tokens (editable)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_3_1_flash_lite',
    modelPattern: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    inputPerMillionUsd: 0.075,
    outputPerMillionUsd: 0.30,
    thinkingPerMillionUsd: 0.30,
    notes: 'Reference rate per 1M tokens (editable)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_2_5_flash_lite',
    modelPattern: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    inputPerMillionUsd: 0.10,
    outputPerMillionUsd: 0.40,
    thinkingPerMillionUsd: 0.40,
    notes: 'Official standard tier reference ($0.10 in / $0.40 out per 1M)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_2_5_flash',
    modelPattern: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    inputPerMillionUsd: 0.30,
    outputPerMillionUsd: 2.50,
    thinkingPerMillionUsd: 2.50,
    notes: 'Official standard tier reference ($0.30 in / $2.50 out per 1M)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_2_5_pro',
    modelPattern: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    inputPerMillionUsd: 1.25,
    outputPerMillionUsd: 10.00,
    thinkingPerMillionUsd: 10.00,
    notes: 'Official standard tier reference <=200k ($1.25 in / $10.00 out per 1M)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_2_0_flash_lite',
    modelPattern: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash-Lite',
    inputPerMillionUsd: 0.075,
    outputPerMillionUsd: 0.30,
    notes: 'Reference rate per 1M tokens (editable)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_2_0_flash',
    modelPattern: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    inputPerMillionUsd: 0.10,
    outputPerMillionUsd: 0.40,
    notes: 'Reference rate per 1M tokens (editable)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: 'price_gemini_embedding',
    modelPattern: 'embedding',
    displayName: 'Gemini Embedding Models',
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.0,
    notes: 'Input-only embedding reference rate (editable)',
    updatedAt: DEFAULT_UPDATED_AT,
  },
];

export function matchModelPricing(
  modelId: string,
  catalog: ModelPricing[]
): ModelPricing | undefined {
  const cleanId = modelId.replace(/^models\//, '').toLowerCase();
  // Exact match first
  const exact = catalog.find(
    (entry) => entry.modelPattern.toLowerCase() === cleanId
  );
  if (exact) return exact;

  // Longest prefix / substring match so "gemini-2.5-flash-lite" beats "gemini-2.5-flash"
  const sorted = [...catalog].sort(
    (a, b) => b.modelPattern.length - a.modelPattern.length
  );
  return sorted.find((entry) =>
    cleanId.includes(entry.modelPattern.toLowerCase())
  );
}

export function calculateUsageCost(
  record: Pick<UsageRecord, 'modelId' | 'inputTokens' | 'outputTokens' | 'thinkingTokens'>,
  catalog: ModelPricing[]
): CostBreakdown {
  const pricing = matchModelPricing(record.modelId, catalog);
  if (!pricing) {
    return {
      inputCostUsd: 0,
      outputCostUsd: 0,
      thinkingCostUsd: 0,
      totalCostUsd: 0,
      hasPricingMatch: false,
    };
  }

  const inputCostUsd = (record.inputTokens / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCostUsd = (record.outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  const thinkingRate =
    pricing.thinkingPerMillionUsd !== undefined
      ? pricing.thinkingPerMillionUsd
      : pricing.outputPerMillionUsd;
  const thinkingCostUsd = (record.thinkingTokens / 1_000_000) * thinkingRate;

  return {
    inputCostUsd,
    outputCostUsd,
    thinkingCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd + thinkingCostUsd,
    matchedPricingId: pricing.id,
    matchedModelPattern: pricing.modelPattern,
    hasPricingMatch: true,
  };
}

export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.0001) return `$${amount.toFixed(6)}`;
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
