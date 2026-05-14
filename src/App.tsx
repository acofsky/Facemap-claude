import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthPage } from "@/pages/AuthPage";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { Loader2 } from "lucide-react";
import { useOnboarded } from "@/hooks/use-onboarded";
import { OnboardingFlow } from "@/components/OnboardingFlow";

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

function AppContent() {
  const { user, loading } = useAuth();
  const { onboarded, markOnboarded } = useOnboarded();
  useKeyboardSetup();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
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
