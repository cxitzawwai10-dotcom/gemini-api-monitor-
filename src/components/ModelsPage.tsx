import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
  Search,
} from 'lucide-react';
import { ApiKeyAccount, DiscoveredModel } from '../types/monitor';
import { formatRelativeTime } from '../utils/health';
import { StatusBadge } from './StatusBadge';

interface ModelsPageProps {
  accounts: ApiKeyAccount[];
  checkingKeyIds: Set<string>;
  onRefreshKey: (accountId: string) => Promise<void>;
}

const PREVIEW_PATTERN =
  /(preview|experimental|(?:^|[-_.])(?:exp|alpha|beta)(?:[-_.]|$))/i;

function modelText(model: DiscoveredModel): string {
  return [
    model.id,
    model.displayName,
    model.version || '',
    model.description || '',
  ].join(' ');
}

function isGenerateContentSupported(model: DiscoveredModel): boolean {
  return model.supportedGenerationMethods.includes('generateContent');
}

function isPreviewModel(model: DiscoveredModel): boolean {
  return PREVIEW_PATTERN.test(modelText(model));
}

function matchesSearch(model: DiscoveredModel, query: string): boolean {
  if (!query.trim()) return true;
  const value = query.trim().toLowerCase();
  return (
    model.id.toLowerCase().includes(value) ||
    model.displayName.toLowerCase().includes(value) ||
    (model.description || '').toLowerCase().includes(value)
  );
}

function latestTimestamp(accounts: ApiKeyAccount[]): string | undefined {
  const timestamps = accounts.flatMap((account) =>
    [account.modelsUpdatedAt, account.lastCheckedAt].filter(
      (value): value is string => Boolean(value)
    )
  );
  timestamps.sort((a, b) => Date.parse(b) - Date.parse(a));
  return timestamps[0];
}

function ModelRow({ model }: { model: DiscoveredModel }) {
  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
            {model.displayName || model.id}
          </h3>
          <p className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all">
            {model.id}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          generateContent
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>Input: {model.inputTokenLimit ? model.inputTokenLimit.toLocaleString() : '—'}</span>
        <span>Output: {model.outputTokenLimit ? model.outputTokenLimit.toLocaleString() : '—'}</span>
        {model.version ? <span>Version: {model.version}</span> : null}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
        Listed by Gemini Models API; not a live generation test.
      </p>
    </article>
  );
}

