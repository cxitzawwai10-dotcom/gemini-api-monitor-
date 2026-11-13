import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ErrorCategory,
  KeyHealthStatus,
  UsageRecord,
  ApiKeyAccount,
} from '../types/monitor';
import {
  classifyGeminiApiError,
  computeDashboardSummary,
  maskApiKey,
} from './health';
import {
  calculateUsageCost,
  DEFAULT_PRICING_CATALOG,
  matchModelPricing,
} from './pricing';
import {
  aggregateDailyUsage,
  computeAppTrackedWindowMetrics,
  filterUsageRecords,
} from './filtering';
import {
  createBackupJson,
  generateUsageCsv,
  parseBackupJson,
} from './export';

test('maskApiKey preserves prefix/suffix without exposing full key', () => {
  const original = 'AIzaSyD-TestKey1234567890AbCd';
  const masked = maskApiKey(original);
  assert.notEqual(masked, original);
  assert.ok(masked.startsWith('AIzaSy'));
  assert.ok(masked.endsWith('AbCd'));
  assert.ok(masked.includes('••••'));
});

test('classifyGeminiApiError distinguishes invalid key, quota exceeded, rate limit, permission denied, and network error', () => {
  const invalid = classifyGeminiApiError({
    httpStatus: 400,
    apiStatus: 'INVALID_ARGUMENT',
    apiMessage: 'API key not valid. Please pass a valid API key.',
  });
  assert.equal(invalid.healthStatus, KeyHealthStatus.InvalidKey);
  assert.equal(invalid.errorCategory, ErrorCategory.InvalidApiKey);

  const perm = classifyGeminiApiError({
    httpStatus: 403,
    apiStatus: 'PERMISSION_DENIED',
    apiMessage: 'Generative Language API has not been used in project.',
  });
  assert.equal(perm.healthStatus, KeyHealthStatus.InvalidKey);
  assert.equal(perm.errorCategory, ErrorCategory.PermissionDenied);

  const quota = classifyGeminiApiError({
    httpStatus: 429,
    apiStatus: 'RESOURCE_EXHAUSTED',
    apiMessage: 'You exceeded your current quota, please check your plan and billing details.',
  });
  assert.equal(quota.healthStatus, KeyHealthStatus.QuotaExceeded);
  assert.equal(quota.errorCategory, ErrorCategory.QuotaExceeded);

  const rate = classifyGeminiApiError({
    httpStatus: 429,
    apiStatus: 'RESOURCE_EXHAUSTED',
    apiMessage: 'Rate limit exceeded: too many requests per minute.',
  });
  assert.equal(rate.healthStatus, KeyHealthStatus.RateLimited);
  assert.equal(rate.errorCategory, ErrorCategory.RateLimitExceeded);

  const net = classifyGeminiApiError({ isNetworkFailure: true });
  assert.equal(net.healthStatus, KeyHealthStatus.NetworkError);
  assert.equal(net.errorCategory, ErrorCategory.NetworkError);
});

test('pricing matcher prefers specific pattern (flash-lite over flash) and calculates input/output/thinking cost', () => {
  const liteMatch = matchModelPricing('models/gemini-2.5-flash-lite-preview', DEFAULT_PRICING_CATALOG);
  assert.equal(liteMatch?.modelPattern, 'gemini-2.5-flash-lite');

  const cost = calculateUsageCost(
    {
      modelId: 'gemini-2.5-flash',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      thinkingTokens: 200_000,
    },
    DEFAULT_PRICING_CATALOG
  );
  assert.equal(cost.hasPricingMatch, true);
  assert.ok(Math.abs(cost.inputCostUsd - 0.30) < 1e-9);
  assert.ok(Math.abs(cost.outputCostUsd - 1.25) < 1e-9);
  assert.ok(Math.abs(cost.thinkingCostUsd - 0.50) < 1e-9);
  assert.ok(Math.abs(cost.totalCostUsd - 2.05) < 1e-9);
});

