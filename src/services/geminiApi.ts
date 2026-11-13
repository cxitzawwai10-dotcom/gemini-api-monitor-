import {
  DiscoveredModel,
  KeyErrorInfo,
  KeyHealthStatus,
} from '../types/monitor';
import { classifyGeminiApiError } from '../utils/health';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface RawGeminiModel {
  name?: string;
  baseModelId?: string;
  version?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTemperature?: number;
}

interface RawModelsListResponse {
  models?: RawGeminiModel[];
  nextPageToken?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export interface ModelsCheckResult {
  ok: boolean;
  status: KeyHealthStatus;
  models: DiscoveredModel[];
  errorInfo?: KeyErrorInfo;
  checkedAt: string;
  latencyMs: number;
}

/**
 * Lightweight connectivity, authentication, and model discovery check using the
 * official Gemini API Models List endpoint. Never calls generateContent and
 * never consumes generation tokens.
 */
export async function checkKeyAndDiscoverModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<ModelsCheckResult> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();
  const trimmedKey = apiKey.trim();
  const endpoint = `${GEMINI_API_BASE}/models`;

  if (!trimmedKey) {
    const classified = classifyGeminiApiError({
      httpStatus: 400,
      apiStatus: 'INVALID_ARGUMENT',
      apiMessage: 'API key is empty.',
    });
    return {
      ok: false,
      status: classified.healthStatus,
      models: [],
      errorInfo: {
        category: classified.errorCategory,
        httpStatus: 400,
        apiStatus: classified.apiStatus,
        message: classified.message,
        timestamp: checkedAt,
        endpoint,
      },
      checkedAt,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }

  try {
    const allModels: DiscoveredModel[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      const url = new URL(endpoint);
      url.searchParams.set('pageSize', '100');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-goog-api-key': trimmedKey,
        },
        signal,
      });

      let payload: RawModelsListResponse = {};
      try {
        payload = (await response.json()) as RawModelsListResponse;
      } catch {
        // Response body may be empty or non-JSON on gateway failures
      }

      if (!response.ok) {
        const classified = classifyGeminiApiError({
          httpStatus: response.status,
          apiStatus: payload.error?.status,
          apiMessage:
            payload.error?.message ||
            `HTTP ${response.status} ${response.statusText}`,
        });

        return {
          ok: false,
          status: classified.healthStatus,
          models: [],
          errorInfo: {
            category: classified.errorCategory,
            httpStatus: response.status,
            apiStatus: classified.apiStatus,
            message: classified.message,
            timestamp: checkedAt,
            endpoint,
          },
          checkedAt,
          latencyMs: Math.round(performance.now() - startedAt),
        };
      }

      const discovered = (payload.models || []).map((m): DiscoveredModel => {
        const fullName = m.name || '';
        const id = fullName.replace(/^models\//, '') || m.baseModelId || 'unknown';
        return {
          name: fullName || `models/${id}`,
          id,
          displayName: m.displayName || id,
          description: m.description,
          version: m.version,
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
          supportedGenerationMethods: Array.isArray(m.supportedGenerationMethods)
            ? m.supportedGenerationMethods
            : [],
          temperature: m.temperature,
          topP: m.topP,
          topK: m.topK,
          maxTemperature: m.maxTemperature,
          discoveredAt: checkedAt,
        };
      });

      allModels.push(...discovered);
      pageToken = payload.nextPageToken;
      pageCount += 1;
    } while (pageToken && pageCount < 5);

    allModels.sort((a, b) => a.id.localeCompare(b.id));

    return {
      ok: true,
      status: KeyHealthStatus.Ready,
      models: allModels,
      checkedAt,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (err) {
    const isAborted = err instanceof DOMException && err.name === 'AbortError';
    const message = isAborted
      ? 'Health check request was cancelled.'
      : err instanceof Error
      ? `Network error: ${err.message}`
      : 'Network error while connecting to Gemini API.';

    const classified = classifyGeminiApiError({
      isNetworkFailure: true,
      apiMessage: message,
    });

    return {
      ok: false,
      status: classified.healthStatus,
      models: [],
      errorInfo: {
        category: classified.errorCategory,
        message: classified.message,
        timestamp: checkedAt,
        endpoint,
      },
      checkedAt,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}

interface RawGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export interface GenerateTestResult {
  ok: boolean;
  text: string;
  promptTokens: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  httpStatus?: number;
  errorInfo?: KeyErrorInfo;
  latencyMs: number;
  timestamp: string;
}

/**
 * Executes an explicit user-triggered GenerateContent request against a specific
 * discovered model and captures real usageMetadata from the API response.
 */
export async function runGenerateContentTest(params: {
  apiKey: string;
  modelId: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<GenerateTestResult> {
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();
  const cleanModelId = params.modelId.replace(/^models\//, '');
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(cleanModelId)}:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': params.apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: params.prompt }],
          },
        ],
      }),
      signal: params.signal,
    });

    let payload: RawGenerateContentResponse = {};
    try {
      payload = (await response.json()) as RawGenerateContentResponse;
    } catch {
      // Non-JSON response
    }

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const classified = classifyGeminiApiError({
        httpStatus: response.status,
        apiStatus: payload.error?.status,
        apiMessage:
          payload.error?.message ||
          `HTTP ${response.status} ${response.statusText}`,
      });

      return {
        ok: false,
        text: '',
        promptTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
        httpStatus: response.status,
        errorInfo: {
          category: classified.errorCategory,
          httpStatus: response.status,
          apiStatus: classified.apiStatus,
          message: classified.message,
          timestamp,
          endpoint,
          modelId: cleanModelId,
        },
        latencyMs,
        timestamp,
      };
    }

    const meta = payload.usageMetadata || {};
    const promptTokens = meta.promptTokenCount ?? 0;
    const inputTokens = meta.promptTokenCount ?? 0;
    const outputTokens = meta.candidatesTokenCount ?? 0;
    const thinkingTokens = meta.thoughtsTokenCount ?? 0;
    const totalTokens =
      meta.totalTokenCount ?? inputTokens + outputTokens + thinkingTokens;

    const textParts =
      payload.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || '')
        .filter(Boolean) || [];

    return {
      ok: true,
      text: textParts.join('\n').trim() || '(Empty text response)',
      promptTokens,
      inputTokens,
      outputTokens,
      thinkingTokens,
      totalTokens,
      httpStatus: response.status,
      latencyMs,
      timestamp,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const classified = classifyGeminiApiError({
      isNetworkFailure: true,
      apiMessage:
        err instanceof Error
          ? `Network error: ${err.message}`
          : 'Network error during generateContent request.',
    });

    return {
      ok: false,
      text: '',
      promptTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
      errorInfo: {
        category: classified.errorCategory,
        message: classified.message,
        timestamp,
        endpoint,
        modelId: cleanModelId,
      },
      latencyMs,
      timestamp,
    };
  }
}
