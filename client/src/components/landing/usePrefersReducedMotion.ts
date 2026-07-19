import { useEffect, useState } from "react";

/**
 * Plain boolean version of prefers-reduced-motion for pieces that aren't
 * driven by framer-motion (canvas rAF loops, setInterval typewriters).
 * Framer-motion components should prefer its own `useReducedMotion()` —
 * this one is for the raw DOM/canvas bits that need a boolean to branch on.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * True while the document tab is hidden. Used to pause rAF/interval loops
 * that would otherwise keep running (and draining battery) in a background tab.
 */
export function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return hidden;
}