test('filtering and aggregation accurately filter by key, model, and date preset', () => {
  const now = new Date('2026-11-13T12:00:00.000Z');
  const records: UsageRecord[] = [
    {
      id: 'u1',
      accountId: 'acc1',
      accountName: 'Personal',
      modelId: 'gemini-2.5-flash',
      promptTokens: 100,
      inputTokens: 100,
      outputTokens: 50,
      thinkingTokens: 10,
      totalTokens: 160,
      status: 'SUCCESS',
      latencyMs: 300,
      timestamp: '2026-11-13T10:00:00.000Z',
      source: 'APP_GENERATE_CONTENT',
    },
    {
      id: 'u2',
      accountId: 'acc2',
      accountName: 'Work',
      modelId: 'gemini-2.5-pro',
      promptTokens: 200,
      inputTokens: 200,
      outputTokens: 100,
      thinkingTokens: 0,
      totalTokens: 300,
      status: 'SUCCESS',
      latencyMs: 500,
      timestamp: '2026-11-01T10:00:00.000Z',
      source: 'APP_GENERATE_CONTENT',
    },
  ];

  const todayOnly = filterUsageRecords(
    records,
    { accountId: 'ALL', modelId: 'ALL', datePreset: 'today' },
    now
  );
  assert.equal(todayOnly.length, 1);
  assert.equal(todayOnly[0].id, 'u1');

  const byAcc2 = filterUsageRecords(
    records,
    { accountId: 'acc2', modelId: 'ALL', datePreset: '30d' },
    now
  );
  assert.equal(byAcc2.length, 1);
  assert.equal(byAcc2[0].id, 'u2');

  const daily = aggregateDailyUsage(records, DEFAULT_PRICING_CATALOG);
  assert.equal(daily.length, 2);

  const win = computeAppTrackedWindowMetrics(
    records,
    'acc1',
    new Date('2026-11-13T10:00:30.000Z').getTime()
  );
  assert.equal(win.rpmLastMinute, 1);
  assert.equal(win.rpdToday, 1);
});

test('dashboard summary and CSV/JSON export round-trip cleanly', () => {
  const accounts: ApiKeyAccount[] = [
    {
      id: 'acc1',
      accountName: 'Alpha',
      apiKey: 'AIzaSyAlphaKey123456',
      enabled: true,
      status: KeyHealthStatus.Ready,
      discoveredModels: [
        {
          name: 'models/gemini-2.5-flash',
          id: 'gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent'],
          discoveredAt: '2026-11-13T00:00:00.000Z',
        },
      ],
      createdAt: '2026-11-13T00:00:00.000Z',
      updatedAt: '2026-11-13T00:00:00.000Z',
    },
    {
      id: 'acc2',
      accountName: 'Beta',
      apiKey: 'AIzaSyBetaKey123456',
      enabled: true,
      status: KeyHealthStatus.InvalidKey,
      discoveredModels: [],
      createdAt: '2026-11-13T00:00:00.000Z',
      updatedAt: '2026-11-13T00:00:00.000Z',
    },
  ];

  const summary = computeDashboardSummary(accounts, [], DEFAULT_PRICING_CATALOG);
  assert.equal(summary.totalKeys, 2);
  assert.equal(summary.readyKeys, 1);
  assert.equal(summary.errorKeys, 1);
  assert.equal(summary.uniqueAvailableModels, 1);

  const csv = generateUsageCsv(
    [
      {
        id: 'u1',
        accountId: 'acc1',
        accountName: 'Alpha, Inc.',
        modelId: 'gemini-2.5-flash',
        promptTokens: 10,
        inputTokens: 10,
        outputTokens: 20,
        thinkingTokens: 5,
        totalTokens: 35,
        status: 'SUCCESS',
        latencyMs: 120,
        timestamp: '2026-11-13T01:00:00.000Z',
        source: 'APP_GENERATE_CONTENT',
      },
    ],
    DEFAULT_PRICING_CATALOG
  );
  assert.ok(csv.includes('"Alpha, Inc."'));
  assert.ok(csv.includes('gemini-2.5-flash'));

  const json = createBackupJson({
    accounts,
    usageLogs: [],
    errorLogs: [],
    pricingCatalog: DEFAULT_PRICING_CATALOG,
    quotaReferences: [],
  });
  const parsed = parseBackupJson(json);
  assert.equal(parsed.accounts.length, 2);
  assert.equal(parsed.accounts[0].apiKey, 'AIzaSyAlphaKey123456');
});
