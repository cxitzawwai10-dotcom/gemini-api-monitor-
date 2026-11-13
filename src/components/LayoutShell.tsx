import React from 'react';
import {
  Activity,
  Cpu,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Moon,
  RefreshCw,
  Sun,
  Settings,
} from 'lucide-react';
import { PageId } from '../types/monitor';
import { OfflineIndicator, PWAInstallButton } from './PWAComponents';

export interface NavItem {
  id: PageId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: PageId.Dashboard,
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: LayoutDashboard,
  },
  {
    id: PageId.ApiKeys,
    label: 'API Keys',
    shortLabel: 'Keys',
    icon: KeyRound,
  },
  {
    id: PageId.Models,
    label: 'Models',
    shortLabel: 'Models',
    icon: Cpu,
  },
  {
    id: PageId.QuotaMonitor,
    label: 'Quota Monitor',
    shortLabel: 'Quota',
    icon: Gauge,
  },
  {
    id: PageId.TokenUsage,
    label: 'Token Usage',
    shortLabel: 'Usage',
    icon: Activity,
  },
  {
    id: PageId.Settings,
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings,
  },
];

interface LayoutShellProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isCheckingAll: boolean;
  hasEnabledKeys: boolean;
  onCheckAll: () => void;
  swipeHandlers: {
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchEnd: (e: React.TouchEvent<HTMLElement>) => void;
  };
  children: React.ReactNode;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({
  activePage,
  onNavigate,
  theme,
  onToggleTheme,
  isCheckingAll,
  hasEnabledKeys,
  onCheckAll,
  swipeHandlers,
  children,
}) => {
  const currentNav =
    NAV_ITEMS.find((item) => item.id === activePage) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <img
            src="/icon.svg"
            alt="GeminiPulse icon"
            className="w-8 h-8 rounded-lg shrink-0"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            GeminiPulse
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activePage;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4" />
                <span>Light Theme</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                <span>Dark Theme</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Compact Top Bar (<= 52px on mobile to honor 15% sticky budget) */}
        <header className="sticky top-0 z-30 h-13 lg:h-16 px-3.5 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 pt-safe">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/icon.svg"
              alt="Gemini API Monitor"
              className="w-7 h-7 rounded-lg lg:hidden shrink-0"
            />
            <h1 className="font-display text-sm sm:text-base lg:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {currentNav.label}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="lg:hidden">
              <PWAInstallButton compact />
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onCheckAll}
              disabled={isCheckingAll || !hasEnabledKeys}
              aria-label={isCheckingAll ? 'Checking all keys' : 'Check All'}
              className="min-h-[40px] px-2.5 sm:px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${isCheckingAll ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {isCheckingAll ? 'Checking' : 'Check All'}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Viewport with Touch Swipe Navigation */}
        <main
          className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto"
          onTouchStart={swipeHandlers.onTouchStart}
          onTouchEnd={swipeHandlers.onTouchEnd}
        >
          {children}
        </main>
      </div>

      {/* Fixed Mobile Bottom Tab Bar (56px + safe area) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-6 h-14 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activePage;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-full px-1">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <OfflineIndicator />
    </div>
  );
};
