import { useEffect } from 'react';

/**
 * Freeze the AppLayout `<main>` scroll container while a fixed-position
 * sheet is mounted.
 *
 * Without this, opening any sheet that autofocuses an input (QuickAddSheet,
 * EventSheet, LogEncounterModal, MeetingBriefModal, etc.) causes iOS
 * WebView to scroll `<main>` to bring the focused input into view — but
 * the input is in a fixed-position sheet that iOS doesn't understand as a
 * modal, so it scrolls the page underneath instead. The user sees the
 * background "bump" up and then has to scroll back when the sheet closes.
 *
 * On mount: capture the current scrollTop, freeze the container with
 * `overflow: hidden`. On unmount: restore both. `touch-action: none`
 * stops the user from triggering a scroll attempt through the dimmed
 * backdrop too.
 */
export function useScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const main = document.querySelector('main');
    if (!main) return;
    const savedScrollTop = main.scrollTop;
    const savedOverflow = main.style.overflow;
    const savedTouchAction = main.style.touchAction;
    main.style.overflow = 'hidden';
    main.style.touchAction = 'none';
    return () => {
      main.style.overflow = savedOverflow;
      main.style.touchAction = savedTouchAction;
      main.scrollTop = savedScrollTop;
    };
  }, [active]);
}
