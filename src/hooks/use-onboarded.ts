import { useState, useEffect } from 'react';

const ONBOARDED_KEY = 'membr_onboarded';

/** Tracks whether the user has finished the onboarding sequence on this device. */
export function useOnboarded(): {
  onboarded: boolean;
  markOnboarded: () => void;
  resetOnboarding: () => void;
} {
  const [onboarded, setOnboarded] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(ONBOARDED_KEY) === 'true';
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ONBOARDED_KEY) setOnboarded(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    onboarded,
    markOnboarded: () => {
      window.localStorage.setItem(ONBOARDED_KEY, 'true');
      setOnboarded(true);
    },
    resetOnboarding: () => {
      window.localStorage.removeItem(ONBOARDED_KEY);
      setOnboarded(false);
    },
  };
}
