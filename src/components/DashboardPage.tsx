import React, { useMemo, useState } from 'react';
import { ApiErrorRecord, ApiKeyAccount, KeyHealthStatus, ModelPricing, UsageRecord } from '../types/monitor';

interface DashboardPageProps {
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  errorLogs: ApiErrorRecord[];
  pricingCatalog: ModelPricing[];
  checkingKeyIds: Set<string>;
  onNavigate: (page: import('../types/monitor').PageId) => void;
  onSelectAccount: (account: ApiKeyAccount) => void;
  onCheckAll: () => void;
  onClearErrors: () => void;
}

type Tab = 'Overview' | 'Quota' | 'Tokens' | 'Errors' | 'Models' | 'History';
const panel = 'rounded-lg border border-slate-700/70 bg-[#17243A] p-3';
const muted = 'text-[11px] text-slate-400';
const value = 'text-sm font-semibold text-slate-100 tabular-nums';

function statusLabel(account?: ApiKeyAccount) {
  if (!account) return 'NOT TESTED';
  if (account.status === KeyHealthStatus.Ready) return 'ACTIVE';
  if (account.status === KeyHealthStatus.InvalidKey) return 'INVALID';
  if (account.status === KeyHealthStatus.QuotaExceeded) return 'QUOTA EXCEEDED';
  if (account.status === KeyHealthStatus.NotChecked) return 'NOT TESTED';
  return 'ERROR';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  accounts, usageLogs, errorLogs, checkingKeyIds, onSelectAccount, onCheckAll, onClearErrors,
}) => {
  const [tab, setTab] = useState<Tab>('Overview');
  const [historyWindow, setHistoryWindow] = useState<'1H' | '24H' | '7D'>('24H');
  const [historyResult, setHistoryResult] = useState<'All' | 'Success' | 'Errors'>('All');
  const selected = accounts[0];
  const now = Date.now();
  const successful = usageLogs.filter((r) => r.status === 'SUCCESS');
  const failed = usageLogs.filter((r) => r.status === 'ERROR');
  const totalInput = usageLogs.reduce((n, r) => n + r.inputTokens, 0);
  const totalOutput = usageLogs.reduce((n, r) => n + r.outputTokens, 0);
  const totalTokens = usageLogs.reduce((n, r) => n + r.totalTokens, 0);
  const models = accounts.flatMap((a) => a.discoveredModels);
  const discovered = new Set(models.map((m) => m.id)).size;
  const generation = new Set(models.filter((m) => m.supportedGenerationMethods.includes('generateContent')).map((m) => m.id)).size;
  const requestsMinute = usageLogs.filter((r) => now - new Date(r.timestamp).getTime() <= 60_000).length;
  const requestsDay = usageLogs.filter((r) => now - new Date(r.timestamp).getTime() <= 86_400_000).length;
  const average = successful.length ? Math.round(successful.reduce((n, r) => n + r.totalTokens, 0) / successful.length) : 0;
  const lastTest = selected?.lastCheckedAt ? new Date(selected.lastCheckedAt) : null;
  const history = useMemo(() => {
    const windowMs = historyWindow === '1H' ? 3_600_000 : historyWindow === '24H' ? 86_400_000 : 604_800_000;
    const usage = usageLogs.map((r) => ({ time: r.timestamp, title: r.modelId, detail: r.status === 'SUCCESS' ? 'SUCCESS' : (r.errorMessage || 'ERROR'), result: r.status === 'SUCCESS' ? 'Success' : 'Errors' }));
    const errors = errorLogs.map((r) => ({ time: r.timestamp, title: r.modelId || r.category, detail: r.message, result: 'Errors' as const }));
    return [...usage, ...errors].filter((r) => now - new Date(r.time).getTime() <= windowMs).filter((r) => historyResult === 'All' || r.result === historyResult).sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0,50);
  }, [usageLogs, errorLogs, historyWindow, historyResult, now]);

  const tabs: Tab[] = ['Overview', 'Quota', 'Tokens', 'Errors', 'Models', 'History'];
  return (
    <div className="min-h-full space-y-3 text-slate-100">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider">LIVE DASHBOARD</h2>
        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400">LIVE</span>
      </div>
      <section className={panel}>
        <div className="flex items-center justify-between gap-2">
          <div><div className={muted}>SELECTED API KEY</div><div className="text-sm font-semibold">{selected?.accountName || 'No API Key Selected'}</div></div>
          <span className="rounded-full bg-slate-700 px-2 py-1 text-[10px] font-bold">{statusLabel(selected)}</span>
        </div>
        <div className={muted}>Last Test: {lastTest ? lastTest.toLocaleString() : '—'}</div>
        {selected && <button onClick={() => onSelectAccount(selected)} className="mt-2 text-xs text-sky-300 underline">View selected key details</button>}
      </section>
      <div className="grid grid-cols-2 gap-2">
        {[['Requests / Min', String(requestsMinute)], ['Requests / Day', String(requestsDay)], ['Input Tokens', totalInput.toLocaleString()], ['Output Tokens', totalOutput.toLocaleString()]].map(([label, amount]) => (
          <div className={panel} key={label}><div className={muted}>{label}</div><div className="mt-1 text-lg font-bold tabular-nums">{amount}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#101B2D] p-1">
        {tabs.map((name) => <button key={name} onClick={() => setTab(name)} className={`rounded-md px-1 py-2 text-[11px] font-semibold ${tab === name ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{name}</button>)}
      </div>
      {tab === 'Overview' && (
        <section className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-xs font-bold tracking-wider">OVERVIEW</h3><span className="text-[10px] text-emerald-400">LIVE</span></div>
          <div className={panel}><div className="flex justify-between"><b className="text-xs">API KEY {selected ? String(accounts.indexOf(selected)+1).padStart(2,'0') : '—'} · STATUS</b><span className="text-[10px] text-emerald-400">{statusLabel(selected)}</span></div><div className={muted}>Validity: —</div><div className={muted}>Connection: {selected?.lastSuccessAt ? 'Connected' : '—'}</div></div>
          <div className={panel}><b className="text-xs">LAST TEST</b><div className={muted}>Result: {selected ? statusLabel(selected) : '—'}</div><div className={muted}>Time: {lastTest ? lastTest.toLocaleString() : '—'}</div><div className={muted}>Error: {selected?.latestError?.message || '—'}</div></div>
          <div className={panel}><b className="text-xs">REQUESTS</b><div className={muted}>Total: {usageLogs.length}</div><div className={muted}>Success: {successful.length}</div><div className={muted}>Failed: {failed.length + errorLogs.length}</div></div>
          <div className={panel}><b className="text-xs">MODELS</b><div className={muted}>Discovery: {selected?.discoveredModels.length ?? '—'}</div><div className={muted}>Generation: {selected?.discoveredModels.filter(m => m.supportedGenerationMethods.includes('generateContent')).length ?? '—'}</div></div>
          <div className="flex items-center justify-between px-1 py-1"><span className={muted}>Auto Refresh</span><b className="text-xs">60 sec</b></div>
          <button onClick={onCheckAll} disabled={checkingKeyIds.size > 0 || !accounts.some(a => a.enabled)} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold disabled:opacity-40">{checkingKeyIds.size ? 'TESTING KEYS…' : 'REFRESH KEY STATUS'}</button>
        </section>
      )}
      {tab === 'Quota' && <section className={panel}><h3 className="mb-2 text-xs font-bold">QUOTA</h3>{['Requests','Tokens'].map(x => <div key={x} className="mb-3"><div className="flex justify-between text-xs"><b>{x}</b><span className="text-slate-400">Unavailable</span></div><div className="mt-1 h-2 rounded-full bg-slate-700"><div className="h-2 w-0 rounded-full bg-sky-500" /></div><div className={muted}>Limit: Unavailable · Remaining: Unavailable</div></div>)}<p className={muted}>Google Gemini API key endpoints do not expose project quota remaining values.</p></section>}
      {tab === 'Tokens' && <section className={panel}><h3 className="mb-3 text-xs font-bold">TOKEN USAGE</h3>{[['Input Tokens', totalInput],['Output Tokens', totalOutput],['Total Tokens', totalTokens],['Average Tokens / Request', average]].map(([k,v]) => <div className="flex justify-between border-b border-slate-700 py-2 last:border-0" key={String(k)}><span className="text-xs text-slate-400">{k}</span><b className={value}>{Number(v).toLocaleString()}</b></div>)}</section>}
      {tab === 'Errors' && <section className={panel}><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold">ERROR DETAILS</h3><button onClick={onClearErrors} disabled={!errorLogs.length} className="text-[10px] text-rose-300 disabled:opacity-40">CLEAR</button></div><div className={muted}>Total Recorded Errors: {errorLogs.length}</div>{errorLogs.slice(0,20).map(e => <div className="border-t border-slate-700 py-2" key={e.id}><b className="text-xs">{e.apiStatus || e.category} · HTTP {e.httpStatus ?? '—'}</b><div className={muted}>{e.message}</div><div className={muted}>Model: {e.modelId || '—'} · {new Date(e.timestamp).toLocaleString()}</div></div>)}{!errorLogs.length && <div className={muted}>No recorded errors</div>}</section>}
      {tab === 'Models' && <section className={panel}><h3 className="mb-2 text-xs font-bold">MODEL STATUS</h3><div className="mb-2"><div className="text-xs font-semibold">Model Discovery</div><div className={muted}>Discovered: {selected?.discoveredModels.length ?? '—'}</div></div><div className="border-t border-slate-700 pt-2"><div className="text-xs font-semibold">generateContent Support / Test</div>{selected?.discoveredModels.map(m => <div className="flex justify-between gap-2 py-1" key={m.id}><span className="truncate text-[11px]">{m.id}</span><span className={m.supportedGenerationMethods.includes('generateContent') ? 'text-[10px] text-emerald-400' : 'text-[10px] text-rose-300'}>{m.supportedGenerationMethods.includes('generateContent') ? 'SUPPORTED' : 'NOT SUPPORTED'}</span></div>) || <div className={muted}>No discovered models</div>}</div></section>}
      {tab === 'History' && <section className={panel}><h3 className="mb-2 text-xs font-bold">HISTORY</h3><div className="mb-2 grid grid-cols-3 gap-1">{(['1H','24H','7D'] as const).map(x => <button key={x} onClick={() => setHistoryWindow(x)} className={`rounded-md py-1 text-[10px] ${historyWindow===x?'bg-blue-600 text-white':'bg-slate-700 text-slate-300'}`}>{x}</button>)}</div><div className="mb-2 grid grid-cols-3 gap-1">{(['All','Success','Errors'] as const).map(x => <button key={x} onClick={() => setHistoryResult(x)} className={`rounded-md py-1 text-[10px] ${historyResult===x?'bg-blue-600 text-white':'bg-slate-700 text-slate-300'}`}>{x}</button>)}</div>{history.map((item,i) => <div key={item.time+item.title+i} className="border-t border-slate-700 py-2"><div className="flex justify-between gap-2"><b className="truncate text-xs">{item.title}</b><span className="text-[10px] text-slate-400">{item.result}</span></div><div className={muted}>{item.detail}</div><div className={muted}>{new Date(item.time).toLocaleString()}</div></div>)}{!history.length && <div className={muted}>No history records</div>}</section>}
    </div>
  );
};
