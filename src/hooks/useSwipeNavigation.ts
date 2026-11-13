import { useRef } from 'react';
import type { TouchEvent } from 'react';

interface UseSwipeNavigationOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  enabled?: boolean;
}

function isInsideHorizontallyScrollable(target: EventTarget | null): boolean {
  let node = target as HTMLElement | null;
  while (node) {
    if (node.dataset && node.dataset.noSwipe === 'true') {
      return true;
    }
    if (
      node.scrollWidth > node.clientWidth + 4 &&
      (getComputedStyle(node).overflowX === 'auto' ||
        getComputedStyle(node).overflowX === 'scroll')
    ) {
      return true;
    }
    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Supports touch-based left/right page navigation without breaking normal
 * scrolling, horizontally scrollable tables, or button/input interactions.
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: UseSwipeNavigationOptions) {
  const startRef = useRef<{ x: number; y: number; ignore: boolean } | null>(
    null
  );

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (!enabled || e.touches.length !== 1) return;
    const touch = e.touches[0];
    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      ignore: isInsideHorizontallyScrollable(e.target),
    };
  };

  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (!enabled || !startRef.current || startRef.current.ignore) {
      startRef.current = null;
      return;
    }
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    startRef.current = null;

    // Require clear horizontal swipe (> 72px) and strong horizontal dominance (> 2x vertical)
    if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 2.0) {
      if (dx < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }
  };

  return { onTouchStart, onTouchEnd };
}
