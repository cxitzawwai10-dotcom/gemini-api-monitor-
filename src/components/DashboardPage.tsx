import React from 'react';
import { AlertCircle, ChevronRight, KeyRound, Plus, RefreshCw } from 'lucide-react';
import {
  ApiErrorRecord,
  ApiKeyAccount,
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

const panel = 'rounded-2xl border border-white/10 bg-[#101a30] shadow-[0_8px_24px_rgba(0,0,0,.18)]';
const priorityModels = [
  { key: 'hydrogen', name: 'Hydrogen', match: (id: string, label: string) => /hydrogen/i.test(id + ' ' + label), accent: 'from-cyan-500/20 to-blue-500/10', color: 'text-cyan-300' },
  { key: 'flash38', name: 'Gemini 3.8 Flash', match: (id: string, label: string) => /3[._ -]?8.*flash|flash.*3[._ -]?8/i.test(id + ' ' + label), accent: 'from-violet-500/20 to-fuchsia-500/10', color: 'text-violet-300' },
];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  accounts,
  usageLogs,
  errorLogs,
  pricingCatalog,
  checkingKeyIds,
  onNavigate,
  onSelectAccount,
  onCheckAll,
}) => {
  const summary = computeDashboardSummary(accounts, usageLogs, pricingCatalog);
  const isCheckingAny = checkingKeyIds.size > 0;
  const enabledAccounts = accounts.filter((account) => account.enabled);

  const panelModelCount = (matcher: (id: string, label: string) => boolean) =>
    enabledAccounts.filter((account) =>
      account.discoveredModels.some((model) => matcher(model.id, model.displayName))
    ).length;

  return (
    <div className="space-y-4 text-slate-100">
      <section className={`${panel} overflow-hidden p-4 sm:p-5`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">GeminiPulse</p>
            <h2 className="mt-1 text-xl font-bold text-white">API Key Health</h2>
            <p className="mt-1 text-xs text-slate-400">Key status, errors and priority model discovery</p>
          </div>
          <button type="button" onClick={onCheckAll} disabled={isCheckingAny || enabledAccounts.length === 0}
            className="min-h-11 shrink-0 rounded-xl bg-cyan-500/15 px-3 text-sm font-semibold text-cyan-200 border border-cyan-300/25 disabled:opacity-40 inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isCheckingAny ? 'animate-spin' : ''}`} />
            {isCheckingAny ? 'Checking' : 'Check All'}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-400/10 p-3">
            <div className="text-[10px] font-semibold tracking-wide text-emerald-300">HEALTHY</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-white">{summary.readyKeys}</div>
          </div>
          <div className="rounded-xl bg-rose-400/10 p-3">
            <div className="text-[10px] font-semibold tracking-wide text-rose-300">ERRORS</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-white">{summary.errorKeys}</div>
          </div>
          <div className="rounded-xl bg-slate-400/10 p-3">
            <div className="text-[10px] font-semibold tracking-wide text-slate-300">UNCHECKED</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-white">{summary.notCheckedKeys}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-xs text-slate-400">{summary.totalKeys} saved keys · {summary.enabledKeys} enabled</span>
          <button type="button" onClick={() => onNavigate(PageId.ApiKeys)} className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Key
          </button>
        </div>
      </section>

      <section className={`${panel} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white">Priority Models</h3>
            <p className="mt-1 text-xs text-slate-400">Discovery result across enabled keys</p>
          </div>
          <button type="button" onClick={() => onNavigate(PageId.Models)} className="min-h-9 px-2 text-xs font-semibold text-cyan-300">All Models <ChevronRight className="inline h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-3 space-y-2">
          {priorityModels.map((model) => {
            const found = panelModelCount(model.match);
            return (
              <div key={model.key} className={`rounded-xl border border-white/10 bg-gradient-to-r ${model.accent} p-3`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold ${model.color}`}>{model.name}</div>
                    <div className="mt-1 text-[11px] text-slate-400">Listed by Models API · not yet generation-tested</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold tabular-nums text-white">{found}/{enabledAccounts.length}</div>
                    <div className="text-[10px] text-slate-400">keys listed</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">A listed model is not automatically confirmed usable. Run a test request from Models / Token Usage to verify generation support.</p>
      </section>

      <section className={`${panel} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white">API Key Accounts</h3>
            <p className="mt-1 text-xs text-slate-400">Tap a key to view health details</p>
          </div>
          <button type="button" onClick={() => onNavigate(PageId.ApiKeys)} className="text-xs font-semibold text-cyan-300">Manage</button>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
            <KeyRound className="mx-auto h-6 w-6 text-slate-500" />
            <p className="mt-2 text-sm font-medium text-white">No API keys added</p>
            <button type="button" onClick={() => onNavigate(PageId.ApiKeys)} className="mt-3 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Add API Key</button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const checking = checkingKeyIds.has(account.id);
              const hasError = isErrorHealthStatus(account.status);
              return (
                <button key={account.id} type="button" onClick={() => onSelectAccount(account)}
                  className="w-full rounded-xl border border-white/10 bg-white/[.035] p-3 text-left transition hover:border-cyan-300/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{account.accountName}</div>
                      <div className="mt-1 truncate text-[11px] text-slate-400">{account.projectLabel || account.googleAccountLabel || maskApiKey(account.apiKey)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={account.status} enabled={account.enabled} isChecking={checking} />
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                    <span>{account.discoveredModels.length} discovered models</span>
                    <span>Checked {formatRelativeTime(account.lastCheckedAt)}</span>
                  </div>
                  {hasError && account.latestError && (
                    <div className="mt-2 flex gap-1.5 text-xs text-rose-300">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2">{account.latestError.httpStatus ? `HTTP ${account.latestError.httpStatus}: ` : ''}{account.latestError.message}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {errorLogs.length > 0 && (
        <button type="button" onClick={() => onNavigate(PageId.ApiKeys)}
          className="w-full rounded-xl border border-rose-400/20 bg-rose-400/[.07] p-3 text-left text-xs text-rose-200">
          {errorLogs.length} error record{errorLogs.length === 1 ? '' : 's'} saved · Open API Keys to inspect
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onNavigate(PageId.Models)} className="min-h-11 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 text-sm font-medium text-violet-200">Model Discovery</button>
        <button type="button" onClick={() => onNavigate(PageId.TokenUsage)} className="min-h-11 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 text-sm font-medium text-amber-200">Usage & Tests</button>
      </div>
    </div>
  );
};
