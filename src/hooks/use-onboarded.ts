import { useCallback, useSyncExternalStore } from 'react';

const ONBOARDED_KEY = 'membr_onboarded';
const CHANGE_EVENT = 'membr:onboarding-changed';

function subscribe(callback: () => void): () => void {
  const onChange = () => callback();
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(ONBOARDED_KEY) === 'true';
}

// Server / SSR snapshot. Treated as "already onboarded" so the overlay
// doesn't flash during hydration when there's no localStorage.
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Onboarding completion flag backed by localStorage. All consumers share
 * one source of truth via `useSyncExternalStore` + a custom window event,
 * so writes from any component re-render every other component reading
 * the value in the same tab.
 */
export function useOnboarded(): {
  onboarded: boolean;
  markOnboarded: () => void;
  resetOnboarding: () => void;
} {
  const onboarded = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const markOnboarded = useCallback(() => {
    window.localStorage.setItem(ONBOARDED_KEY, 'true');
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const resetOnboarding = useCallback(() => {
    window.localStorage.removeItem(ONBOARDED_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { onboarded, markOnboarded, resetOnboarding };
}
