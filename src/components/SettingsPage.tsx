import React, { useRef, useState } from 'react';
import {
  Download,
  Moon,
  ShieldAlert,
  Sun,
  Upload,
} from 'lucide-react';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  accountCount: number;
  usageCount: number;
  onExportBackup: () => void;
  onImportBackup: (rawJson: string) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  onToggleTheme,
  accountCount,
  usageCount,
  onExportBackup,
  onImportBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setMessage('');
    try {
      const rawJson = await file.text();
      await onImportBackup(rawJson);
      setMessage('Backup import completed. Check the dashboard for updated data.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import this backup file.');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Appearance</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose the display theme for this device.</p>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="min-h-[48px] w-full sm:w-auto px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          Switch to {theme === 'dark' ? 'Light' : 'Dark'} Theme
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Local Data Backup</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Export or restore API key accounts, usage history, error history and monitor settings on this device.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">Saved API key accounts</div>
            <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{accountCount}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">Usage records</div>
            <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{usageCount}</div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            className="min-h-[46px] flex-1 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Backup
          </button>
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[46px] flex-1 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {isImporting ? 'Importing…' : 'Import Backup'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleImport(event)} />
        </div>
        {message && <p role="status" className="text-xs text-slate-600 dark:text-slate-300 break-words">{message}</p>}
      </section>

      <section className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-5 h-5" />
          <h2 className="text-sm font-bold">API Key Security</h2>
        </div>
        <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          API keys and monitor records are stored in this browser or app's local IndexedDB database. This app does not currently encrypt saved API keys. Do not share backup files, avoid using this app on shared devices, and revoke a key in Google AI Studio if you believe it was exposed.
        </p>
      </section>
    </div>
  );
};
