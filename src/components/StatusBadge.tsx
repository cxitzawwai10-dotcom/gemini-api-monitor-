import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Loader2,
  PauseCircle,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { KeyHealthStatus } from '../types/monitor';

interface StatusBadgeProps {
  status: KeyHealthStatus;
  enabled?: boolean;
  isChecking?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  enabled = true,
  isChecking = false,
}) => {
  if (isChecking) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        <span>CHECKING</span>
      </span>
    );
  }

  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
        <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>DISABLED</span>
      </span>
    );
  }

  switch (status) {
    case KeyHealthStatus.Ready:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>READY</span>
        </span>
      );
    case KeyHealthStatus.InvalidKey:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap shrink-0">
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>INVALID KEY</span>
        </span>
      );
    case KeyHealthStatus.QuotaExceeded:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>QUOTA EXCEEDED</span>
        </span>
      );
    case KeyHealthStatus.RateLimited:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400 whitespace-nowrap shrink-0">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>RATE LIMITED</span>
        </span>
      );
    case KeyHealthStatus.NetworkError:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 whitespace-nowrap shrink-0">
          <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
          <span>NETWORK ERROR</span>
        </span>
      );
    case KeyHealthStatus.NotChecked:
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">
          <CircleDashed className="w-3.5 h-3.5" aria-hidden="true" />
          <span>NOT CHECKED</span>
        </span>
      );
  }
};
