import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import {
  ApiErrorRecord,
  ApiKeyAccount,
  KeyHealthStatus,
  ModelPricing,
  PageId,
  QuotaReferenceLimit,
  UsageRecord,
} from './types/monitor';
import { DEFAULT_PRICING_CATALOG } from './utils/pricing';
import { buildErrorRecord } from './utils/health';
import {
  createBackupJson,
  generateUsageCsv,
  parseBackupJson,
} from './utils/export';
import {
  checkKeyAndDiscoverModels,
  runGenerateContentTest,
} from './services/geminiApi';
import {
  clearErrorHistoryStore,
  clearUsageHistoryStore,
  loadAllMonitorData,
  removeAccount,
  replaceAllFromBackup,
  saveAccount,
  saveErrorRecord,
  savePricingCatalog,
  saveQuotaReferences,
  saveUsageRecord,
} from './services/storage';
import { useSwipeNavigation } from './hooks/useSwipeNavigation';
import { LayoutShell, NAV_ITEMS } from './components/LayoutShell';
import { DashboardPage } from './components/DashboardPage';
import { ApiKeysPage } from './components/ApiKeysPage';
import { ModelsPage } from './components/ModelsPage';
import { QuotaMonitorPage } from './components/QuotaMonitorPage';
import { TokenUsagePage } from './components/TokenUsagePage';
import { SettingsPage } from './components/SettingsPage';
import { AccountDetailModal } from './components/AccountDetailModal';

