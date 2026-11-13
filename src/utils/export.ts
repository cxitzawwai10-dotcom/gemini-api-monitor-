import {
  ApiErrorRecord,
  ApiKeyAccount,
  BackupPayload,
  ModelPricing,
  QuotaReferenceLimit,
  UsageRecord,
} from '../types/monitor';
import { calculateUsageCost } from './pricing';

function escapeCsvCell(value: string | number | undefined): string {
  const str = value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateUsageCsv(
  records: UsageRecord[],
  pricingCatalog: ModelPricing[]
): string {
  const headers = [
    'Timestamp',
    'Account Name',
    'Account ID',
    'Model ID',
    'Status',
    'HTTP Status',
    'Prompt Tokens',
    'Input Tokens',
    'Output Tokens',
    'Thinking Tokens',
    'Total Tokens',
    'Estimated Input Cost (USD)',
    'Estimated Output Cost (USD)',
    'Estimated Thinking Cost (USD)',
    'Estimated Total Cost (USD)',
    'Latency (ms)',
    'Source',
  ];

  const rows = records.map((r) => {
    const cost = calculateUsageCost(r, pricingCatalog);
    return [
      r.timestamp,
      r.accountName,
      r.accountId,
      r.modelId,
      r.status,
      r.httpStatus ?? '',
      r.promptTokens,
      r.inputTokens,
      r.outputTokens,
      r.thinkingTokens,
      r.totalTokens,
      cost.inputCostUsd.toFixed(6),
      cost.outputCostUsd.toFixed(6),
      cost.thinkingCostUsd.toFixed(6),
      cost.totalCostUsd.toFixed(6),
      r.latencyMs,
      r.source,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function createBackupJson(params: {
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  errorLogs: ApiErrorRecord[];
  pricingCatalog: ModelPricing[];
  quotaReferences: QuotaReferenceLimit[];
}): string {
  const payload: BackupPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'GeminiPulse',
    accounts: params.accounts,
    usageLogs: params.usageLogs,
    errorLogs: params.errorLogs,
    pricingCatalog: params.pricingCatalog,
    quotaReferences: params.quotaReferences,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseBackupJson(rawJson: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file. Could not parse backup contents.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup JSON must be an object.');
  }

  const obj = parsed as Partial<BackupPayload>;
  if (obj.app !== 'GeminiPulse' || !Array.isArray(obj.accounts)) {
    throw new Error(
      'Unrecognized backup format. Expected a GeminiPulse export file with an accounts array.'
    );
  }

  for (const acc of obj.accounts) {
    if (
      !acc ||
      typeof acc.id !== 'string' ||
      typeof acc.accountName !== 'string' ||
      typeof acc.apiKey !== 'string'
    ) {
      throw new Error('Backup contains malformed API key account entries.');
    }
  }

  return {
    schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1,
    exportedAt:
      typeof obj.exportedAt === 'string'
        ? obj.exportedAt
        : new Date().toISOString(),
    app: 'GeminiPulse',
    accounts: obj.accounts,
    usageLogs: Array.isArray(obj.usageLogs) ? obj.usageLogs : [],
    errorLogs: Array.isArray(obj.errorLogs) ? obj.errorLogs : [],
    pricingCatalog: Array.isArray(obj.pricingCatalog) ? obj.pricingCatalog : [],
    quotaReferences: Array.isArray(obj.quotaReferences)
      ? obj.quotaReferences
      : [],
  };
}
