import React from 'react';
import { DailySeriesPoint, GroupedCostSummary } from '../utils/filtering';
import { formatUsd } from '../utils/pricing';

interface TokenDistributionDonutProps {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
}

export const TokenDistributionDonut: React.FC<TokenDistributionDonutProps> = ({
  inputTokens,
  outputTokens,
  thinkingTokens,
}) => {
  const total = inputTokens + outputTokens + thinkingTokens;
  if (total <= 0) {
    return (
      <div className="min-w-[150px] text-center text-xs text-slate-500 dark:text-slate-400">
        Token distribution will appear after a successful test request.
      </div>
    );
  }

  const inputEnd = (inputTokens / total) * 360;
  const outputEnd = inputEnd + (outputTokens / total) * 360;
  const gradient = `conic-gradient(#3b82f6 0deg ${inputEnd}deg, #a855f7 ${inputEnd}deg ${outputEnd}deg, #22c55e ${outputEnd}deg 360deg)`;

  return (
    <div className="flex flex-col items-center gap-3 min-w-[150px]">
      <div
        className="relative h-36 w-36 rounded-full p-3 shadow-[0_10px_24px_rgba(0,0,0,.3),inset_0_2px_5px_rgba(255,255,255,.2)]"
        style={{ background: gradient }}
        role="img"
        aria-label={`Token distribution: ${inputTokens} input, ${outputTokens} output, ${thinkingTokens} thinking tokens`}
      >
        <div className="h-full w-full rounded-full bg-[#101a35] border border-white/10 flex flex-col items-center justify-center shadow-inner">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Total</span>
          <strong className="text-xl font-bold font-mono text-white tabular-nums">{total.toLocaleString()}</strong>
          <span className="text-[10px] text-slate-400">tokens</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full text-[11px]">
        <div className="text-center"><span className="block h-2 w-2 rounded-full bg-blue-500 mx-auto mb-1" /><span className="text-slate-400">Input</span><strong className="block text-slate-100 font-mono">{inputTokens.toLocaleString()}</strong></div>
        <div className="text-center"><span className="block h-2 w-2 rounded-full bg-purple-500 mx-auto mb-1" /><span className="text-slate-400">Output</span><strong className="block text-slate-100 font-mono">{outputTokens.toLocaleString()}</strong></div>
        <div className="text-center"><span className="block h-2 w-2 rounded-full bg-green-500 mx-auto mb-1" /><span className="text-slate-400">Thinking</span><strong className="block text-slate-100 font-mono">{thinkingTokens.toLocaleString()}</strong></div>
      </div>
    </div>
  );
};

interface TokenChartProps {
  data: DailySeriesPoint[];
}

export const TokenUsageChart: React.FC<TokenChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 px-4 text-center">
        No recorded token usage yet. Run an explicit Test Generation Request on Token Usage to record real usageMetadata.
      </div>
    );
  }

  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);
  const visible = data.slice(-14);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Daily Token Breakdown (App-Recorded)</span>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-blue-600 dark:bg-blue-500" />
            Input
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500" />
            Output
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
            Thinking
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div
          className="flex items-end gap-2 h-44 pt-4 pb-1 px-1 overflow-x-auto"
          data-no-swipe="true"
        >
          {visible.map((point) => {
            const totalPct = Math.max(
              4,
              Math.round((point.totalTokens / maxTokens) * 100)
            );
            const inPct =
              point.totalTokens > 0
                ? (point.inputTokens / point.totalTokens) * 100
                : 0;
            const outPct =
              point.totalTokens > 0
                ? (point.outputTokens / point.totalTokens) * 100
                : 0;
            const thinkPct = Math.max(0, 100 - inPct - outPct);

            return (
              <div
                key={point.dateKey}
                className="flex-1 min-w-[36px] flex flex-col items-center gap-1.5 h-full justify-end group"
              >
                <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  {point.totalTokens >= 1000
                    ? `${(point.totalTokens / 1000).toFixed(1)}k`
                    : point.totalTokens}
                </span>
                <div
                  className="w-full max-w-[36px] rounded-t-md overflow-hidden flex flex-col justify-end bg-slate-100 dark:bg-slate-800/80"
                  style={{ height: `${totalPct}%` }}
                  title={`${point.label}: ${point.totalTokens.toLocaleString()} tokens (${point.requests} req)`}
                >
                  {thinkPct > 0 && (
                    <div
                      className="w-full bg-amber-500"
                      style={{ height: `${thinkPct}%` }}
                    />
                  )}
                  {outPct > 0 && (
                    <div
                      className="w-full bg-emerald-600 dark:bg-emerald-500"
                      style={{ height: `${outPct}%` }}
                    />
                  )}
                  {inPct > 0 && (
                    <div
                      className="w-full bg-blue-600 dark:bg-blue-500"
                      style={{ height: `${inPct}%` }}
                    />
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface CostChartProps {
  data: DailySeriesPoint[];
}

export const CostChart: React.FC<CostChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 px-4 text-center">
        No estimated cost data yet. Estimated costs are calculated from recorded Gemini requests and your configured pricing rates.
      </div>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.costUsd), 0.000001);
  const visible = data.slice(-14);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Daily Estimated Cost (USD)</span>
        <span>Not actual Google billing</span>
      </div>
      <div
        className="flex items-end gap-2 h-44 pt-4 pb-1 px-1 overflow-x-auto"
        data-no-swipe="true"
      >
        {visible.map((point) => {
          const heightPct = Math.max(
            4,
            Math.round((point.costUsd / maxCost) * 100)
          );
          return (
            <div
              key={point.dateKey}
              className="flex-1 min-w-[40px] flex flex-col items-center gap-1.5 h-full justify-end"
            >
              <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                {formatUsd(point.costUsd)}
              </span>
              <div
                className="w-full max-w-[36px] rounded-t-md bg-indigo-600 dark:bg-indigo-500 transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${point.label}: ${formatUsd(point.costUsd)}`}
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface BreakdownBarsProps {
  items: GroupedCostSummary[];
  emptyMessage: string;
}

export const CostBreakdownBars: React.FC<BreakdownBarsProps> = ({
  items,
  emptyMessage,
}) => {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
        {emptyMessage}
      </p>
    );
  }

  const maxTokens = Math.max(...items.map((i) => i.totalTokens), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.max(3, Math.round((item.totalTokens / maxTokens) * 100));
        return (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {item.label}
              </span>
              <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300 shrink-0">
                {item.totalTokens.toLocaleString()} tok · {formatUsd(item.totalCostUsd)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
