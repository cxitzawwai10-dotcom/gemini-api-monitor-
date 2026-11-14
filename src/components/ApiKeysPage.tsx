import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { ApiKeyAccount } from '../types/monitor';
import { formatRelativeTime, maskApiKey } from '../utils/health';
import { ConfirmDialog } from './ConfirmDialog';
import { StatusBadge } from './StatusBadge';

interface ApiKeysPageProps {
  accounts: ApiKeyAccount[];
  checkingKeyIds: Set<string>;
  onAddKey: (input: {
    accountName: string;
    googleAccountLabel?: string;
    projectLabel?: string;
    apiKey: string;
    enabled: boolean;
  }) => Promise<void>;
  onUpdateAccount: (
    accountId: string,
    patch: Partial<
      Pick<
        ApiKeyAccount,
        'accountName' | 'googleAccountLabel' | 'projectLabel' | 'enabled'
      >
    >
  ) => Promise<void>;
  onDeleteKey: (accountId: string) => Promise<void>;
  onCheckKey: (accountId: string) => Promise<void>;
  onCheckAll: () => Promise<void>;
  onCopyKey: (account: ApiKeyAccount) => Promise<boolean>;
}

export const ApiKeysPage: React.FC<ApiKeysPageProps> = ({
  accounts,
  checkingKeyIds,
  onAddKey,
  onUpdateAccount,
  onDeleteKey,
  onCheckKey,
  onCheckAll,
  onCopyKey,
}) => {
  const [showAddForm, setShowAddForm] = useState(accounts.length === 0);
  const [accountName, setAccountName] = useState('');
  const [googleAccountLabel, setGoogleAccountLabel] = useState('');
  const [projectLabel, setProjectLabel] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showInputKey, setShowInputKey] = useState(false);
  const [enabledInput, setEnabledInput] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGoogleAccount, setEditGoogleAccount] = useState('');
  const [editProject, setEditProject] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyAccount | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isCheckingAny = checkingKeyIds.size > 0;

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = accountName.trim();
    const trimmedKey = apiKeyInput.trim();
    if (!trimmedName) {
      setFormError('Please enter a custom account name.');
      return;
    }
    if (!trimmedKey) {
      setFormError('Please enter a Gemini API key.');
      return;
    }
    if (trimmedKey.length < 12) {
      setFormError('API key looks too short. Paste the full Gemini API key.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await onAddKey({
        accountName: trimmedName,
        googleAccountLabel: googleAccountLabel.trim() || undefined,
        projectLabel: projectLabel.trim() || undefined,
        apiKey: trimmedKey,
        enabled: enabledInput,
      });
      setAccountName('');
      setGoogleAccountLabel('');
      setProjectLabel('');
      setApiKeyInput('');
      setEnabledInput(true);
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (acc: ApiKeyAccount) => {
    setEditingId(acc.id);
    setEditName(acc.accountName);
    setEditGoogleAccount(acc.googleAccountLabel || '');
    setEditProject(acc.projectLabel || '');
  };

  const saveEdit = async (accountId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await onUpdateAccount(accountId, {
      accountName: trimmed,
      googleAccountLabel: editGoogleAccount.trim() || undefined,
      projectLabel: editProject.trim() || undefined,
    });
    setEditingId(null);
  };

  const handleCopy = async (account: ApiKeyAccount) => {
    const ok = await onCopyKey(account);
    if (!ok) return;
    setCopiedId(account.id);
    window.setTimeout(() => {
      setCopiedId((cur) => (cur === account.id ? null : cur));
    }, 1800);
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      acc.accountName.toLowerCase().includes(q) ||
      (acc.googleAccountLabel || '').toLowerCase().includes(q) ||
      (acc.projectLabel || '').toLowerCase().includes(q) ||
      acc.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter keys by account, project, or status..."
            aria-label="Filter API keys"
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Faistudio.google.com%2Fapp%2Fapikey&service=lso"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get a Gemini API key from Google AI Studio"
            className="min-h-[44px] px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            <span>Get API Key</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => void onCheckAll()}
            disabled={isCheckingAny || accounts.every((a) => !a.enabled)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${isCheckingAny ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Check All</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {showAddForm ? (
              <>
                <X className="w-4 h-4" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add API Key</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Key Form */}
      {showAddForm && (
        <form
          onSubmit={(e) => void handleSubmitAdd(e)}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Add Gemini API Key
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Stored locally in IndexedDB on this device. Automatically discovers models via the official Gemini Models endpoint upon saving.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="new-account-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Custom Account Name *
              </label>
              <input
                id="new-account-name"
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Personal AI Studio"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-google-account"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Google Account (optional)
              </label>
              <input
                id="new-google-account"
                type="text"
                value={googleAccountLabel}
                onChange={(e) => setGoogleAccountLabel(e.target.value)}
                placeholder="e.g., dev@gmail.com"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-project-label"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Google Cloud Project (optional)
              </label>
              <input
                id="new-project-label"
                type="text"
                value={projectLabel}
                onChange={(e) => setProjectLabel(e.target.value)}
                placeholder="e.g., gemini-prod-123"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-api-key"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Gemini API Key *
              </label>
              <div className="relative">
                <input
                  id="new-api-key"
                  type={showInputKey ? 'text' : 'password'}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full min-h-[44px] pl-3.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowInputKey((v) => !v)}
                  aria-label={showInputKey ? 'Hide API key input' : 'Show API key input'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showInputKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={enabledInput}
                onChange={(e) => setEnabledInput(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Enable automatic startup health check</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving & Checking...' : 'Save & Discover Models'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Key Cards */}
      {filteredAccounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
          <KeyRound className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {accounts.length === 0
              ? 'No Gemini API keys configured'
              : 'No keys match your search filter'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {accounts.length === 0
              ? 'Add an API key above to monitor health, discover models, and track token usage.'
              : 'Try clearing your search input.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredAccounts.map((acc) => {
            const isRevealed = revealedIds.has(acc.id);
            const isChecking = checkingKeyIds.has(acc.id);
            const isEditing = editingId === acc.id;
            const isCopied = copiedId === acc.id;

            return (
              <article
                key={acc.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label={`Edit account name for ${acc.accountName}`}
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-slate-100"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editGoogleAccount}
                          onChange={(e) => setEditGoogleAccount(e.target.value)}
                          placeholder="Google account"
                          aria-label="Google account label"
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          value={editProject}
                          onChange={(e) => setEditProject(e.target.value)}
                          placeholder="Cloud project"
                          aria-label="Cloud project label"
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEdit(acc.id)}
                          className="min-h-[40px] px-3 rounded-lg bg-blue-600 text-white text-xs font-medium"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                          {acc.accountName}
                        </h3>
                        <button
                          type="button"
                          onClick={() => startEdit(acc)}
                          aria-label={`Edit account name for ${acc.accountName}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {acc.googleAccountLabel || 'Unspecified Google account'}
                        {' · '}
                        {acc.projectLabel || 'Unspecified project'}
                      </div>
                    </div>
                  )}

                  <div className="shrink-0">
                    <StatusBadge
                      status={acc.status}
                      enabled={acc.enabled}
                      isChecking={isChecking}
                    />
                  </div>
                </div>

                {/* Masked / Revealed Key Box */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <code className="text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 break-all select-all">
                    {isRevealed ? acc.apiKey : maskApiKey(acc.apiKey)}
                  </code>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleReveal(acc.id)}
                      aria-label={
                        isRevealed
                          ? `Hide key for ${acc.accountName}`
                          : `Show key for ${acc.accountName}`
                      }
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                    >
                      {isRevealed ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy(acc)}
                      aria-label={`Copy key for ${acc.accountName}`}
                      className="min-h-[44px] px-3 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Key</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Timestamps & Model Count */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <span>Models: {acc.discoveredModels.length}</span>
                  <span aria-hidden="true">·</span>
                  <span>Checked: {formatRelativeTime(acc.lastCheckedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Last OK: {formatRelativeTime(acc.lastSuccessAt)}</span>
                </div>

                {/* Latest Error */}
                {acc.latestError && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs space-y-1">
                    <div className="font-semibold text-rose-700 dark:text-rose-400">
                      {acc.latestError.category}
                      {acc.latestError.httpStatus
                        ? ` · HTTP ${acc.latestError.httpStatus}`
                        : ''}
                    </div>
                    <p className="text-rose-800 dark:text-rose-200 break-words">
                      {acc.latestError.message}
                    </p>
                  </div>
                )}

                {/* Action Row */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isChecking || !acc.enabled}
                    onClick={() => void onCheckKey(acc.id)}
                    aria-label={`Test connection for ${acc.accountName}`}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Test Connection</span>
                  </button>

                  <button
                    type="button"
                    disabled={isChecking || !acc.enabled}
                    onClick={() => void onCheckKey(acc.id)}
                    aria-label={`Refresh models for ${acc.accountName}`}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateAccount(acc.id, { enabled: !acc.enabled })
                    }
                    aria-label={
                      acc.enabled
                        ? `Disable ${acc.accountName}`
                        : `Enable ${acc.accountName}`
                    }
                    className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Power className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{acc.enabled ? 'Disable' : 'Enable'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(acc)}
                    aria-label={`Delete ${acc.accountName}`}
                    className="min-h-[44px] px-3 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1.5 ml-auto whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete API Key"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.accountName}" (${maskApiKey(deleteTarget.apiKey)}) from this device? Any previously recorded token usage logs will remain unless cleared separately.`
            : ''
        }
        confirmLabel="Delete Key"
        onConfirm={() => {
          if (deleteTarget) {
            void onDeleteKey(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
