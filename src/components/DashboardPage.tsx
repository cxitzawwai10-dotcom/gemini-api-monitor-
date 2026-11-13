import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDashed,
  Coins,
  Cpu,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  ApiErrorRecord,
  ApiKeyAccount,
  KeyHealthStatus,
  ModelPricing,
  PageId,
  UsageRecord,
} from '../types/monitor';
import {
  computeDashboardSummary,
  formatRelativeTime,
  isErrorHealthStatus,
  maskApiKey,
} from '../utils/health';
import { aggregateDailyUsage } from '../utils/filtering';
import { formatUsd } from '../utils/pricing';
import { CostChart, TokenUsageChart } from './Charts';
import { StatusBadge } from './StatusBadge';

interface DashboardPageProps {
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  errorLogs: ApiErrorRecord[];
  pricingCatalog: ModelPricing[];
  checkingKeyIds: Set<string>;
  onNavigate: (page: PageId) => void;
  onSelectAccount: (account: ApiKeyAccount) => void;
  onCheckAll: () => void;
  onClearErrors: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  accounts,
  usageLogs,
  errorLogs,
  pricingCatalog,
  checkingKeyIds,
  onNavigate,
  onSelectAccount,
  onCheckAll,
  onClearErrors,
}) => {
  const [showActivity, setShowActivity] = useState(true);
  const [showErrors, setShowErrors] = useState(true);

  const summary = computeDashboardSummary(accounts, usageLogs, pricingCatalog);
  const dailySeries = aggregateDailyUsage(usageLogs, pricingCatalog);
  const isCheckingAny = checkingKeyIds.size > 0;

  // Aggregate unique discovered models and how many keys can access each
  const modelAvailabilityMap = new Map<
    string,
    { id: string; displayName: string; keyCount: number; methods: string[] }
  >();
  for (const acc of accounts) {
    if (acc.status !== KeyHealthStatus.Ready && acc.discoveredModels.length === 0)
      continue;
    for (const m of acc.discoveredModels) {
      const existing = modelAvailabilityMap.get(m.id);
      if (existing) {
        existing.keyCount += 1;
      } else {
        modelAvailabilityMap.set(m.id, {
          id: m.id,
          displayName: m.displayName,
          keyCount: 1,
          methods: m.supportedGenerationMethods,
        });
      }
    }
  }
  const topModels = Array.from(modelAvailabilityMap.values())
    .sort((a, b) => b.keyCount - a.keyCount || a.id.localeCompare(b.id))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Startup Health Check Summary Banner */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              API Key Health Overview
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Startup check uses the lightweight Models List endpoint — zero generation tokens consumed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onCheckAll}
              disabled={isCheckingAny || summary.enabledKeys === 0}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-4 h-4 ${isCheckingAny ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isCheckingAny ? 'Checking Keys...' : 'Check All Keys'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(PageId.ApiKeys)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Key</span>
            </button>
          </div>
        </div>

        {/* Explicit Ready / Errors / Not Checked counts */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summary.readyKeys}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                READY
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AlertTriangle
              className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 dark:text-rose-400 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summary.errorKeys}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Errors
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CircleDashed
              className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summary.notCheckedKeys}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Not Checked
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section aria-label="Key performance metrics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>API Keys</span>
              <KeyRound className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {summary.totalKeys}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {summary.readyKeys} connected · {summary.errorKeys} failed
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Available Models</span>
              <Cpu className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {summary.uniqueAvailableModels}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Confirmed by Models API
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total Tokens</span>
              <Activity className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {summary.totalTokens.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {summary.totalInputTokens.toLocaleString()} in ·{' '}
              {summary.totalOutputTokens.toLocaleString()} out
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Est. Cost (App)</span>
              <Coins className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatUsd(summary.estimatedTotalCostUsd)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {summary.totalRequests} requests recorded
            </div>
          </div>
        </div>
      </section>

      {/* Account Status Cards (Clickable -> AccountDetailModal) */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Accounts & API Keys
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tap any account card to inspect discovered models, masked key, and error logs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(PageId.ApiKeys)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 min-h-[44px] px-2 flex items-center"
          >
            Manage Keys
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
            <KeyRound
              className="w-8 h-8 mx-auto text-slate-400"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No Gemini API keys saved yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Add one or more personal Gemini API keys from different Google accounts or Cloud projects. Keys stay stored locally in your browser IndexedDB.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(PageId.ApiKeys)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First API Key
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accounts.map((acc) => {
              const isChecking = checkingKeyIds.has(acc.id);
              const hasErr = isErrorHealthStatus(acc.status);
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onSelectAccount(acc)}
                  className="text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 p-4 transition-colors space-y-2.5 w-full"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {acc.accountName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {acc.projectLabel || acc.googleAccountLabel || maskApiKey(acc.apiKey)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge
                        status={acc.status}
                        enabled={acc.enabled}
                        isChecking={isChecking}
                      />
                      <ChevronRight
                        className="w-4 h-4 text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{acc.discoveredModels.length} models</span>
                    <span aria-hidden="true">·</span>
                    <span>Checked {formatRelativeTime(acc.lastCheckedAt)}</span>
                  </div>

                  {hasErr && acc.latestError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 line-clamp-2">
                      {acc.latestError.httpStatus
                        ? `HTTP ${acc.latestError.httpStatus}: `
                        : ''}
                      {acc.latestError.message}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Token Usage Trend
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(PageId.TokenUsage)}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] px-2 flex items-center"
            >
              Details
            </button>
          </div>
          <TokenUsageChart data={dailySeries} />
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Estimated Cost Trend
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(PageId.TokenUsage)}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] px-2 flex items-center"
            >
              Pricing & Cost
            </button>
          </div>
          <CostChart data={dailySeries} />
        </section>
      </div>

      {/* Model Availability Overview */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Model Availability Overview
          </h2>
          <button
            type="button"
            onClick={() => onNavigate(PageId.Models)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] px-2 flex items-center"
          >
            Compatibility Matrix
          </button>
        </div>

        {topModels.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
            No models discovered yet. Add a valid Gemini API key to automatically retrieve accessible models.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {topModels.map((m) => (
              <div
                key={m.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {m.displayName}
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    {m.id}
                  </div>
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                  {m.keyCount} / {accounts.length} keys
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent API Activity & Error History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent API Activity ({usageLogs.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowActivity((v) => !v)}
              aria-expanded={showActivity}
              className="min-h-[44px] px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
            >
              {showActivity ? (
                <>
                  Hide <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Show <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {showActivity && (
            <div className="mt-3">
              {usageLogs.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                  No GenerateContent requests recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usageLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {log.accountName} · <span className="font-mono">{log.modelId}</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {formatRelativeTime(log.timestamp)} · {log.latencyMs}ms
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div
                          className={
                            log.status === 'SUCCESS'
                              ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                              : 'text-rose-600 dark:text-rose-400 font-semibold'
                          }
                        >
                          {log.status}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {log.totalTokens.toLocaleString()} tok
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Error History ({errorLogs.length})
            </h2>
            <div className="flex items-center gap-1">
              {errorLogs.length > 0 && (
                <button
                  type="button"
                  onClick={onClearErrors}
                  className="min-h-[44px] px-2.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowErrors((v) => !v)}
                aria-expanded={showErrors}
                className="min-h-[44px] px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
              >
                {showErrors ? (
                  <>
                    Hide <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Show <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {showErrors && (
            <div className="mt-3">
              {errorLogs.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                  No API errors logged.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {errorLogs.slice(0, 6).map((err) => (
                    <div key={err.id} className="py-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          {err.category}
                          {err.httpStatus ? ` (${err.httpStatus})` : ''}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {formatRelativeTime(err.timestamp)}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 font-medium">
                        {err.accountName}
                        {err.modelId ? ` · ${err.modelId}` : ''}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 break-words">
                        {err.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