interface ToastState {
  id: number;
  type: 'success' | 'error';
  message: string;
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(PageId.Dashboard);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  const [isHydrating, setIsHydrating] = useState(true);
  const [accounts, setAccounts] = useState<ApiKeyAccount[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageRecord[]>([]);
  const [errorLogs, setErrorLogs] = useState<ApiErrorRecord[]>([]);
  const [pricingCatalog, setPricingCatalog] = useState<ModelPricing[]>(
    DEFAULT_PRICING_CATALOG
  );
  const [quotaReferences, setQuotaReferences] = useState<QuotaReferenceLimit[]>(
    []
  );

  const [checkingKeyIds, setCheckingKeyIds] = useState<Set<string>>(new Set());
  const inFlightChecksRef = useRef<Set<string>>(new Set());
  const accountsRef = useRef<ApiKeyAccount[]>([]);
  accountsRef.current = accounts;

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      const id = Date.now();
      setToast({ id, type, message });
      window.setTimeout(() => {
        setToast((cur) => (cur?.id === id ? null : cur));
      }, 3200);
    },
    []
  );

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('gp_theme', next);
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  };

  /**
   * Checks a single API key using the lightweight Models List endpoint.
   * Prevents duplicate or overlapping checks on the same key ID.
   */
  const checkSingleAccount = useCallback(
    async (accountId: string, overrideAccount?: ApiKeyAccount) => {
      if (inFlightChecksRef.current.has(accountId)) {
        return;
      }

      const target =
        overrideAccount ||
        accountsRef.current.find((a) => a.id === accountId);
      if (!target || !target.enabled) {
        return;
      }

      inFlightChecksRef.current.add(accountId);
      setCheckingKeyIds(new Set(inFlightChecksRef.current));

      try {
        const result = await checkKeyAndDiscoverModels(target.apiKey);

        // Read latest version of account in case user edited its name while request ran
        const latestAcc =
          accountsRef.current.find((a) => a.id === accountId) || target;

        const updatedAccount: ApiKeyAccount = {
          ...latestAcc,
          status: result.status,
          lastCheckedAt: result.checkedAt,
          lastSuccessAt: result.ok ? result.checkedAt : latestAcc.lastSuccessAt,
          latestError: result.ok ? undefined : result.errorInfo,
          discoveredModels: result.ok
            ? result.models
            : latestAcc.discoveredModels,
          modelDiscoveryError: result.ok
            ? undefined
            : result.errorInfo?.message,
          modelsUpdatedAt: result.ok
            ? result.checkedAt
            : latestAcc.modelsUpdatedAt,
          updatedAt: result.checkedAt,
        };

        await saveAccount(updatedAccount);
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? updatedAccount : a))
        );

        if (!result.ok && result.errorInfo) {
          const errRec = buildErrorRecord(updatedAccount, result.errorInfo);
          await saveErrorRecord(errRec);
          setErrorLogs((prev) => [errRec, ...prev]);
        }
      } catch (err) {
        showToast(
          'error',
          err instanceof Error
            ? `Could not save the API check result: ${err.message}`
            : 'Could not save the API check result. Please try again.'
        );
      } finally {
        inFlightChecksRef.current.delete(accountId);
        setCheckingKeyIds(new Set(inFlightChecksRef.current));
      }
    },
    []
  );

  const checkAllEnabledKeys = useCallback(
    async (explicitAccounts?: ApiKeyAccount[]) => {
      const list = explicitAccounts || accountsRef.current;
      const enabled = list.filter((a) => a.enabled);
      await Promise.allSettled(
        enabled.map((acc) => checkSingleAccount(acc.id, acc))
      );
    },
    [checkSingleAccount]
  );

  // Hydrate from IndexedDB on startup & run automatic health checks on enabled keys
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadAllMonitorData();
      if (cancelled) return;
      setAccounts(data.accounts);
      setUsageLogs(data.usageLogs);
      setErrorLogs(data.errorLogs);
      setPricingCatalog(data.pricingCatalog);
      setQuotaReferences(data.quotaReferences);
      setIsHydrating(false);

      if (data.accounts.some((a) => a.enabled)) {
        void checkAllEnabledKeys(data.accounts);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkAllEnabledKeys]);

  const handleAddKey = async (input: {
    accountName: string;
    googleAccountLabel?: string;
    projectLabel?: string;
    apiKey: string;
    enabled: boolean;
  }) => {
    const now = new Date().toISOString();
    const newAccount: ApiKeyAccount = {
      id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      accountName: input.accountName,
      googleAccountLabel: input.googleAccountLabel,
      projectLabel: input.projectLabel,
      apiKey: input.apiKey,
      enabled: input.enabled,
      status: KeyHealthStatus.NotChecked,
      discoveredModels: [],
      createdAt: now,
      updatedAt: now,
    };

    await saveAccount(newAccount);
    setAccounts((prev) => [...prev, newAccount]);
    showToast('success', `Saved "${newAccount.accountName}".`);

    if (newAccount.enabled) {
      await checkSingleAccount(newAccount.id, newAccount);
    }
  };

  const handleUpdateAccount = async (
    accountId: string,
    patch: Partial<
      Pick<
        ApiKeyAccount,
        'accountName' | 'googleAccountLabel' | 'projectLabel' | 'enabled'
      >
    >
  ) => {
    const target = accountsRef.current.find((a) => a.id === accountId);
    if (!target) return;

    const updated: ApiKeyAccount = {
      ...target,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await saveAccount(updated);
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? updated : a))
    );
    showToast('success', `Updated "${updated.accountName}".`);
  };

  const handleDeleteKey = async (accountId: string) => {
    const target = accountsRef.current.find((a) => a.id === accountId);
    await removeAccount(accountId);
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    if (selectedAccountId === accountId) {
      setSelectedAccountId(null);
    }
    showToast(
      'success',
      target ? `Deleted "${target.accountName}".` : 'API key deleted.'
    );
  };

  const handleCopyKey = async (account: ApiKeyAccount): Promise<boolean> => {
    const exactKey = account.apiKey;
    let copied = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(exactKey);
        copied = true;
      }
    } catch {
      // Fall back to execCommand below when Clipboard API permission is denied
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = exactKey;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      showToast('success', `Copied full API key for "${account.accountName}".`);
      return true;
    }

    showToast(
      'error',
      `Could not copy API key for "${account.accountName}". Check browser clipboard permissions.`
    );
    return false;
  };

  const handleRunTestGeneration = async (params: {
    accountId: string;
    modelId: string;
    prompt: string;
  }) => {
    const acc = accountsRef.current.find((a) => a.id === params.accountId);
    if (!acc) {
      return { ok: false, error: 'Selected API key account not found.' };
    }

    // Require an explicit GenerateContent capability from the Models API before sending.
    const cleanModelId = params.modelId.replace(/^models\\//, '');
    const selectedModel = acc.discoveredModels.find((model) => model.id === cleanModelId);
    if (!selectedModel) {
      const message = 'This model was not discovered for the selected API key. Refresh models and choose a listed model.';
      showToast('error', message);
      return { ok: false, error: message };
    }
    if (!selectedModel.supportedGenerationMethods.includes('generateContent')) {
      const methods = selectedModel.supportedGenerationMethods;
      const message = methods.length
        ? 'This model does not support GenerateContent. Supported methods: ' + methods.join(', ') + '.'
        : 'This model has no supported generation methods listed by the Models API, so GenerateContent is blocked.';
      showToast('error', message);
      return { ok: false, error: message };
    }

    const res = await runGenerateContentTest({
      apiKey: acc.apiKey,
      modelId: selectedModel.id,
      prompt: params.prompt,
    });

    const usageRec: UsageRecord = {
      id: `use_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      accountId: acc.id,
      accountName: acc.accountName,
      modelId: params.modelId,
      promptTokens: res.promptTokens,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      thinkingTokens: res.thinkingTokens,
      totalTokens: res.totalTokens,
      status: res.ok ? 'SUCCESS' : 'ERROR',
      httpStatus: res.httpStatus,
      errorMessage: res.errorInfo?.message,
      latencyMs: res.latencyMs,
      timestamp: res.timestamp,
      source: 'APP_GENERATE_CONTENT',
      promptPreview: params.prompt.slice(0, 80),
    };

    await saveUsageRecord(usageRec);
    setUsageLogs((prev) => [usageRec, ...prev]);

    if (!res.ok && res.errorInfo) {
      const errRec = buildErrorRecord(acc, res.errorInfo);
      await saveErrorRecord(errRec);
      setErrorLogs((prev) => [errRec, ...prev]);
      return { ok: false, error: res.errorInfo.message };
    }

    showToast(
      'success',
      `Recorded ${res.totalTokens.toLocaleString()} tokens from ${params.modelId}.`
    );
    return { ok: true, outputText: res.text };
  };

  const handleUpdatePricing = async (catalog: ModelPricing[]) => {
    await savePricingCatalog(catalog);
    setPricingCatalog(catalog);
  };

  const handleSaveQuotaReference = async (ref: QuotaReferenceLimit) => {
    const next = [
      ...quotaReferences.filter((q) => q.accountId !== ref.accountId),
      ref,
    ];
    await saveQuotaReferences(next);
    setQuotaReferences(next);
    showToast('success', 'Saved reference tier limits.');
  };

  const handleClearUsageHistory = async () => {
    await clearUsageHistoryStore();
    setUsageLogs([]);
    showToast('success', 'Cleared token usage history. API keys preserved.');
  };

  const handleClearErrors = async () => {
    await clearErrorHistoryStore();
    setErrorLogs([]);
    showToast('success', 'Cleared error history.');
  };

  const handleExportCsv = (records: UsageRecord[]) => {
    const csv = generateUsageCsv(records, pricingCatalog);
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(
      `geminipulse-usage-${stamp}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    showToast('success', `Exported ${records.length} usage records to CSV.`);
  };

  const handleExportBackup = () => {
    const json = createBackupJson({
      accounts,
      usageLogs,
      errorLogs,
      pricingCatalog,
      quotaReferences,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(
      `geminipulse-backup-${stamp}.json`,
      json,
      'application/json'
    );
    showToast('success', 'Exported full local backup JSON.');
  };

  const handleImportBackup = async (rawJson: string) => {
    try {
      const parsed = parseBackupJson(rawJson);
      const nextPricing =
        parsed.pricingCatalog.length > 0
          ? parsed.pricingCatalog
          : pricingCatalog;

      await replaceAllFromBackup({
        accounts: parsed.accounts,
        usageLogs: parsed.usageLogs,
        errorLogs: parsed.errorLogs,
        pricingCatalog: nextPricing,
        quotaReferences: parsed.quotaReferences,
      });

      setAccounts(parsed.accounts);
      setUsageLogs(parsed.usageLogs);
      setErrorLogs(parsed.errorLogs);
      setPricingCatalog(nextPricing);
      setQuotaReferences(parsed.quotaReferences);
      showToast(
        'success',
        `Imported ${parsed.accounts.length} keys and ${parsed.usageLogs.length} usage records.`
      );

      if (parsed.accounts.some((a) => a.enabled)) {
        void checkAllEnabledKeys(parsed.accounts);
      }
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Failed to import backup JSON.'
      );
    }
  };

  // Touch left/right swipe navigation across the 5 main pages
  const pageOrder = NAV_ITEMS.map((item) => item.id);
  const swipeHandlers = useSwipeNavigation({
    enabled: !selectedAccountId,
    onSwipeLeft: () => {
      const idx = pageOrder.indexOf(activePage);
      if (idx < pageOrder.length - 1) {
        setActivePage(pageOrder[idx + 1]);
      }
    },
    onSwipeRight: () => {
      const idx = pageOrder.indexOf(activePage);
      if (idx > 0) {
        setActivePage(pageOrder[idx - 1]);
      }
    },
  });

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) || null;

  return (
    <>
      <LayoutShell
        activePage={activePage}
        onNavigate={setActivePage}
        theme={theme}
        onToggleTheme={toggleTheme}
        isCheckingAll={checkingKeyIds.size > 0}
        hasEnabledKeys={accounts.some((a) => a.enabled)}
        onCheckAll={() => void checkAllEnabledKeys()}
        swipeHandlers={swipeHandlers}
      >
        {isHydrating ? (
          <div className="flex items-center justify-center py-20 gap-3 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading saved API keys & monitor data...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              {activePage === PageId.Dashboard && (
                <DashboardPage
                  accounts={accounts}
                  usageLogs={usageLogs}
                  errorLogs={errorLogs}
                  pricingCatalog={pricingCatalog}
                  checkingKeyIds={checkingKeyIds}
                  onNavigate={setActivePage}
                  onSelectAccount={(acc) => setSelectedAccountId(acc.id)}
                  onCheckAll={() => void checkAllEnabledKeys()}
                  onClearErrors={() => void handleClearErrors()}
                />
              )}

              {activePage === PageId.ApiKeys && (
                <ApiKeysPage
                  accounts={accounts}
                  checkingKeyIds={checkingKeyIds}
                  onAddKey={handleAddKey}
                  onUpdateAccount={handleUpdateAccount}
                  onDeleteKey={handleDeleteKey}
                  onCheckKey={(id) => checkSingleAccount(id)}
                  onCheckAll={() => checkAllEnabledKeys()}
                  onCopyKey={handleCopyKey}
                />
              )}

              {activePage === PageId.Models && (
                <ModelsPage
                  accounts={accounts}
                  checkingKeyIds={checkingKeyIds}
                  onRefreshKey={(id) => checkSingleAccount(id)}
                />
              )}

              {activePage === PageId.QuotaMonitor && (
                <QuotaMonitorPage
                  accounts={accounts}
                  usageLogs={usageLogs}
                  quotaReferences={quotaReferences}
                  onSaveQuotaReference={handleSaveQuotaReference}
                />
              )}

              {activePage === PageId.TokenUsage && (
                <TokenUsagePage
                  accounts={accounts}
                  usageLogs={usageLogs}
                  pricingCatalog={pricingCatalog}
                  onRunTestGeneration={handleRunTestGeneration}
                  onUpdatePricing={handleUpdatePricing}
                  onClearUsageHistory={handleClearUsageHistory}
                  onExportCsv={handleExportCsv}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                />
              )}

              {activePage === PageId.Settings && (
                <SettingsPage
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  accountCount={accounts.length}
                  usageCount={usageLogs.length}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </LayoutShell>

      <AccountDetailModal
        account={selectedAccount}
        usageLogs={usageLogs}
        errorLogs={errorLogs}
        pricingCatalog={pricingCatalog}
        isChecking={
          selectedAccount ? checkingKeyIds.has(selectedAccount.id) : false
        }
        onClose={() => setSelectedAccountId(null)}
        onCheckKey={(id) => void checkSingleAccount(id)}
        onCopyKey={(acc) => void handleCopyKey(acc)}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-18 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:max-w-sm rounded-xl border px-3.5 py-2.5 shadow-lg flex items-center gap-2.5 text-xs sm:text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-slate-100'
              : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
