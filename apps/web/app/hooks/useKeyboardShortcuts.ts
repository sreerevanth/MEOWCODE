"use client";

import * as React from "react";

export interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  enabled?: boolean;
  allowInInput?: boolean;
}

export function useKeyboardShortcuts(actions: ShortcutAction[]): void {
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const editable = target?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";

      for (const action of actionsRef.current) {
        if (action.enabled === false) continue;
        if (editable && !action.allowInInput && action.key !== "Escape") continue;

        const wantsMod = Boolean(action.ctrl || action.meta);
        const modPressed = event.ctrlKey || event.metaKey;
        if (wantsMod && !modPressed) continue;
        if (!wantsMod && modPressed && action.key.length === 1) continue;

        if (action.shift && !event.shiftKey) continue;
        if (!action.shift && event.shiftKey && wantsMod) continue;
        if (action.alt && !event.altKey) continue;
        if (!action.alt && event.altKey) continue;

        if (event.key.toLowerCase() !== action.key.toLowerCase()) continue;

        event.preventDefault();
        action.handler();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl/⌘ + N", description: "New chat" },
  { keys: "Ctrl/⌘ + K", description: "Focus conversation search" },
  { keys: "Ctrl/⌘ + ,", description: "Open settings" },
  { keys: "Ctrl/⌘ + Shift + C", description: "Copy & export conversation" },
  { keys: "Escape", description: "Close menus and modals" },
  { keys: "Enter", description: "Send message" },
  { keys: "Shift + Enter", description: "New line in message" }
] as const;
