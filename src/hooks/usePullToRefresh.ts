import { useRef, useState, useCallback } from "react";

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 72;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const el = scrollRef.current;
      if (!el || el.scrollTop > 0) {
        startY.current = null;
        return;
      }

      const delta = Math.max(0, e.touches[0].clientY - startY.current);
      const rubberBand =
        delta < THRESHOLD ? delta : THRESHOLD + Math.sqrt(delta - THRESHOLD) * 8;

      if (rubberBand > 0) {
        e.preventDefault();
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
  }, [onRefresh]);

  return {
    scrollRef,
    pullDistance,
    refreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
