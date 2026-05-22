import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthPage } from "@/pages/AuthPage";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { Loader2 } from "lucide-react";
import { useOnboarded } from "@/hooks/use-onboarded";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { prewarm } from "@/lib/invoke-ai";

const queryClient = new QueryClient();

function useKeyboardSetup() {
  // iOS WebView's default keyboard behaviour wreaks havoc on fixed-bottom
  // sheets. We take full manual control here:
  //   1. Disable native WebView resize — we don't want the WebView height to
  //      change, so positions stay stable.
  //   2. Listen for keyboardWill(Show|Hide) and push the height into a CSS
  //      custom property + a `kb-open` class on <html>.
  //   3. Sheets, the tab bar, and any "stuck to bottom" UI read from
  //      var(--keyboard-height) so they sit flush against the keyboard.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});

    const root = document.documentElement;
    const onShow = (info: { keyboardHeight: number }) => {
      root.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      root.classList.add('kb-open');
    };
    const onHide = () => {
      root.style.setProperty('--keyboard-height', '0px');
      root.classList.remove('kb-open');
    };

    const cleanups: Array<() => void> = [];
    Keyboard.addListener('keyboardWillShow', onShow).then((h) => cleanups.push(() => h.remove()));
    Keyboard.addListener('keyboardDidShow', onShow).then((h) => cleanups.push(() => h.remove()));
    Keyboard.addListener('keyboardWillHide', onHide).then((h) => cleanups.push(() => h.remove()));
    Keyboard.addListener('keyboardDidHide', onHide).then((h) => cleanups.push(() => h.remove()));

    return () => {
      cleanups.forEach((c) => c());
      root.style.removeProperty('--keyboard-height');
      root.classList.remove('kb-open');
    };
  }, []);
}

function useAuthDeepLink(onRecovery: () => void) {
  // Every auth flow that leaves the app — Apple/Google sign-in, the signup
  // confirmation email, the password-reset email — comes back via the
  // `com.acofsky.facemap://login-callback` URL scheme. iOS routes that URL
  // to the app and the App plugin fires `appUrlOpen`. Pull the access +
  // refresh tokens out of the URL hash and hand them to Supabase, which
  // sets the session and unblocks AppContent.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        const parsed = new URL(url);
        const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
        const params = new URLSearchParams(hash || parsed.search);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          // Close the in-app Safari so the user lands back on the app.
          await Browser.close().catch(() => {});
          // A recovery link logs the user in with a session meant only for
          // choosing a new password — route them to the reset screen
          // instead of dropping them on the home tab.
          if (params.get('type') === 'recovery') onRecovery();
        }
      } catch {
        // Ignore non-auth deep links (we only own one URL scheme anyway).
      }
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, [onRecovery]);
}

// Pre-warm the four AI edge functions once a user is authenticated, and
// again whenever the app comes back to foreground after being backgrounded
// long enough that the isolates may have shut down. Each ping is
// fire-and-forget and short-circuits inside the function (no Anthropic
// call), so this is cheap.
const AI_FUNCTIONS = ['describe-from-photo', 'meeting-brief', 'recall-search', 'parse-voice-input'];
const PREWARM_COOLDOWN_MS = 5 * 60 * 1000;
let lastPrewarmAt = 0;

function prewarmAll() {
  const now = Date.now();
  if (now - lastPrewarmAt < PREWARM_COOLDOWN_MS) return;
  lastPrewarmAt = now;
  for (const fn of AI_FUNCTIONS) prewarm(fn);
}

function usePrewarmAI(active: boolean) {
  useEffect(() => {
    if (!active) return;
    prewarmAll();

    // Re-warm when the app returns to the foreground (Capacitor on
    // device) or when the tab regains visibility (web fallback). The
    // cooldown above prevents this from firing multiple times per
    // session if the user quickly tabs away and back.
    let removeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) prewarmAll();
      }).then((h) => { removeListener = () => h.remove(); });
    }
    const onVis = () => { if (document.visibilityState === 'visible') prewarmAll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      removeListener?.();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active]);
}

function AppContent() {
  const { user, loading } = useAuth();
  const { onboarded, markOnboarded } = useOnboarded();
  const [recovery, setRecovery] = useState(false);
  const enterRecovery = useCallback(() => setRecovery(true), []);
  useKeyboardSetup();
  useAuthDeepLink(enterRecovery);
  usePrewarmAI(!!user);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // A password-reset deep link forces the reset screen even though the
  // recovery token has technically signed the user in.
  if (recovery) {
    return <AuthPage initialMode="reset" onResetComplete={() => setRecovery(false)} />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!onboarded && <OnboardingFlow onDone={markOnboarded} />}
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
