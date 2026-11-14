import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  FileSpreadsheet,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ApiKeyAccount,
  DateFilterPreset,
  ModelPricing,
  UsageFilters,
  UsageRecord,
} from '../types/monitor';
import {
  aggregateDailyUsage,
  filterUsageRecords,
  groupUsageByAccount,
  groupUsageByModel,
} from '../utils/filtering';
import {
  calculateUsageCost,
  DEFAULT_PRICING_CATALOG,
  formatUsd,
} from '../utils/pricing';
import { CostBreakdownBars, CostChart, TokenUsageChart } from './Charts';
import { ConfirmDialog } from './ConfirmDialog';

interface TokenUsagePageProps {
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  pricingCatalog: ModelPricing[];
  onRunTestGeneration: (params: {
    accountId: string;
    modelId: string;
    prompt: string;
  }) => Promise<{ ok: boolean; outputText?: string; error?: string }>;
  onUpdatePricing: (catalog: ModelPricing[]) => Promise<void>;
  onClearUsageHistory: () => Promise<void>;
  onExportCsv: (records: UsageRecord[]) => void;
  onExportBackup: () => void;
  onImportBackup: (rawJson: string) => Promise<void>;
}

export const TokenUsagePage: React.FC<TokenUsagePageProps> = ({
  accounts,
  usageLogs,
  pricingCatalog,
  onRunTestGeneration,
  onUpdatePricing,
  onClearUsageHistory,
  onExportCsv,
  onExportBackup,
  onImportBackup,
}) => {
  // Interactive Test Generation Request Runner state
  const enabledAccounts = accounts.filter((a) => a.enabled);
  const [testAccountId, setTestAccountId] = useState<string>(
    enabledAccounts[0]?.id || ''
  );
  const activeTestAccount =
    accounts.find((a) => a.id === testAccountId) || enabledAccounts[0];

  const availableGenModels = useMemo(() => {
    if (!activeTestAccount) return [];
    return activeTestAccount.discoveredModels.filter((m) =>
      m.supportedGenerationMethods.some((method) => ['generateContent', 'interactions'].includes(method))
    );
  }, [activeTestAccount]);

  const [testModelId, setTestModelId] = useState<string>('');
  const effectiveModelId =
    testModelId && availableGenModels.some((m) => m.id === testModelId)
      ? testModelId
      : availableGenModels[0]?.id || '';

  const [testPrompt, setTestPrompt] = useState(
    'Reply with a one-sentence confirmation that this Gemini model is responding.'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastTestOutput, setLastTestOutput] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Filters
  const [filters, setFilters] = useState<UsageFilters>({
    accountId: 'ALL',
    modelId: 'ALL',
    datePreset: '30d',
  });

  // Collapsible sections
  const [showPricingEditor, setShowPricingEditor] = useState(false);
  const [showUsageTable, setShowUsageTable] = useState(true);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // New custom pricing form
  const [newPattern, setNewPattern] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [newInRate, setNewInRate] = useState('0.15');
  const [newOutRate, setNewOutRate] = useState('0.60');
  const [newThinkRate, setNewThinkRate] = useState('0.60');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uniqueLoggedModels = useMemo(() => {
    const s = new Set<string>();
    for (const r of usageLogs) s.add(r.modelId);
    return Array.from(s).sort();
  }, [usageLogs]);

  const filteredLogs = useMemo(
    () => filterUsageRecords(usageLogs, filters),
    [usageLogs, filters]
  );

  const dailySeries = useMemo(
    () => aggregateDailyUsage(filteredLogs, pricingCatalog),
    [filteredLogs, pricingCatalog]
  );

  const byAccount = useMemo(
    () => groupUsageByAccount(filteredLogs, pricingCatalog),
    [filteredLogs, pricingCatalog]
  );

  const byModel = useMemo(
    () => groupUsageByModel(filteredLogs, pricingCatalog),
    [filteredLogs, pricingCatalog]
  );

  const totals = useMemo(() => {
    let promptTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let thinkingTokens = 0;
    let totalTokens = 0;
    let inputCostUsd = 0;
    let outputCostUsd = 0;
    let thinkingCostUsd = 0;
    let totalCostUsd = 0;

    for (const r of filteredLogs) {
      promptTokens += r.promptTokens;
      inputTokens += r.inputTokens;
      outputTokens += r.outputTokens;
      thinkingTokens += r.thinkingTokens;
      totalTokens += r.totalTokens;
      const c = calculateUsageCost(r, pricingCatalog);
      inputCostUsd += c.inputCostUsd;
      outputCostUsd += c.outputCostUsd;
      thinkingCostUsd += c.thinkingCostUsd;
      totalCostUsd += c.totalCostUsd;
    }

    // Also compute today and current month estimated costs across all logs
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let todayCostUsd = 0;
    let monthCostUsd = 0;
    for (const r of usageLogs) {
      const d = new Date(r.timestamp);
      const c = calculateUsageCost(r, pricingCatalog).totalCostUsd;
      if (d >= todayStart) todayCostUsd += c;
      if (d >= monthStart) monthCostUsd += c;
    }

    return {
      promptTokens,
      inputTokens,
      outputTokens,
      thinkingTokens,
      totalTokens,
      inputCostUsd,
      outputCostUsd,
      thinkingCostUsd,
      totalCostUsd,
      todayCostUsd,
      monthCostUsd,
    };
  }, [filteredLogs, usageLogs, pricingCatalog]);

  const handleTestRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTestAccount || !effectiveModelId || !testPrompt.trim()) return;
    setIsGenerating(true);
    setLastTestOutput(null);
    try {
      const res = await onRunTestGeneration({
        accountId: activeTestAccount.id,
        modelId: effectiveModelId,
        prompt: testPrompt.trim(),
      });
      setLastTestOutput({
        ok: res.ok,
        message: res.ok
          ? res.outputText || 'Request completed.'
          : res.error || 'Request failed.',
      });
    } catch (err) {
      setLastTestOutput({
        ok: false,
        message: err instanceof Error ? err.message : 'Request failed unexpectedly.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRateChange = (
    id: string,
    field: 'inputPerMillionUsd' | 'outputPerMillionUsd' | 'thinkingPerMillionUsd',
    value: string
  ) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return;
    const updated = pricingCatalog.map((item) =>
      item.id === id
        ? { ...item, [field]: num, updatedAt: new Date().toISOString() }
        : item
    );
    void onUpdatePricing(updated);
  };

  const handleAddPricingRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) return;
    const newItem: ModelPricing = {
      id: `price_custom_${Date.now()}`,
      modelPattern: newPattern.trim(),
      displayName: newDisplay.trim() || newPattern.trim(),
      inputPerMillionUsd: Number(newInRate) || 0,
      outputPerMillionUsd: Number(newOutRate) || 0,
      thinkingPerMillionUsd: Number(newThinkRate) || 0,
      notes: 'User-added rate',
      updatedAt: new Date().toISOString(),
    };
    void onUpdatePricing([newItem, ...pricingCatalog]);
    setNewPattern('');
    setNewDisplay('');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await onImportBackup(text);
    e.target.value = '';
  };

  return (
    <div className="token-usage-page space-y-6">
      {/* Explicit Test Generation Runner */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Test Generation Request (Records Real usageMetadata)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Only runs when you click Send Test Request. Uses your selected API key and discovered model directly without silent model substitution.
          </p>
        </div>

        {enabledAccounts.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add and enable at least one API key on the API Keys page to run a test generation request.
          </p>
        ) : (
          <form onSubmit={(e) => void handleTestRun(e)} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="test-account-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  API Key Account
                </label>
                <select
                  id="test-account-select"
                  value={activeTestAccount?.id || ''}
                  onChange={(e) => {
                    setTestAccountId(e.target.value);
                    setTestModelId('');
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                >
                  {enabledAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} ({acc.discoveredModels.length} models)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="test-model-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Discovered Model (generateContent)
                </label>
                <select
                  id="test-model-select"
                  value={effectiveModelId}
                  onChange={(e) => setTestModelId(e.target.value)}
                  disabled={availableGenModels.length === 0}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100 disabled:opacity-50"
                >
                  {availableGenModels.length === 0 ? (
                    <option value="">No discovered generateContent models</option>
                  ) : (
                    availableGenModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="test-prompt-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Test Prompt
              </label>
              <textarea
                id="test-prompt-input"
                rows={2}
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                App-Recorded Usage (does not include external traffic outside this app)
              </span>
              <button
                type="submit"
                disabled={isGenerating || !effectiveModelId || !testPrompt.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>{isGenerating ? 'Running Request...' : 'Send Test Request'}</span>
              </button>
            </div>
          </form>
        )}

        {lastTestOutput && (
          <div
            className={`rounded-xl border p-3.5 text-sm ${
              lastTestOutput.ok
                ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            {lastTestOutput.message}
          </div>
        )}
      </section>

      {/* Filters & Data Management */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={filters.accountId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, accountId: e.target.value }))
            }
            aria-label="Filter usage by API key"
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All API Keys</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountName}
              </option>
            ))}
          </select>

          <select
            value={filters.modelId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, modelId: e.target.value }))
            }
            aria-label="Filter usage by model"
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Models</option>
            {uniqueLoggedModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto" data-no-swipe="true">
            {(
              [
                ['today', 'Today'],
                ['7d', '7d'],
                ['30d', '30d'],
                ['all', 'All'],
                ['custom', 'Custom'],
              ] as Array<[DateFilterPreset, string]>
            ).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, datePreset: preset }))}
                className={`flex-1 min-h-[36px] px-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filters.datePreset === preset
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filters.datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <input
              type="date"
              value={filters.customStart || ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, customStart: e.target.value }))
              }
              aria-label="Start date"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="date"
              value={filters.customEnd || ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, customEnd: e.target.value }))
              }
              aria-label="End date"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
          </div>
        )}

        {/* Export / Import / Clear Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onExportCsv(filteredLogs)}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Usage CSV</span>
          </button>

          <button
            type="button"
            onClick={onExportBackup}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <FileJson className="w-4 h-4" />
            <span>Export JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>Import JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleImportFile(e)}
            className="hidden"
          />

          <button
            type="button"
            disabled={usageLogs.length === 0}
            onClick={() => setConfirmClearOpen(true)}
            className="min-h-[44px] px-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 inline-flex items-center gap-1.5 ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Usage History</span>
          </button>
        </div>
      </section>

      {/* Token & Cost Summary KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Filtered Tokens (App-Recorded)
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {totals.totalTokens.toLocaleString()}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {filteredLogs.length} requests
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Input / Output / Thinking
          </div>
          <div className="mt-1.5 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {totals.inputTokens.toLocaleString()} / {totals.outputTokens.toLocaleString()} /{' '}
            {totals.thinkingTokens.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            From GenerateContent usageMetadata
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Est. Filtered Cost (Not Billing)
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatUsd(totals.totalCostUsd)}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            In {formatUsd(totals.inputCostUsd)} · Out {formatUsd(totals.outputCostUsd)} · Think{' '}
            {formatUsd(totals.thinkingCostUsd)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Daily / Monthly Est. Cost
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatUsd(totals.todayCostUsd)} / {formatUsd(totals.monthCostUsd)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Today vs Current Month (Est.)
          </div>
        </div>
      </section>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            App-Recorded Token Consumption
          </h3>
          <TokenUsageChart data={dailySeries} />
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Estimated Cost by Day
          </h3>
          <CostChart data={dailySeries} />
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Usage & Cost by API Key
          </h3>
          <CostBreakdownBars
            items={byAccount}
            emptyMessage="No recorded usage across API keys for this filter."
          />
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Usage & Cost by Model
          </h3>
          <CostBreakdownBars
            items={byModel}
            emptyMessage="No recorded usage across models for this filter."
          />
        </section>
      </div>

      {/* Editable Pricing Catalog */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Estimated Pricing Table (USD per 1M Tokens)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update rates anytime to match official Gemini API pricing. Estimates are separate from actual Google Cloud billing charges.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void onUpdatePricing(DEFAULT_PRICING_CATALOG)}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => setShowPricingEditor((v) => !v)}
              aria-expanded={showPricingEditor}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              {showPricingEditor ? (
                <>
                  Hide <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Edit Pricing <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {showPricingEditor && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddPricingRule}
              className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
            >
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="Model pattern"
                aria-label="New model pattern"
                className="min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono sm:col-span-2"
              />
              <input
                type="number"
                step="0.001"
                min="0"
                value={newInRate}
                onChange={(e) => setNewInRate(e.target.value)}
                placeholder="Input $/1M"
                aria-label="New input rate per million"
                className="min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
              <input
                type="number"
                step="0.001"
                min="0"
                value={newOutRate}
                onChange={(e) => setNewOutRate(e.target.value)}
                placeholder="Output $/1M"
                aria-label="New output rate per million"
                className="min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
              <input
                type="number"
                step="0.001"
                min="0"
                value={newThinkRate}
                onChange={(e) => setNewThinkRate(e.target.value)}
                placeholder="Think $/1M"
                aria-label="New thinking rate per million"
                className="min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
              <button
                type="submit"
                className="min-h-[44px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            <div
              className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
              data-no-swipe="true"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                    <th className="px-3 py-2.5 font-semibold">Pattern</th>
                    <th className="px-3 py-2.5 font-semibold">Model Name</th>
                    <th className="px-3 py-2.5 font-semibold">Input ($/1M)</th>
                    <th className="px-3 py-2.5 font-semibold">Output ($/1M)</th>
                    <th className="px-3 py-2.5 font-semibold">Thinking ($/1M)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pricingCatalog.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {item.modelPattern}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {item.displayName}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.inputPerMillionUsd}
                          onChange={(e) =>
                            handleRateChange(
                              item.id,
                              'inputPerMillionUsd',
                              e.target.value
                            )
                          }
                          aria-label={`Input rate for ${item.modelPattern}`}
                          className="w-24 min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.outputPerMillionUsd}
                          onChange={(e) =>
                            handleRateChange(
                              item.id,
                              'outputPerMillionUsd',
                              e.target.value
                            )
                          }
                          aria-label={`Output rate for ${item.modelPattern}`}
                          className="w-24 min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.thinkingPerMillionUsd ?? item.outputPerMillionUsd}
                          onChange={(e) =>
                            handleRateChange(
                              item.id,
                              'thinkingPerMillionUsd',
                              e.target.value
                            )
                          }
                          aria-label={`Thinking rate for ${item.modelPattern}`}
                          className="w-24 min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono tabular-nums"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Request & Token Log Table */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Recorded Usage Log ({filteredLogs.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowUsageTable((v) => !v)}
            aria-expanded={showUsageTable}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            {showUsageTable ? (
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

        {showUsageTable && (
          <>
            {filteredLogs.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No usage records match the current filters.
              </p>
            ) : (
              <div
                className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
                data-no-swipe="true"
              >
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                      <th className="px-3 py-2.5 font-semibold">Timestamp</th>
                      <th className="px-3 py-2.5 font-semibold">Account</th>
                      <th className="px-3 py-2.5 font-semibold">Model</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Input</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Output</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Thinking</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Total</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLogs.map((log) => {
                      const cost = calculateUsageCost(log, pricingCatalog);
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-3 py-2 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {log.accountName}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {log.modelId}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={
                                log.status === 'SUCCESS'
                                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                  : 'text-rose-600 dark:text-rose-400 font-semibold'
                              }
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">
                            {log.inputTokens.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">
                            {log.outputTokens.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">
                            {log.thinkingTokens.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-semibold">
                            {log.totalTokens.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">
                            {cost.hasPricingMatch
                              ? formatUsd(cost.totalCostUsd)
                              : 'No rate'}
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
      </section>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear Usage History"
        description="Delete all recorded token usage logs? Your saved API keys, model lists, and pricing settings will NOT be deleted."
        confirmLabel="Clear Usage History"
        onConfirm={() => {
          void onClearUsageHistory();
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
