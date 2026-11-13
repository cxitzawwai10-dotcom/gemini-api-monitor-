import { ModelPricing, UsageFilters, UsageRecord } from '../types/monitor';
import { calculateUsageCost } from './pricing';

export function filterUsageRecords(
  records: UsageRecord[],
  filters: UsageFilters,
  now: Date = new Date()
): UsageRecord[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  return records.filter((record) => {
    if (filters.accountId !== 'ALL' && record.accountId !== filters.accountId) {
      return false;
    }
    if (filters.modelId !== 'ALL' && record.modelId !== filters.modelId) {
      return false;
    }

    const recDate = new Date(record.timestamp);
    if (Number.isNaN(recDate.getTime())) return false;

    if (filters.datePreset === 'today') {
      return recDate >= startOfToday;
    }

    if (filters.datePreset === '7d') {
      const cutoff = new Date(startOfToday);
      cutoff.setDate(cutoff.getDate() - 6);
      return recDate >= cutoff;
    }

    if (filters.datePreset === '30d') {
      const cutoff = new Date(startOfToday);
      cutoff.setDate(cutoff.getDate() - 29);
      return recDate >= cutoff;
    }

    if (filters.datePreset === 'custom') {
      if (filters.customStart) {
        const start = new Date(`${filters.customStart}T00:00:00`);
        if (recDate < start) return false;
      }
      if (filters.customEnd) {
        const end = new Date(`${filters.customEnd}T23:59:59.999`);
        if (recDate > end) return false;
      }
    }

    return true;
  });
}

export interface DailySeriesPoint {
  dateKey: string; // YYYY-MM-DD
  label: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  requests: number;
  costUsd: number;
}

export function aggregateDailyUsage(
  records: UsageRecord[],
  pricingCatalog: ModelPricing[]
): DailySeriesPoint[] {
  const map = new Map<string, DailySeriesPoint>();

  for (const r of records) {
    const d = new Date(r.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const existing = map.get(dateKey) || {
      dateKey,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
      requests: 0,
      costUsd: 0,
    };

    const cost = calculateUsageCost(r, pricingCatalog);
    existing.inputTokens += r.inputTokens;
    existing.outputTokens += r.outputTokens;
    existing.thinkingTokens += r.thinkingTokens;
    existing.totalTokens += r.totalTokens;
    existing.requests += 1;
    existing.costUsd += cost.totalCostUsd;
    map.set(dateKey, existing);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );
}

export interface GroupedCostSummary {
  key: string;
  label: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  thinkingCostUsd: number;
  totalCostUsd: number;
}

export function groupUsageByAccount(
  records: UsageRecord[],
  pricingCatalog: ModelPricing[]
): GroupedCostSummary[] {
  const map = new Map<string, GroupedCostSummary>();
  for (const r of records) {
    const cost = calculateUsageCost(r, pricingCatalog);
    const existing = map.get(r.accountId) || {
      key: r.accountId,
      label: r.accountName,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
      inputCostUsd: 0,
      outputCostUsd: 0,
      thinkingCostUsd: 0,
      totalCostUsd: 0,
    };
    existing.requests += 1;
    existing.inputTokens += r.inputTokens;
    existing.outputTokens += r.outputTokens;
    existing.thinkingTokens += r.thinkingTokens;
    existing.totalTokens += r.totalTokens;
    existing.inputCostUsd += cost.inputCostUsd;
    existing.outputCostUsd += cost.outputCostUsd;
    existing.thinkingCostUsd += cost.thinkingCostUsd;
    existing.totalCostUsd += cost.totalCostUsd;
    map.set(r.accountId, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens);
}

export function groupUsageByModel(
  records: UsageRecord[],
  pricingCatalog: ModelPricing[]
): GroupedCostSummary[] {
  const map = new Map<string, GroupedCostSummary>();
  for (const r of records) {
    const cost = calculateUsageCost(r, pricingCatalog);
    const existing = map.get(r.modelId) || {
      key: r.modelId,
      label: r.modelId,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
      inputCostUsd: 0,
      outputCostUsd: 0,
      thinkingCostUsd: 0,
      totalCostUsd: 0,
    };
    existing.requests += 1;
    existing.inputTokens += r.inputTokens;
    existing.outputTokens += r.outputTokens;
    existing.thinkingTokens += r.thinkingTokens;
    existing.totalTokens += r.totalTokens;
    existing.inputCostUsd += cost.inputCostUsd;
    existing.outputCostUsd += cost.outputCostUsd;
    existing.thinkingCostUsd += cost.thinkingCostUsd;
    existing.totalCostUsd += cost.totalCostUsd;
    map.set(r.modelId, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens);
}

export function computeAppTrackedWindowMetrics(
  records: UsageRecord[],
  accountId?: string,
  nowMs: number = Date.now()
): {
  rpmLastMinute: number;
  tpmLastMinute: number;
  rpdToday: number;
  inputTokensToday: number;
  outputTokensToday: number;
} {
  const oneMinuteAgo = nowMs - 60_000;
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  let rpmLastMinute = 0;
  let tpmLastMinute = 0;
  let rpdToday = 0;
  let inputTokensToday = 0;
  let outputTokensToday = 0;

  for (const r of records) {
    if (accountId && r.accountId !== accountId) continue;
    const t = new Date(r.timestamp).getTime();
    if (Number.isNaN(t)) continue;

    if (t >= oneMinuteAgo && t <= nowMs) {
      rpmLastMinute += 1;
      tpmLastMinute += r.totalTokens;
    }
    if (t >= startOfTodayMs && t <= nowMs) {
      rpdToday += 1;
      inputTokensToday += r.inputTokens;
      outputTokensToday += r.outputTokens;
    }
  }

  return {
    rpmLastMinute,
    tpmLastMinute,
    rpdToday,
    inputTokensToday,
    outputTokensToday,
  };
}