export const ModelsPage: React.FC<ModelsPageProps> = ({
  accounts,
  checkingKeyIds,
  onRefreshKey,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDiscoveryArchive, setShowDiscoveryArchive] = useState(false);

  const displayedAccounts = useMemo(
    () =>
      selectedAccountId === 'ALL'
        ? accounts
        : accounts.filter((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const allDiscoveredModels = useMemo(() => {
    const models = new Map<string, DiscoveredModel>();
    for (const account of displayedAccounts) {
      for (const model of account.discoveredModels) {
        const existing = models.get(model.id);
        if (!existing) {
          models.set(model.id, {
            ...model,
            supportedGenerationMethods: [...new Set(model.supportedGenerationMethods)],
          });
          continue;
        }

        // Union methods across keys so one incomplete record cannot hide support
        // confirmed by another key or project.
        models.set(model.id, {
          ...existing,
          supportedGenerationMethods: [
            ...new Set([
              ...existing.supportedGenerationMethods,
              ...model.supportedGenerationMethods,
            ]),
          ],
        });
      }
    }
    return Array.from(models.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [displayedAccounts]);

  const generateContentModels = useMemo(
    () => allDiscoveredModels.filter(isGenerateContentSupported),
    [allDiscoveredModels]
  );

  const stableModels = useMemo(
    () => generateContentModels.filter((model) => !isPreviewModel(model)),
    [generateContentModels]
  );
  const previewModels = useMemo(
    () => generateContentModels.filter(isPreviewModel),
    [generateContentModels]
  );
  const hiddenModels = useMemo(
    () => allDiscoveredModels.filter((model) => !isGenerateContentSupported(model)),
    [allDiscoveredModels]
  );

  const filteredStableModels = stableModels.filter((model) =>
    matchesSearch(model, searchQuery)
  );
  const filteredPreviewModels = previewModels.filter((model) =>
    matchesSearch(model, searchQuery)
  );

  const isRefreshing = displayedAccounts.some((account) =>
    checkingKeyIds.has(account.id)
  );
  const refreshableAccounts = displayedAccounts.filter(
    (account) => account.enabled && !checkingKeyIds.has(account.id)
  );
  const lastChecked = latestTimestamp(displayedAccounts);
  const hasRelevantErrors = displayedAccounts.some(
    (account) => Boolean(account.modelDiscoveryError || account.latestError?.modelId)
  );

  const refreshModels = () => {
    void Promise.all(
      refreshableAccounts.map((account) => onRefreshKey(account.id))
    ).catch(() => undefined);
  };

  return (
    <div className="mx-auto w-full max-w-[740px] space-y-4">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Models Supporting generateContent
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Models whose discovery metadata lists generateContent
            </p>
          </div>
          <button
            type="button"
            onClick={refreshModels}
            disabled={refreshableAccounts.length === 0 || isRefreshing}
            className="min-h-[38px] shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw className={isRefreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh Models
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Supported</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {stableModels.length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Preview</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {previewModels.length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Other saved</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {hiddenModels.length}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search model name or ID..."
              aria-label="Search models"
              className="min-h-[40px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
          <select
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            aria-label="Filter models by API key"
            className="min-h-[40px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 sm:w-[190px]"
          >
            <option value="ALL">All API Keys ({accounts.length})</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            Last Checked: {lastChecked ? formatRelativeTime(lastChecked) : 'Never'}
          </span>
          <span>
            {filteredStableModels.length + filteredPreviewModels.length} matching models
          </span>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Supported Models
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Stable models with generateContent support
            </p>
          </div>
          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
            {filteredStableModels.length}
          </span>
        </div>
        {filteredStableModels.length > 0 ? (
          <div className="space-y-2">
            {filteredStableModels.map((model) => (
              <ModelRow key={model.id} model={model} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
            {stableModels.length === 0
              ? 'No stable generateContent models found yet.'
              : 'No stable models match this search.'}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Preview / Experimental
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Kept separate from the stable model list
            </p>
          </div>
          <span className="rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            {filteredPreviewModels.length}
          </span>
        </div>
        {filteredPreviewModels.length > 0 ? (
          <div className="space-y-2">
            {filteredPreviewModels.map((model) => (
              <ModelRow key={model.id} model={model} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
            {previewModels.length === 0
              ? 'No Preview / Experimental generateContent models found.'
              : 'No Preview / Experimental models match this search.'}
          </div>
        )}
      </section>

      {hasRelevantErrors ? (
        <section className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" />
            Relevant Model Errors
          </div>
          {displayedAccounts.map((account) => {
            if (!account.modelDiscoveryError && !account.latestError?.modelId) {
              return null;
            }
            return (
              <div key={account.id} className="rounded-lg bg-white/70 dark:bg-slate-950/50 p-2.5 text-[11px]">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {account.accountName}
                </p>
                {account.latestError?.modelId ? (
                  <p className="mt-1 text-rose-700 dark:text-rose-300">
                    {account.latestError.modelId}
                    {account.latestError.httpStatus
                      ? ' · HTTP ' + account.latestError.httpStatus
                      : ''}
                    {' · '}
                    {account.latestError.message}
                  </p>
                ) : null}
                {account.modelDiscoveryError ? (
                  <p className="mt-1 text-rose-700 dark:text-rose-300">
                    Discovery: {account.modelDiscoveryError}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDiscoveryArchive((value) => !value)}
          aria-expanded={showDiscoveryArchive}
          className="flex min-h-[46px] w-full items-center justify-between gap-3 px-3.5 text-left"
        >
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              All Discovered Models
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
              Includes all discovered models; discovery data is retained
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            {allDiscoveredModels.length}
            {showDiscoveryArchive ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>

        {showDiscoveryArchive ? (
          <div className="border-t border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
            {displayedAccounts.map((account) => {
              const accountModels = account.discoveredModels.filter((model) =>
                matchesSearch(model, searchQuery)
              );
              return (
                <div key={account.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {account.accountName}
                      </h3>
                      <StatusBadge
                        status={account.status}
                        enabled={account.enabled}
                        isChecking={checkingKeyIds.has(account.id)}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                      {accountModels.length} / {account.discoveredModels.length}
                    </span>
                  </div>
                  {accountModels.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                      {accountModels.map((model) => {
                        const hasGenerateContent =
                          model.supportedGenerationMethods.includes('generateContent');
                        return (
                          <div key={model.id} className="px-2.5 py-2">
                            <p className="break-all text-[11px] font-medium text-slate-800 dark:text-slate-200">
                              {model.displayName} <span className="font-mono text-slate-500">({model.id})</span>
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                              <span>{hasGenerateContent ? 'generateContent supported' : 'generateContent not listed'}</span>
                              <span>{model.supportedGenerationMethods.join(', ') || 'No methods listed'}</span>
                              {isPreviewModel(model) ? <span>Preview / Experimental</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
                      No discovered models match this search for this key.
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <Cpu className="h-3.5 w-3.5" />
              Hidden models remain stored and are not deleted by these filters.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};
