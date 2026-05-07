import { useEffect, useRef, useState } from "react";

/** Animates numeric display toward `target` for wallet-style feedback */
export function useCountUp(target: number, duration = 900) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const start = fromRef.current;
    if (!Number.isFinite(target) || Math.abs(target - start) < 0.005) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    let startTime: number | null = null;
    let raf = 0;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      fromRef.current = current;
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(animate);
      else {
        fromRef.current = target;
        setDisplay(target);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
