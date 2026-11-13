import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Gauge,
  Info,
  Save,
  X,
} from 'lucide-react';
import {
  ApiKeyAccount,
  QuotaReferenceLimit,
  UsageRecord,
} from '../types/monitor';
import { computeAppTrackedWindowMetrics } from '../utils/filtering';
import { StatusBadge } from './StatusBadge';

interface QuotaMonitorPageProps {
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  quotaReferences: QuotaReferenceLimit[];
  onSaveQuotaReference: (ref: QuotaReferenceLimit) => Promise<void>;
}

export const QuotaMonitorPage: React.FC<QuotaMonitorPageProps> = ({
  accounts,
  usageLogs,
  quotaReferences,
  onSaveQuotaReference,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [showModelLimits, setShowModelLimits] = useState(true);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [tierName, setTierName] = useState('');
  const [rpmInput, setRpmInput] = useState('');
  const [tpmInput, setTpmInput] = useState('');
  const [rpdInput, setRpdInput] = useState('');

  const displayedAccounts =
    selectedAccountId === 'ALL'
      ? accounts
      : accounts.filter((a) => a.id === selectedAccountId);

  const openEditor = (acc: ApiKeyAccount) => {
    const existing = quotaReferences.find((q) => q.accountId === acc.id);
    setEditingAccountId(acc.id);
    setTierName(existing?.tierName || '');
    setRpmInput(existing?.rpmLimit !== undefined ? String(existing.rpmLimit) : '');
    setTpmInput(existing?.tpmLimit !== undefined ? String(existing.tpmLimit) : '');
    setRpdInput(existing?.rpdLimit !== undefined ? String(existing.rpdLimit) : '');
  };

  const handleSaveRef = async (accountId: string) => {
    const parseNum = (v: string) => {
      const n = Number(v.trim());
      return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
    };

    await onSaveQuotaReference({
      id: `qref_${accountId}`,
      accountId,
      tierName: tierName.trim() || 'Custom Reference',
      rpmLimit: parseNum(rpmInput),
      tpmLimit: parseNum(tpmInput),
      rpdLimit: parseNum(rpdInput),
      updatedAt: new Date().toISOString(),
    });
    setEditingAccountId(null);
  };

  return (
    <div className="space-y-6">
      {/* Transparent API Limitation Notice */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info
            className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1.5 text-sm">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Quota Telemetry & Data Source Transparency
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Standard Gemini API keys (<code className="font-mono">generativelanguage.googleapis.com</code>) do{' '}
              <strong>not</strong> expose project-level RPM, TPM, RPD limits, remaining quota, or reset timestamps via public REST headers or endpoints. Querying live Google Cloud Monitoring metrics requires OAuth2 Cloud IAM credentials (<code className="font-mono">monitoring.googleapis.com</code>), which are not available from a standalone API key.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Therefore, Google-reported remaining quota and reset timers are honestly shown as{' '}
              <strong>Not Available</strong> rather than fabricated. Below, project-level Google quota is separated from model-level token limits (from the Models API) and local app-tracked counters.
            </p>
          </div>
        </div>
      </section>

      {/* Filter */}
      {accounts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            aria-label="Filter quota monitor by account"
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Projects & Keys ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountName}
                {acc.projectLabel ? ` (${acc.projectLabel})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
          <Gauge className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            No API keys to monitor
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add an API key on the API Keys page to inspect model token limits and track local request rates.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {displayedAccounts.map((acc) => {
            const refLimit = quotaReferences.find((q) => q.accountId === acc.id);
            const appWindow = computeAppTrackedWindowMetrics(usageLogs, acc.id);
            const isEditing = editingAccountId === acc.id;

            return (
              <article
                key={acc.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {acc.accountName}
                      </h3>
                      <StatusBadge status={acc.status} enabled={acc.enabled} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Project: {acc.projectLabel || 'Not specified'} · Account:{' '}
                      {acc.googleAccountLabel || 'Not specified'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => (isEditing ? setEditingAccountId(null) : openEditor(acc))}
                    className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                  >
                    {isEditing ? (
                      <>
                        <X className="w-3.5 h-3.5" /> Close Reference Editor
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5" /> Set Reference Tier
                      </>
                    )}
                  </button>
                </div>

                {/* Optional User-Entered Reference Tier Editor */}
                {isEditing && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Optional: Record your project&apos;s rate limits from Google AI Studio for personal comparison. These values are labeled as user-entered references, not live API telemetry.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={tierName}
                        onChange={(e) => setTierName(e.target.value)}
                        placeholder="Tier (e.g., Free / Tier 1)"
                        aria-label="Tier name"
                        className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                      <input
                        type="number"
                        min="0"
                        value={rpmInput}
                        onChange={(e) => setRpmInput(e.target.value)}
                        placeholder="Ref RPM"
                        aria-label="Reference RPM limit"
                        className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                      />
                      <input
                        type="number"
                        min="0"
                        value={tpmInput}
                        onChange={(e) => setTpmInput(e.target.value)}
                        placeholder="Ref TPM"
                        aria-label="Reference TPM limit"
                        className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                      />
                      <input
                        type="number"
                        min="0"
                        value={rpdInput}
                        onChange={(e) => setRpdInput(e.target.value)}
                        placeholder="Ref RPD"
                        aria-label="Reference RPD limit"
                        className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleSaveRef(acc.id)}
                        className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Reference
                      </button>
                    </div>
                  </div>
                )}

                {/* Project-Level Google Quota vs App-Tracked */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Project-Level Quota Status (Google-Reported vs App-Tracked)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        RPM (Google Remaining)
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Not Available
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        App 1m: {appWindow.rpmLastMinute}
                        {refLimit?.rpmLimit !== undefined
                          ? ` / Ref ${refLimit.rpmLimit}`
                          : ''}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        TPM (Google Remaining)
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Not Available
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        App 1m: {appWindow.tpmLastMinute.toLocaleString()}
                        {refLimit?.tpmLimit !== undefined
                          ? ` / Ref ${refLimit.tpmLimit.toLocaleString()}`
                          : ''}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        RPD (Google Remaining)
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Not Available
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        App Today: {appWindow.rpdToday}
                        {refLimit?.rpdLimit !== undefined
                          ? ` / Ref ${refLimit.rpdLimit}`
                          : ''}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Quota Reset Info
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Not Available
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        App Today: {appWindow.inputTokensToday.toLocaleString()} in ·{' '}
                        {appWindow.outputTokensToday.toLocaleString()} out
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model-Level Limits (from real Models API response) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Model-Level Context Limits & App Usage ({acc.discoveredModels.length} discovered models)
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowModelLimits((v) => !v)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 min-h-[36px] px-2"
                    >
                      {showModelLimits ? (
                        <>
                          Hide <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          Show <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {showModelLimits && (
                    <>
                      {acc.discoveredModels.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No discovered model metadata available for this key.
                        </p>
                      ) : (
                        <div
                          className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
                          data-no-swipe="true"
                        >
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                                <th className="px-3 py-2 font-semibold">Model ID</th>
                                <th className="px-3 py-2 font-semibold text-right">
                                  Input Context Limit
                                </th>
                                <th className="px-3 py-2 font-semibold text-right">
                                  Output Token Limit
                                </th>
                                <th className="px-3 py-2 font-semibold text-right">
                                  App Input Today
                                </th>
                                <th className="px-3 py-2 font-semibold text-right">
                                  App Output Today
                                </th>
                                <th className="px-3 py-2 font-semibold">
                                  Remaining Quota (API)
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {acc.discoveredModels.slice(0, 12).map((m) => {
                                const modelLogs = usageLogs.filter(
                                  (u) =>
                                    u.accountId === acc.id &&
                                    u.modelId === m.id
                                );
                                const modelWindow = computeAppTrackedWindowMetrics(
                                  modelLogs,
                                  acc.id
                                );
                                return (
                                  <tr key={m.id}>
                                    <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                      {m.id}
                                    </td>
                                    <td className="px-3 py-2 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">
                                      {m.inputTokenLimit
                                        ? m.inputTokenLimit.toLocaleString()
                                        : 'Not Available'}
                                    </td>
                                    <td className="px-3 py-2 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">
                                      {m.outputTokenLimit
                                        ? m.outputTokenLimit.toLocaleString()
                                        : 'Not Available'}
                                    </td>
                                    <td className="px-3 py-2 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">
                                      {modelWindow.inputTokensToday.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">
                                      {modelWindow.outputTokensToday.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                      Not Available
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
