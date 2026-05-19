import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { toast } from 'sonner';
import { Loader2, Check, X, ArrowLeft, Apple } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';

// Custom URL scheme registered in ios/App/App/Info.plist (CFBundleURLTypes).
// Supabase redirects here after the user authenticates with Apple/Google.
// The deep-link handler in src/App.tsx parses the hash params and calls
// supabase.auth.setSession.
const OAUTH_REDIRECT = 'com.acofsky.facemap://login-callback';

// Email links (signup confirmation, password reset) have to come back
// into the app. In the native build `window.location.origin` is
// `capacitor://localhost` — Safari can't open that, so a tapped email
// link dead-ends with "address is not valid". Point the links at the
// app's custom URL scheme instead; the deep-link handler in App.tsx
// exchanges the returned tokens for a session.
const EMAIL_REDIRECT = Capacitor.isNativePlatform()
  ? OAUTH_REDIRECT
  : `${window.location.origin}/`;

async function startOAuth(provider: 'google' | 'apple'): Promise<{ error?: Error }> {
  const native = Capacitor.isNativePlatform();
  // Native: ask Supabase for the OAuth URL but DON'T let it auto-navigate
  // (we open it in the Capacitor Browser instead so the redirect lands on
  // the deep link, not on the in-app webview). Web: let Supabase navigate
  // normally — the redirect comes back through the same window.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: native ? OAUTH_REDIRECT : `${window.location.origin}/`,
      skipBrowserRedirect: native,
    },
  });
  if (error) return { error };
  if (native && data?.url) {
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  }
  return {};
}

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'reset';

interface AuthPageProps {
  /** Force the starting mode — used when a recovery deep link opens the app. */
  initialMode?: Mode;
  /** Called after a successful password reset so the host can dismiss the
      recovery screen. */
  onResetComplete?: () => void;
}

/**
 * Reads a Supabase recovery token from the URL hash. After the user taps
 * the email reset link Supabase sends them back with a fragment like
 * `#access_token=...&type=recovery`. We detect that and force the reset
 * screen on app load.
 */
function detectRecoveryFromHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  return /\btype=recovery\b/.test(hash) && /\baccess_token=/.test(hash);
}

