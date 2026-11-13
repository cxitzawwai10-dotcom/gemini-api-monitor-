import {
  ApiErrorRecord,
  ApiKeyAccount,
  ErrorCategory,
  KeyErrorInfo,
  KeyHealthStatus,
  UsageRecord,
} from '../types/monitor';
import { calculateUsageCost, ModelPricing } from './pricing';

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return '••••••••';
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 6)}••••••••••••${trimmed.slice(-4)}`;
}

export interface ClassifiedApiFailure {
  healthStatus: KeyHealthStatus;
  errorCategory: ErrorCategory;
  httpStatus?: number;
  apiStatus?: string;
  message: string;
}

export function classifyGeminiApiError(params: {
  httpStatus?: number;
  apiStatus?: string;
  apiMessage?: string;
  isNetworkFailure?: boolean;
}): ClassifiedApiFailure {
  const { httpStatus, apiStatus, apiMessage, isNetworkFailure } = params;
  const rawMessage = (apiMessage || '').trim();
  const normalizedMsg = rawMessage.toLowerCase();
  const normalizedStatus = (apiStatus || '').toUpperCase();

  if (isNetworkFailure || !httpStatus) {
    return {
      healthStatus: KeyHealthStatus.NetworkError,
      errorCategory: ErrorCategory.NetworkError,
      httpStatus,
      apiStatus,
      message:
        rawMessage ||
        'Network error: Unable to reach generativelanguage.googleapis.com. Check your internet connection.',
    };
  }

  // Invalid API key / authentication failure
  if (
    httpStatus === 400 &&
    (normalizedMsg.includes('api key not valid') ||
      normalizedMsg.includes('api_key_invalid') ||
      normalizedMsg.includes('invalid api key') ||
      normalizedStatus === 'INVALID_ARGUMENT')
  ) {
    return {
      healthStatus: KeyHealthStatus.InvalidKey,
      errorCategory: ErrorCategory.InvalidApiKey,
      httpStatus,
      apiStatus: apiStatus || 'API_KEY_INVALID',
      message: rawMessage || 'API key not valid. Please verify the key string.',
    };
  }

  if (httpStatus === 401 || httpStatus === 403) {
    const isInvalidKey =
      normalizedMsg.includes('api key') ||
      normalizedMsg.includes('unregistered callers') ||
      normalizedMsg.includes('credentials');
    return {
      healthStatus: KeyHealthStatus.InvalidKey,
      errorCategory: isInvalidKey
        ? ErrorCategory.InvalidApiKey
        : ErrorCategory.PermissionDenied,
      httpStatus,
      apiStatus: apiStatus || 'PERMISSION_DENIED',
      message:
        rawMessage ||
        (isInvalidKey
          ? 'API key authentication failed.'
          : 'Permission denied for this API key or Google Cloud project.'),
    };
  }

  if (httpStatus === 404 || normalizedStatus === 'NOT_FOUND') {
    return {
      healthStatus: KeyHealthStatus.InvalidKey,
      errorCategory: ErrorCategory.ModelNotFound,
      httpStatus,
      apiStatus: apiStatus || 'NOT_FOUND',
      message: rawMessage || 'Requested model or endpoint was not found.',
    };
  }

  // 429 can mean Quota Exceeded OR Rate Limit Exceeded
  if (httpStatus === 429 || normalizedStatus === 'RESOURCE_EXHAUSTED') {
    const isRateLimit =
      normalizedMsg.includes('rate limit') ||
      normalizedMsg.includes('requests per minute') ||
      normalizedMsg.includes('too many requests') ||
      normalizedMsg.includes('rpm');
    const isQuota =
      normalizedMsg.includes('quota') ||
      normalizedMsg.includes('billing') ||
      normalizedMsg.includes('exceeded your current quota') ||
      normalizedMsg.includes('daily');

    if (isRateLimit && !isQuota) {
      return {
        healthStatus: KeyHealthStatus.RateLimited,
        errorCategory: ErrorCategory.RateLimitExceeded,
        httpStatus,
        apiStatus: apiStatus || 'RESOURCE_EXHAUSTED',
        message: rawMessage || 'Rate limit exceeded. Too many requests in a short period.',
      };
    }

    return {
      healthStatus: KeyHealthStatus.QuotaExceeded,
      errorCategory: ErrorCategory.QuotaExceeded,
      httpStatus,
      apiStatus: apiStatus || 'RESOURCE_EXHAUSTED',
      message: rawMessage || 'API quota exceeded for this key or project.',
    };
  }

  if (httpStatus >= 500) {
    return {
      healthStatus: KeyHealthStatus.NetworkError,
      errorCategory: ErrorCategory.ApiServiceError,
      httpStatus,
      apiStatus: apiStatus || 'INTERNAL',
      message: rawMessage || `Gemini API service error (HTTP ${httpStatus}).`,
    };
  }

  return {
    healthStatus: KeyHealthStatus.InvalidKey,
    errorCategory: ErrorCategory.ApiServiceError,
    httpStatus,
    apiStatus,
    message: rawMessage || `Unexpected API error (HTTP ${httpStatus}).`,
  };
}

export function isErrorHealthStatus(status: KeyHealthStatus): boolean {
  return (
    status === KeyHealthStatus.InvalidKey ||
    status === KeyHealthStatus.QuotaExceeded ||
    status === KeyHealthStatus.RateLimited ||
    status === KeyHealthStatus.NetworkError
  );
}

export interface DashboardSummary {
  totalKeys: number;
  enabledKeys: number;
  readyKeys: number;
  errorKeys: number;
  notCheckedKeys: number;
  uniqueAvailableModels: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  totalTokens: number;
  estimatedTotalCostUsd: number;
}

export function computeDashboardSummary(
  accounts: ApiKeyAccount[],
  usageLogs: UsageRecord[],
  pricingCatalog: ModelPricing[]
): DashboardSummary {
  const readyKeys = accounts.filter((a) => a.status === KeyHealthStatus.Ready).length;
  const errorKeys = accounts.filter((a) => isErrorHealthStatus(a.status)).length;
  const notCheckedKeys = accounts.filter(
    (a) => a.status === KeyHealthStatus.NotChecked
  ).length;

  const modelSet = new Set<string>();
  for (const acc of accounts) {
    if (acc.status === KeyHealthStatus.Ready || acc.discoveredModels.length > 0) {
      for (const m of acc.discoveredModels) {
        modelSet.add(m.id);
      }
    }
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalThinkingTokens = 0;
  let totalTokens = 0;
  let estimatedTotalCostUsd = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  for (const log of usageLogs) {
    if (log.status === 'SUCCESS') {
      successfulRequests += 1;
    } else {
      failedRequests += 1;
    }
    totalInputTokens += log.inputTokens;
    totalOutputTokens += log.outputTokens;
    totalThinkingTokens += log.thinkingTokens;
    totalTokens += log.totalTokens;

    const cost = calculateUsageCost(log, pricingCatalog);
    estimatedTotalCostUsd += cost.totalCostUsd;
  }

  return {
    totalKeys: accounts.length,
    enabledKeys: accounts.filter((a) => a.enabled).length,
    readyKeys,
    errorKeys,
    notCheckedKeys,
    uniqueAvailableModels: modelSet.size,
    totalRequests: usageLogs.length,
    successfulRequests,
    failedRequests,
    totalInputTokens,
    totalOutputTokens,
    totalThinkingTokens,
    totalTokens,
    estimatedTotalCostUsd,
  };
}

export function buildErrorRecord(
  account: Pick<ApiKeyAccount, 'id' | 'accountName'>,
  info: KeyErrorInfo
): ApiErrorRecord {
  return {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: account.id,
    accountName: account.accountName,
    modelId: info.modelId,
    category: info.category,
    httpStatus: info.httpStatus,
    apiStatus: info.apiStatus,
    message: info.message,
    endpoint: info.endpoint,
    timestamp: info.timestamp,
  };
}

export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}
