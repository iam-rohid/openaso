import { useRef } from "react";

/**
 * Runs a menu item's action only once its dropdown has fully closed, without returning focus to the
 * trigger. Opening a dialog straight from a menu item lets the closing menu steal focus back, so
 * Enter in the dialog re-opens the menu instead of submitting.
 */
export function useAfterMenuClose() {
  const pending = useRef<(() => void) | null>(null);
  return {
    defer: (action: () => void) => {
      pending.current = action;
    },
    onCloseAutoFocus: (e: Event) => {
      const action = pending.current;
      if (!action) return;
      pending.current = null;
      e.preventDefault();
      action();
    },
  };
}
