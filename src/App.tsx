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
  // sheets — focusing an input scrolls the page up and pushes the sheet
  // header off-screen. Native resize mode lets iOS shrink the WebView
  // above the keyboard cleanly, which keeps sheets pinned and their
  // contents visible.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
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