export function AuthPage({ initialMode, onResetComplete }: AuthPageProps = {}) {
  const [mode, setMode] = useState<Mode>(
    () => initialMode ?? (detectRecoveryFromHash() ? 'reset' : 'sign-in'),
  );
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Seconds left before "Resend verification email" is allowed again —
  // Supabase rejects a second send inside its 60s per-user window anyway.
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  // Clean up the hash once we've adopted reset mode so the screen doesn't
  // bounce back here on the next reload.
  useEffect(() => {
    if (mode === 'reset' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'sign-up') {
        const trimmedName = firstName.trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: EMAIL_REDIRECT,
            ...(trimmedName ? { data: { first_name: trimmedName } } : {}),
          },
        });
        if (error) throw error;
        if (!data.session) {
          setPendingVerification(true);
          setResendIn(60);
          toast.success('Check your email to verify your account.');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: EMAIL_REDIRECT,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send reset email';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated. Signed in.');
      setMode('sign-in');
      setNewPassword('');
      setConfirmPassword('');
      onResetComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not reset password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: EMAIL_REDIRECT },
      });
      if (error) throw error;
      setResendIn(60);
      toast.success('Verification email resent.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not resend email';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await startOAuth('google');
    if (error) toast.error(error.message);
  };

  const handleApple = async () => {
    const { error } = await startOAuth('apple');
    if (error) toast.error(error.message);
  };

  const inputClass =
    'w-full h-12 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-[15px] text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors';

  return (
    <div className="h-screen overflow-y-auto bg-background safe-top scrollbar-hide">
      <div className="auth-inner min-h-full flex flex-col justify-center px-6 py-10">
        <div className="w-full max-w-sm mx-auto space-y-7">
        <div className="text-center">
          <Wordmark className="text-[44px]" />
          <p className="text-[13px] text-muted-text mt-3 leading-snug">Remember everyone. Miss no one.</p>
        </div>

        {/* RESET PASSWORD — landed here via email recovery link */}
        {mode === 'reset' && (
          <form onSubmit={handleReset} className="space-y-3">
            <h2 className="font-display text-xl text-foreground tracking-[-0.02em] text-center">
              Set a new password
            </h2>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className={inputClass}
              autoComplete="new-password"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              className={inputClass}
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD */}
        {mode === 'forgot' && !forgotSent && (
          <form onSubmit={handleForgot} className="space-y-3">
            <button
              type="button"
              onClick={() => setMode('sign-in')}
              className="inline-flex items-center gap-1 text-[13px] text-muted-text"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} /> Back to sign in
            </button>
            <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">Forgot password</h2>
            <p className="text-[13px] text-muted-text">
              Enter your email and we'll send a reset link.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Reset Link
            </button>
          </form>
        )}

        {mode === 'forgot' && forgotSent && (
          <div className="space-y-3 text-center">
            <div className="p-5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] space-y-2">
              <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">Check your inbox</h2>
              <p className="text-[13px] text-muted-text leading-relaxed">
                We sent a reset link to <span className="text-foreground">{email}</span>. Tap it on this device to set a new password.
              </p>
            </div>
            <button
              onClick={() => {
                setForgotSent(false);
                setMode('sign-in');
              }}
              className="text-[13px] text-primary font-semibold"
            >
              Back to sign in
            </button>
          </div>
        )}

        {/* SIGN IN / SIGN UP */}
        {(mode === 'sign-in' || mode === 'sign-up') && (pendingVerification ? (
          <div className="space-y-3 text-center">
            <div className="p-5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] space-y-2">
              <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">Check your email</h2>
              <p className="text-[13px] text-muted-text leading-relaxed">
                We sent a verification link to <span className="text-foreground">{email}</span>. Tap it and you'll be signed in automatically.
              </p>
            </div>
            <button
              onClick={handleResend}
              disabled={loading || resendIn > 0}
              className="w-full h-[52px] rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-foreground font-medium hover:border-[hsl(0_0%_100%/0.18)] transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending…' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend verification email'}
            </button>
            <button
              onClick={() => {
                setPendingVerification(false);
                setMode('sign-in');
              }}
              className="text-[13px] text-primary font-semibold block w-full"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'sign-up' && (
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  autoCapitalize="words"
                  autoCorrect="off"
                  autoComplete="given-name"
                  maxLength={40}
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
                minLength={8}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              />
              {mode === 'sign-up' && (
                <ul className="space-y-1 px-1 text-[12px]">
                  {[
                    { label: 'At least 8 characters', ok: password.length >= 8 },
                    { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
                    { label: 'One lowercase letter', ok: /[a-z]/.test(password) },
                    { label: 'One number', ok: /\d/.test(password) },
                    { label: 'One symbol (e.g. !@#$)', ok: /[^A-Za-z0-9]/.test(password) },
                    {
                      label: 'Not a common/leaked password',
                      ok:
                        password.length >= 8 &&
                        !/^(password|12345678|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|football|password1)/i.test(password),
                    },
                  ].map((req) => (
                    <li
                      key={req.label}
                      className={`flex items-center gap-1.5 ${req.ok ? 'text-foreground' : 'text-muted-text'}`}
                    >
                      {req.ok ? (
                        <Check className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                      ) : (
                        <X className="w-3.5 h-3.5 opacity-40" strokeWidth={1.75} />
                      )}
                      <span>{req.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>

              {mode === 'sign-in' && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[13px] text-muted-text hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[hsl(0_0%_100%/0.08)]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-[0.08em]">
                <span className="bg-background px-2 text-muted-text">or</span>
              </div>
            </div>

            {/* Apple first per HIG: when an app offers any third-party
                social login (Google here), Sign in with Apple must be
                presented as a peer option, typically on top. */}
            <button
              onClick={handleApple}
              className="w-full h-[52px] rounded-md bg-foreground text-background font-medium transition-colors flex items-center justify-center gap-2 active:opacity-90"
            >
              <Apple className="w-5 h-5" strokeWidth={1.75} />
              Continue with Apple
            </button>

            <button
              onClick={handleGoogle}
              className="w-full h-[52px] rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-foreground font-medium hover:border-[hsl(0_0%_100%/0.18)] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-[13px] text-muted-text">
              {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
                className="text-primary font-semibold"
              >
                {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        ))}
        </div>
      </div>
    </div>
  );
}
