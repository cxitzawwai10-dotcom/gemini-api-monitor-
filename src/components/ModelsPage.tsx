import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Minus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { ApiKeyAccount, DiscoveredModel, KeyHealthStatus } from '../types/monitor';
import { formatRelativeTime } from '../utils/health';
import { StatusBadge } from './StatusBadge';

interface ModelsPageProps {
  accounts: ApiKeyAccount[];
  checkingKeyIds: Set<string>;
  onRefreshKey: (accountId: string) => Promise<void>;
}

export const ModelsPage: React.FC<ModelsPageProps> = ({
  accounts,
  checkingKeyIds,
  onRefreshKey,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyTextGeneration, setOnlyTextGeneration] = useState(true);
  const [showMatrix, setShowMatrix] = useState(true);
  const [showExplorer, setShowExplorer] = useState(true);

  // Automatically bring refreshed model results into view when discovery data changes.
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const previousResultsVersionRef = useRef<string | null>(null);
  const resultsVersion = accounts
    .map((account) =>
      [account.id, account.modelsUpdatedAt || '', account.discoveredModels.length].join(':')
    )
    .join('|');

  useEffect(() => {
    const previousVersion = previousResultsVersionRef.current;
    previousResultsVersionRef.current = resultsVersion;

    // Skip the initial render; scroll only after a later successful model refresh.
    if (
      previousVersion !== null &&
      previousVersion !== resultsVersion &&
      accounts.some((account) => account.discoveredModels.length > 0)
    ) {
      resultsSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [accounts, resultsVersion]);

  const allDiscoveredModelIds = useMemo(() => {
    const map = new Map<string, DiscoveredModel>();
    for (const acc of accounts) {
      for (const m of acc.discoveredModels) {
        if (!map.has(m.id)) {
          map.set(m.id, m);
        }
      }
    }
    return Array.from(map.values())
      .filter((m) => {
        if (
          onlyTextGeneration &&
          !m.supportedGenerationMethods.some((method) => ['generateContent', 'interactions'].includes(method)) && m.id !== 'gemini-4-hydrogen'
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            m.id.toLowerCase().includes(q) ||
            m.displayName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [accounts, onlyTextGeneration, searchQuery]);

  const displayedAccounts = useMemo(() => {
    if (selectedAccountId === 'ALL') return accounts;
    return accounts.filter((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search discovered models..."
              aria-label="Search discovered models"
              className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            aria-label="Filter by API key account"
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All API Keys ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountName} ({acc.discoveredModels.length} models)
              </option>
            ))}
          </select>

          <label className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyTextGeneration}
              onChange={(e) => setOnlyTextGeneration(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Text generation ready (GenerateContent / Interactions)</span>
          </label>
        </div>
      </div>

      {/* Model Compatibility Matrix */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Model Compatibility Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real API-discovered model availability across your saved keys. Only models confirmed by the Models endpoint are marked Available.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMatrix((v) => !v)}
            aria-expanded={showMatrix}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0"
          >
            {showMatrix ? (
              <>
                Hide Table <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Show Table <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {showMatrix && (
          <>
            {accounts.length === 0 || allDiscoveredModelIds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No discovered models to compare yet. Add and check at least one valid API key.
              </div>
            ) : (
              <div
                className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
                data-no-swipe="true"
              >
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-950 px-3.5 py-3 font-semibold text-slate-700 dark:text-slate-200 min-w-[160px] border-r border-slate-200 dark:border-slate-800">
                        Model ID
                      </th>
                      {displayedAccounts.map((acc) => (
                        <th
                          key={acc.id}
                          className="px-3.5 py-3 font-semibold text-slate-700 dark:text-slate-200 min-w-[140px] whitespace-nowrap"
                        >
                          <div className="truncate max-w-[160px]">
                            {acc.accountName}
                          </div>
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {acc.status}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allDiscoveredModelIds.map((model) => (
                      <tr
                        key={model.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3.5 py-2.5 font-mono text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                          {model.id}
                        </td>
                        {displayedAccounts.map((acc) => {
                          const hasModel = acc.discoveredModels.some(
                            (m) => m.id === model.id
                          );
                          const isReady = acc.status === KeyHealthStatus.Ready;
                          return (
                            <td key={acc.id} className="px-3.5 py-2.5 whitespace-nowrap">
                              {hasModel ? (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                  Available
                                </span>
                              ) : isReady ? (
                                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                                  Unavailable
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  {acc.status === KeyHealthStatus.NotChecked
                                    ? 'Not Checked'
                                    : 'Key Error'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Per-Key Discovered Models Explorer */}
      <section ref={resultsSectionRef} className="space-y-4 scroll-mt-20">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Per-Key Model Discovery Details
          </h2>
          <button
            type="button"
            onClick={() => setShowExplorer((v) => !v)}
            aria-expanded={showExplorer}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            {showExplorer ? (
              <>
                Hide Details <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Show Details <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {showExplorer &&
          displayedAccounts.map((acc) => {
            const isChecking = checkingKeyIds.has(acc.id);
            const filteredModels = acc.discoveredModels.filter((m) => {
              if (
                onlyTextGeneration &&
                !m.supportedGenerationMethods.some((method) => ['generateContent', 'interactions'].includes(method))
              ) {
                return false;
              }
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                  m.id.toLowerCase().includes(q) ||
                  m.displayName.toLowerCase().includes(q)
                );
              }
              return true;
            });

            return (
              <article
                key={acc.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {acc.accountName}
                      </h3>
                      <StatusBadge
                        status={acc.status}
                        enabled={acc.enabled}
                        isChecking={isChecking}
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {filteredModels.length} shown of {acc.discoveredModels.length} discovered
                      {' · '}
                      Updated {formatRelativeTime(acc.modelsUpdatedAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isChecking || !acc.enabled}
                    onClick={() => void onRefreshKey(acc.id)}
                    aria-label={`Refresh models for ${acc.accountName}`}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`}
                    />
                    <span>Refresh Models</span>
                  </button>
                </div>

                {acc.modelDiscoveryError && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
                    Discovery error: {acc.modelDiscoveryError}
                  </div>
                )}

                {filteredModels.length === 0 ? (
                  <div className="py-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Cpu className="w-4 h-4 shrink-0" />
                    <span>
                      {acc.discoveredModels.length === 0
                        ? 'No models returned by Models API for this key.'
                        : 'No text-generation models match this filter. Refresh the API model list or turn off the text-only filter to view all discovered models.'}
                    </span>
                  </div>
                ) : (
                  <div
                    className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
                    data-no-swipe="true"
                  >
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                          <th className="px-3.5 py-2.5 font-semibold">Display Name</th>
                          <th className="px-3.5 py-2.5 font-semibold">Model ID</th>
                          <th className="px-3.5 py-2.5 font-semibold">Methods</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">
                            Input Limit
                          </th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">
                            Output Limit
                          </th>
                          <th className="px-3.5 py-2.5 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredModels.map((m) => (
                          <tr
                            key={m.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                              <div>{m.displayName}</div>
                              {m.version && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  v{m.version}
                                </div>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {m.id}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                              {m.supportedGenerationMethods.join(', ') || 'None listed'}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {m.inputTokenLimit
                                ? m.inputTokenLimit.toLocaleString()
                                : '—'}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {m.outputTokenLimit
                                ? m.outputTokenLimit.toLocaleString()
                                : '—'}
                            </td>
                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                {m.supportedGenerationMethods.includes('generateContent') ? 'Text · GenerateContent' : m.supportedGenerationMethods.includes('interactions') ? 'Text · Interactions' : 'Listed by API'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
      </section>
    </div>
  );
};
