/** Width + collapsed state of a side panel, remembered in localStorage. */
import { useCallback, useEffect, useState } from "react";

export const PANEL_MIN = 220;
export const PANEL_MAX = 460;
export const PANEL_DEFAULT = 304; // 19rem

const clamp = (w: number) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(w)));

export function usePanel(key: string) {
  const [state, setState] = useState<{ w: number; c: boolean }>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "");
      return { w: clamp(Number(v.w) || PANEL_DEFAULT), c: Boolean(v.c) };
    } catch {
      return { w: PANEL_DEFAULT, c: false };
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);

  return {
    width: state.w,
    collapsed: state.c,
    /** Set the width, never below the minimum or above `max` (so the middle section keeps some room). */
    setWidth: useCallback((w: number, max = PANEL_MAX) => setState((s) => ({ ...s, w: Math.min(Math.max(PANEL_MIN, Math.round(w)), Math.max(PANEL_MIN, max)) })), []),
    toggle: useCallback(() => setState((s) => ({ ...s, c: !s.c })), []),
    reset: useCallback(() => setState({ w: PANEL_DEFAULT, c: false }), []),
  };
}
