import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Coins,
  Cpu,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Zap,
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
import { CostChart, TokenDistributionDonut, TokenUsageChart } from './Charts';
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

const panel = 'rounded-2xl border border-indigo-400/15 bg-[#0c1530] shadow-[0_12px_32px_rgba(0,0,0,.22)]';
const muted = 'text-slate-400';

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
  const summary = computeDashboardSummary(accounts, usageLogs, pricingCatalog);
  const dailySeries = aggregateDailyUsage(usageLogs, pricingCatalog);
  const isCheckingAny = checkingKeyIds.size > 0;
  const modelMap = new Map<string, { id: string; displayName: string; keyCount: number; methods: string[] }>();

  for (const account of accounts) {
    for (const model of account.discoveredModels) {
      const found = modelMap.get(model.id);
      if (found) found.keyCount += 1;
      else modelMap.set(model.id, {
        id: model.id,
        displayName: model.displayName,
        keyCount: 1,
        methods: model.supportedGenerationMethods,
      });
    }
  }

  const topModels = Array.from(modelMap.values())
    .sort((a, b) => b.keyCount - a.keyCount || a.id.localeCompare(b.id))
    .slice(0, 5);

  const tokenCards = [
    { label: 'INPUT TOKENS', value: summary.totalInputTokens, color: 'text-sky-300', border: 'border-sky-400/25', glow: 'shadow-[inset_0_0_24px_rgba(56,189,248,.08)]', dot: 'bg-sky-400' },
    { label: 'OUTPUT TOKENS', value: summary.totalOutputTokens, color: 'text-violet-300', border: 'border-violet-400/25', glow: 'shadow-[inset_0_0_24px_rgba(167,139,250,.08)]', dot: 'bg-violet-400' },
    { label: 'THINKING TOKENS', value: summary.totalThinkingTokens, color: 'text-emerald-300', border: 'border-emerald-400/25', glow: 'shadow-[inset_0_0_24px_rgba(52,211,153,.08)]', dot: 'bg-emerald-400' },
    { label: 'TOTAL TOKENS', value: summary.totalTokens, color: 'text-amber-300', border: 'border-amber-400/25', glow: 'shadow-[inset_0_0_24px_rgba(251,191,36,.08)]', dot: 'bg-amber-400' },
  ];

  return (
    <div className="space-y-5 text-slate-100">
      <section className={`${panel} overflow-hidden p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.9)]" />
              Gemini API Monitor
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white">System Overview</h2>
            <p className={`mt-1 text-xs sm:text-sm ${muted}`}>Live status from your saved API key accounts and locally recorded requests.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCheckAll} disabled={isCheckingAny || summary.enabledKeys === 0}
              className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-40 inline-flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${isCheckingAny ? 'animate-spin' : ''}`} />
              {isCheckingAny ? 'Checking…' : 'Check All'}
            </button>
            <button type="button" onClick={() => onNavigate(PageId.ApiKeys)}
              className="min-h-11 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add API Key
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <div className="rounded-xl bg-emerald-400/[.07] p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> READY</div>
            <div className="mt-1 text-2xl font-bold font-mono text-white">{summary.readyKeys}</div>
          </div>
          <div className="rounded-xl bg-rose-400/[.07] p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> ERRORS</div>
            <div className="mt-1 text-2xl font-bold font-mono text-white">{summary.errorKeys}</div>
          </div>
          <div className="rounded-xl bg-slate-400/[.07] p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-300"><Activity className="h-3.5 w-3.5" /> NOT CHECKED</div>
            <div className="mt-1 text-2xl font-bold font-mono text-white">{summary.notCheckedKeys}</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className={`${panel} p-4`}>
          <div className={`flex items-center justify-between text-xs ${muted}`}><span>API KEY ACCOUNTS</span><KeyRound className="h-4 w-4 text-cyan-300" /></div>
          <div className="mt-2 text-3xl font-bold font-mono text-white">{summary.totalKeys}</div>
          <p className={`mt-1 text-[11px] ${muted}`}>{summary.enabledKeys} enabled</p>
        </div>
        <div className={`${panel} p-4`}>
          <div className={`flex items-center justify-between text-xs ${muted}`}><span>AVAILABLE MODELS</span><Cpu className="h-4 w-4 text-violet-300" /></div>
          <div className="mt-2 text-3xl font-bold font-mono text-white">{summary.uniqueAvailableModels}</div>
          <p className={`mt-1 text-[11px] ${muted}`}>Discovered from Models API</p>
        </div>
      </section>

      <section aria-label="Token totals" className="grid grid-cols-2 gap-3">
        {tokenCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border bg-[#0c1530] p-4 ${card.border} ${card.glow}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${card.dot} shadow-[0_0_10px_currentColor]`} />
              <span className="text-[10px] font-bold tracking-wider text-slate-400">{card.label}</span>
            </div>
            <div className={`mt-2 break-all text-2xl sm:text-3xl font-bold font-mono tabular-nums ${card.color}`}>{card.value.toLocaleString()}</div>
          </div>
        ))}
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div><h3 className="font-semibold text-white">Token Distribution</h3><p className={`mt-1 text-xs ${muted}`}>App-recorded usage breakdown</p></div>
          <button type="button" onClick={() => onNavigate(PageId.TokenUsage)} className="min-h-10 px-2 text-xs font-semibold text-cyan-300">View details →</button>
        </div>
        <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:justify-around">
          <TokenDistributionDonut inputTokens={summary.totalInputTokens} outputTokens={summary.totalOutputTokens} thinkingTokens={summary.totalThinkingTokens} />
          <div className="grid w-full grid-cols-2 gap-2 sm:max-w-[220px] sm:grid-cols-1">
            <div className="rounded-xl bg-white/[.04] p-3"><div className={`text-[10px] ${muted}`}>ESTIMATED COST</div><div className="mt-1 text-xl font-bold font-mono text-amber-300">{formatUsd(summary.estimatedTotalCostUsd)}</div><div className="text-[10px] text-slate-500">App estimate only</div></div>
            <div className="rounded-xl bg-white/[.04] p-3"><div className={`text-[10px] ${muted}`}>REQUESTS RECORDED</div><div className="mt-1 text-xl font-bold font-mono text-white">{summary.totalRequests.toLocaleString()}</div><div className="text-[10px] text-slate-500">Local history</div></div>
          </div>
        </div>
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-white">Token Usage Trend</h3><p className={`mt-1 text-xs ${muted}`}>Daily input, output and thinking tokens</p></div><Zap className="h-5 w-5 text-amber-300" /></div>
        <TokenUsageChart data={dailySeries} />
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-white">Estimated Cost Trend</h3><p className={`mt-1 text-xs ${muted}`}>Based on configured pricing rates</p></div><Coins className="h-5 w-5 text-amber-300" /></div>
        <CostChart data={dailySeries} />
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h3 className="font-semibold text-white">API Key Accounts</h3><p className={`mt-1 text-xs ${muted}`}>Tap an account to inspect its details</p></div>
          <button type="button" onClick={() => onNavigate(PageId.ApiKeys)} className="min-h-10 text-xs font-semibold text-cyan-300">Manage →</button>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
            <KeyRound className="mx-auto h-7 w-7 text-slate-500" />
            <p className="mt-2 text-sm font-medium text-white">No API keys saved</p>
            <p className={`mt-1 text-xs ${muted}`}>Add a Gemini API key to start monitoring.</p>
            <button type="button" onClick={() => onNavigate(PageId.ApiKeys)} className="mt-4 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Add First Key</button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const checking = checkingKeyIds.has(account.id);
              const hasError = isErrorHealthStatus(account.status);
              return (
                <button key={account.id} type="button" onClick={() => onSelectAccount(account)}
                  className="w-full rounded-xl border border-white/10 bg-white/[.035] p-3 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/[.05]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{account.accountName}</div><div className={`mt-1 truncate text-xs ${muted}`}>{account.projectLabel || account.googleAccountLabel || maskApiKey(account.apiKey)}</div></div>
                    <div className="flex shrink-0 items-center gap-2"><StatusBadge status={account.status} enabled={account.enabled} isChecking={checking} /><ChevronRight className="h-4 w-4 text-slate-500" /></div>
                  </div>
                  <div className={`mt-2 flex flex-wrap gap-x-3 text-[11px] ${muted}`}><span>{account.discoveredModels.length} models</span><span>Checked {formatRelativeTime(account.lastCheckedAt)}</span></div>
                  {hasError && account.latestError && <p className="mt-2 line-clamp-2 text-xs text-rose-300">{account.latestError.httpStatus ? `HTTP ${account.latestError.httpStatus}: ` : ''}{account.latestError.message}</p>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">Discovered Models</h3><button type="button" onClick={() => onNavigate(PageId.Models)} className="min-h-10 text-xs font-semibold text-cyan-300">All models →</button></div>
        {topModels.length === 0 ? <p className={`py-4 text-sm ${muted}`}>No models discovered yet. Check an enabled API key.</p> : (
          <div className="divide-y divide-white/[.07]">{topModels.map((model) => <div key={model.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{model.displayName}</div><div className="truncate font-mono text-[11px] text-slate-500">{model.id}</div></div><span className="shrink-0 rounded-lg bg-violet-400/10 px-2 py-1 text-[11px] text-violet-200">{model.keyCount}/{accounts.length} keys</span></div>)}</div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={`${panel} p-4`}>
          <h3 className="font-semibold text-white">Recent API Activity <span className={`text-xs font-normal ${muted}`}>({usageLogs.length})</span></h3>
          {usageLogs.length === 0 ? <p className={`py-5 text-sm ${muted}`}>No test requests recorded yet.</p> : (
            <div className="mt-3 space-y-3">{usageLogs.slice(0, 5).map((log) => <div key={log.id} className="flex items-center justify-between gap-2 border-t border-white/[.07] pt-3"><div className="min-w-0"><div className="truncate text-xs font-medium text-white">{log.accountName} · {log.modelId}</div><div className={`mt-1 text-[11px] ${muted}`}>{formatRelativeTime(log.timestamp)} · {log.latencyMs} ms</div></div><div className="shrink-0 text-right"><div className={`text-[10px] font-bold ${log.status === 'SUCCESS' ? 'text-emerald-300' : 'text-rose-300'}`}>{log.status}</div><div className="font-mono text-xs text-slate-300">{log.totalTokens.toLocaleString()} tok</div></div></div>)}</div>
          )}
        </section>
        <section className={`${panel} p-4`}>
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-white">Error History <span className={`text-xs font-normal ${muted}`}>({errorLogs.length})</span></h3>{errorLogs.length > 0 && <button type="button" onClick={onClearErrors} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-rose-300 hover:bg-rose-400/10"><Trash2 className="h-3.5 w-3.5" /> Clear</button>}</div>
          {errorLogs.length === 0 ? <p className={`py-5 text-sm ${muted}`}>No API errors logged.</p> : (
            <div className="mt-3 space-y-3">{errorLogs.slice(0, 5).map((error) => <div key={error.id} className="border-t border-white/[.07] pt-3"><div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300"><ShieldAlert className="h-3.5 w-3.5" />{error.category}{error.httpStatus ? ` · ${error.httpStatus}` : ''}</span><span className={`text-[10px] ${muted}`}>{formatRelativeTime(error.timestamp)}</span></div><div className="mt-1 text-xs text-slate-300">{error.accountName}{error.modelId ? ` · ${error.modelId}` : ''}</div><p className="mt-1 break-words text-xs text-slate-400">{error.message}</p></div>)}</div>
          )}
        </section>
      </div>
    </div>
  );
};
