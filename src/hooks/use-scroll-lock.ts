import { useEffect } from 'react';

/**
 * Freeze the background page while a fixed-position popup is mounted.
 *
 * Two scroll contexts exist in the app:
 *  - Tab pages scroll inside the AppLayout `<main>` element.
 *  - Detail pages (PersonProfilePage, CircleDetailPage, EventDetailPage)
 *    render outside `<main>`, so the document itself scrolls.
 *
 * Without locking both, a popup opened from a detail page (MeetingBriefModal,
 * ConfirmDialog) lets the page behind it scroll, and the keyboard can bump
 * the page so it lands in a different position when the popup closes.
 *
 * On mount: freeze `<main>` with `overflow: hidden` (when present) and pin
 * the document by setting `<body>` to `position: fixed` offset by the current
 * scroll. Popups are themselves `position: fixed`, so a fixed body doesn't
 * disturb them or their own internal scrolling. On unmount: restore both and
 * jump back to the exact prior scroll position.
 */
export function useScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;

    const main = document.querySelector('main');
    const savedMainOverflow = main?.style.overflow ?? '';
    const savedMainTouchAction = main?.style.touchAction ?? '';
    const savedMainScrollTop = main?.scrollTop ?? 0;
    if (main) {
      main.style.overflow = 'hidden';
      main.style.touchAction = 'none';
    }

    const body = document.body;
    const savedPosition = body.style.position;
    const savedTop = body.style.top;
    const savedLeft = body.style.left;
    const savedRight = body.style.right;
    const savedWidth = body.style.width;
    const scrollY = window.scrollY;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      if (main) {
        main.style.overflow = savedMainOverflow;
        main.style.touchAction = savedMainTouchAction;
        main.scrollTop = savedMainScrollTop;
      }
      body.style.position = savedPosition;
      body.style.top = savedTop;
      body.style.left = savedLeft;
      body.style.right = savedRight;
      body.style.width = savedWidth;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
