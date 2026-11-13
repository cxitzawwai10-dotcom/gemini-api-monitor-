export enum PageId {
  Dashboard = 'dashboard',
  ApiKeys = 'api-keys',
  Models = 'models',
  QuotaMonitor = 'quota-monitor',
  TokenUsage = 'token-usage',
  Settings = 'settings',
}

export enum KeyHealthStatus {
  Ready = 'READY',
  InvalidKey = 'INVALID_KEY',
  QuotaExceeded = 'QUOTA_EXCEEDED',
  RateLimited = 'RATE_LIMITED',
  NetworkError = 'NETWORK_ERROR',
  NotChecked = 'NOT_CHECKED',
}

export enum ErrorCategory {
  InvalidApiKey = 'Invalid API key',
  PermissionDenied = 'Permission denied',
  ModelNotFound = 'Model not found',
  QuotaExceeded = 'Quota exceeded',
  RateLimitExceeded = 'Rate limit exceeded',
  NetworkError = 'Network error',
  ApiServiceError = 'API service error',
}

export interface DiscoveredModel {
  name: string; // e.g. "models/gemini-2.5-flash"
  id: string; // e.g. "gemini-2.5-flash"
  displayName: string;
  description?: string;
  version?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTemperature?: number;
  discoveredAt: string;
}

export interface KeyErrorInfo {
  category: ErrorCategory;
  httpStatus?: number;
  apiStatus?: string;
  message: string;
  timestamp: string;
  endpoint: string;
  modelId?: string;
}

export interface ApiKeyAccount {
  id: string;
  accountName: string;
  googleAccountLabel?: string;
  projectLabel?: string;
  apiKey: string;
  enabled: boolean;
  status: KeyHealthStatus;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  latestError?: KeyErrorInfo;
  discoveredModels: DiscoveredModel[];
  modelDiscoveryError?: string;
  modelsUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  accountId: string;
  accountName: string;
  modelId: string;
  promptTokens: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  status: 'SUCCESS' | 'ERROR';
  httpStatus?: number;
  errorMessage?: string;
  latencyMs: number;
  timestamp: string;
  source: 'APP_GENERATE_CONTENT';
  promptPreview?: string;
}

export interface ApiErrorRecord {
  id: string;
  accountId: string;
  accountName: string;
  modelId?: string;
  category: ErrorCategory;
  httpStatus?: number;
  apiStatus?: string;
  message: string;
  endpoint: string;
  timestamp: string;
}

export interface ModelPricing {
  id: string;
  modelPattern: string;
  displayName: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  thinkingPerMillionUsd?: number;
  notes?: string;
  updatedAt: string;
}

export interface QuotaReferenceLimit {
  id: string;
  accountId: string;
  tierName: string;
  rpmLimit?: number;
  tpmLimit?: number;
  rpdLimit?: number;
  updatedAt: string;
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  thinkingCostUsd: number;
  totalCostUsd: number;
  matchedPricingId?: string;
  matchedModelPattern?: string;
  hasPricingMatch: boolean;
}

export type DateFilterPreset = 'today' | '7d' | '30d' | 'custom' | 'all';

export interface UsageFilters {
  accountId: string; // 'ALL' or accountId
  modelId: string; // 'ALL' or modelId
  datePreset: DateFilterPreset;
  customStart?: string; // YYYY-MM-DD
  customEnd?: string; // YYYY-MM-DD
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  app: 'GeminiPulse';
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  errorLogs: ApiErrorRecord[];
  pricingCatalog: ModelPricing[];
  quotaReferences: QuotaReferenceLimit[];
}
