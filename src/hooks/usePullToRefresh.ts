import { useRef, useState, useCallback } from "react";

const THRESHOLD = 72;

/** Walk up from `el` to the nearest ancestor that actually scrolls vertically. */
function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    const style = window.getComputedStyle(cur);
    const overflowY = style.overflowY;
    const scrolls =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      cur.scrollHeight > cur.clientHeight + 1;
    if (scrolls) return cur;
    cur = cur.parentElement;
  }
  return null;
}

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Cached real scroll element for the duration of one gesture. */
  const scrollerRef = useRef<HTMLElement | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const anchor = scrollRef.current;
    if (!anchor) return;
    const scroller = findScrollableAncestor(anchor) || anchor;
    scrollerRef.current = scroller;
    if (scroller.scrollTop > 0) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const scroller = scrollerRef.current;
      if (!scroller || scroller.scrollTop > 0) {
        startY.current = null;
        if (pullDistanceRef.current !== 0) {
          pullDistanceRef.current = 0;
          setPullDistance(0);
          setPulling(false);
        }
        return;
      }

      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        // Upward gesture — bail and don't show the indicator.
        if (pullDistanceRef.current !== 0) {
          pullDistanceRef.current = 0;
          setPullDistance(0);
          setPulling(false);
        }
        return;
      }

      const rubberBand =
        delta < THRESHOLD ? delta : THRESHOLD + Math.sqrt(delta - THRESHOLD) * 8;

      if (rubberBand > 0) {
        if (e.cancelable) e.preventDefault();
        setPulling(true);
        const d = Math.min(rubberBand, THRESHOLD * 1.5);
        pullDistanceRef.current = d;
        setPullDistance(d);
      }
    },
    [refreshing],
  );

  const onTouchEnd = useCallback(async () => {
    const dist = pullDistanceRef.current;
    setPulling(false);
    if (dist >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.55);
      try {
        await onRefresh();
      } finally {
        setPullDistance(0);
        pullDistanceRef.current = 0;
        setTimeout(() => setRefreshing(false), 280);
      }
    } else {
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
    startY.current = null;
    scrollerRef.current = null;
  }, [onRefresh]);

  return {
    scrollRef,
    pulling,
    pullDistance,
    refreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
