import {
  DiscoveredModel,
  KeyErrorInfo,
  KeyHealthStatus,
} from '../types/monitor';
import { classifyGeminiApiError } from '../utils/health';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const REQUEST_TIMEOUT_MS = 20_000;
const GENERATION_TIMEOUT_MS = 120_000;
const MAX_MODEL_PAGES = 100;

function createTimedRequestSignal(
  parentSignal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}

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

  const timedRequest = createTimedRequestSignal(signal);
  try {
    const allModels: DiscoveredModel[] = [];
    const seenPageTokens = new Set<string>();
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
        signal: timedRequest.signal,
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
      if (pageToken) {
        if (seenPageTokens.has(pageToken)) {
          throw new Error('Gemini API repeated a model page token; discovery stopped to avoid an endless loop.');
        }
        seenPageTokens.add(pageToken);
      }
    } while (pageToken && pageCount < MAX_MODEL_PAGES);

    if (pageToken && pageCount >= MAX_MODEL_PAGES) {
      throw new Error(`Model discovery reached the safety limit of ${MAX_MODEL_PAGES} pages. Please refresh to continue.`);
    }

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
    const message = timedRequest.didTimeout()
      ? `Health check timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
      : isAborted
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
  } finally {
    timedRequest.cleanup();
  }
}

interface RawInteractionResponse {
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
    total_tokens?: number;
  };
  error?: { code?: number; message?: string; status?: string };
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
 * Runs a stateless Interactions API request. Used when a model/API response
 * explicitly reports that GenerateContent is not supported.
 */
async function runInteractionsTest(params: {
  apiKey: string;
  modelId: string;
  prompt: string;
}): Promise<GenerateTestResult> {
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();
  const cleanModelId = params.modelId.replace(/^models\\//, '');
  const endpoint = `${GEMINI_API_BASE}/interactions`;
  const timedRequest = createTimedRequestSignal(undefined, GENERATION_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': params.apiKey.trim(),
      },
      body: JSON.stringify({ model: cleanModelId, input: params.prompt, store: false }),
      signal: timedRequest.signal,
    });

    let payload: RawInteractionResponse = {};
    try {
      payload = (await response.json()) as RawInteractionResponse;
    } catch {
      // Preserve the HTTP status when a gateway returns a non-JSON body.
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      const classified = classifyGeminiApiError({
        httpStatus: response.status,
        apiStatus: payload.error?.status,
        apiMessage: payload.error?.message || `HTTP ${response.status} ${response.statusText}`,
      });
      return {
        ok: false, text: '', promptTokens: 0, inputTokens: 0, outputTokens: 0,
        thinkingTokens: 0, totalTokens: 0, httpStatus: response.status,
        errorInfo: {
          category: classified.errorCategory, httpStatus: response.status,
          apiStatus: classified.apiStatus, message: classified.message,
          timestamp, endpoint, modelId: cleanModelId,
        }, latencyMs, timestamp,
      };
    }

    const usage = payload.usage || {};
    const inputTokens = usage.total_input_tokens ?? 0;
    const outputTokens = usage.total_output_tokens ?? 0;
    const thinkingTokens = usage.total_thought_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? inputTokens + outputTokens + thinkingTokens;
    const text = (payload.steps || [])
      .filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content || [])
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text || '')
      .join('\\n')
      .trim();

    return {
      ok: true, text: text || '(Empty text response)', promptTokens: inputTokens,
      inputTokens, outputTokens, thinkingTokens, totalTokens,
      httpStatus: response.status, latencyMs, timestamp,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const message = timedRequest.didTimeout()
      ? `Generation request timed out after ${GENERATION_TIMEOUT_MS / 1000} seconds.`
      : err instanceof Error ? `Network error: ${err.message}` : 'Network error during Interactions request.';
    const classified = classifyGeminiApiError({ isNetworkFailure: true, apiMessage: message });
    return {
      ok: false, text: '', promptTokens: 0, inputTokens: 0, outputTokens: 0,
      thinkingTokens: 0, totalTokens: 0,
      errorInfo: {
        category: classified.errorCategory, message: classified.message,
        timestamp, endpoint, modelId: cleanModelId,
      }, latencyMs, timestamp,
    };
  } finally {
    timedRequest.cleanup();
  }
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

  const timedRequest = createTimedRequestSignal(params.signal, GENERATION_TIMEOUT_MS);
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
      signal: timedRequest.signal,
    });

    let payload: RawGenerateContentResponse = {};
    try {
      payload = (await response.json()) as RawGenerateContentResponse;
    } catch {
      // Non-JSON response
    }

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const apiMessage = payload.error?.message || `HTTP ${response.status} ${response.statusText}`;
      if (response.status === 400 && /only supports interactions/i.test(apiMessage)) {
        return await runInteractionsTest({
          apiKey: params.apiKey,
          modelId: cleanModelId,
          prompt: params.prompt,
        });
      }
      const classified = classifyGeminiApiError({
        httpStatus: response.status,
        apiStatus: payload.error?.status,
        apiMessage,
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
      apiMessage: timedRequest.didTimeout()
        ? `Generation request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
        : err instanceof Error
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
  } finally {
    timedRequest.cleanup();
  }
}
