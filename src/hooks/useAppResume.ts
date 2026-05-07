import { useEffect, useRef } from "react";

export function useAppResume(onResume: () => void | Promise<void>) {
  const cbRef = useRef(onResume);
  cbRef.current = onResume;
  const runningRef = useRef(false);

  useEffect(() => {
    const run = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      Promise.resolve()
        .then(() => cbRef.current())
        .catch(() => {})
        .finally(() => {
          runningRef.current = false;
        });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}

