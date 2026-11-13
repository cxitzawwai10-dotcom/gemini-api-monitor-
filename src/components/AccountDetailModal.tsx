import React, { useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ApiErrorRecord, ApiKeyAccount, UsageRecord } from '../types/monitor';
import { formatRelativeTime, maskApiKey } from '../utils/health';
import { calculateUsageCost, formatUsd, ModelPricing } from '../utils/pricing';
import { StatusBadge } from './StatusBadge';

interface AccountDetailModalProps {
  account: ApiKeyAccount | null;
  usageLogs: UsageRecord[];
  errorLogs: ApiErrorRecord[];
  pricingCatalog: ModelPricing[];
  isChecking: boolean;
  onClose: () => void;
  onCheckKey: (accountId: string) => void;
  onCopyKey: (account: ApiKeyAccount) => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  usageLogs,
  errorLogs,
  pricingCatalog,
  isChecking,
  onClose,
  onCheckKey,
  onCopyKey,
}) => {
  const [revealKey, setRevealKey] = useState(false);

  if (!account) return null;

  const accountUsage = usageLogs.filter((u) => u.accountId === account.id);
  const accountErrors = errorLogs.filter((e) => e.accountId === account.id);

  const totalTokens = accountUsage.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalCost = accountUsage.reduce(
    (sum, r) => sum + calculateUsageCost(r, pricingCatalog).totalCostUsd,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-detail-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id="account-detail-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              {account.accountName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {account.googleAccountLabel || 'No Google account label'}
              {' · '}
              {account.projectLabel || 'No project label'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account details"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* Status & Key Row */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge
                status={account.status}
                enabled={account.enabled}
                isChecking={isChecking}
              />
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Last checked: {formatRelativeTime(account.lastCheckedAt)}
                {' · '}
                Last OK: {formatRelativeTime(account.lastSuccessAt)}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <code className="text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 break-all">
                {revealKey ? account.apiKey : maskApiKey(account.apiKey)}
              </code>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRevealKey((v) => !v)}
                  className="min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  {revealKey ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Show
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onCopyKey(account)}
                  className="min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Key
                </button>
                <button
                  type="button"
                  disabled={isChecking || !account.enabled}
                  onClick={() => onCheckKey(account.id)}
                  className="min-h-[44px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-medium text-white inline-flex items-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`}
                  />
                  Check Again
                </button>
              </div>
            </div>
          </div>

          {/* Latest Error if any */}
          {account.latestError && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {account.latestError.category}
                  {account.latestError.httpStatus
                    ? ` (HTTP ${account.latestError.httpStatus})`
                    : ''}
                </span>
              </div>
              <p className="text-sm text-rose-900 dark:text-rose-200 break-words">
                {account.latestError.message}
              </p>
              <p className="text-xs font-mono text-rose-700/80 dark:text-rose-300/80">
                {new Date(account.latestError.timestamp).toLocaleString()}
              </p>
            </div>
          )}

          {/* Usage summary for this key */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Discovered Models
              </div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {account.discoveredModels.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                App Tokens
              </div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Est. Cost
              </div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatUsd(totalCost)}
              </div>
            </div>
          </div>

          {/* Discovered Models List */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Discovered Models ({account.discoveredModels.length})
            </h3>
            {account.discoveredModels.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {account.modelDiscoveryError ||
                  'No models discovered yet for this API key.'}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                {account.discoveredModels.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {m.displayName}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                        {m.id}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      {m.supportedGenerationMethods.includes('generateContent')
                        ? 'generateContent'
                        : m.supportedGenerationMethods[0] || 'Listed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Errors for this account */}
          {accountErrors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Recent Errors ({accountErrors.length})
              </h3>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                {accountErrors.slice(0, 10).map((err) => (
                  <div key={err.id} className="px-3.5 py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2 font-medium text-rose-700 dark:text-rose-400">
                      <span>
                        {err.category}
                        {err.httpStatus ? ` · HTTP ${err.httpStatus}` : ''}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(err.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 break-words">
                      {err.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
