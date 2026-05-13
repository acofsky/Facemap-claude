import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, X } from 'lucide-react';

const ENABLE_GOOGLE_AUTH = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (!data.session) {
          setPendingVerification(true);
          toast.success('Check your email to verify your account.');
        }
      }
    } catch (err: any) {
      toast.error(err.message);
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
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success('Verification email resent.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // TODO: re-implement on native Supabase OAuth when we re-enable social sign-in.
  const handleGoogle = async () => {
    toast.error('Google sign-in is not available yet.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-serif font-bold text-foreground">Membr</h1>
          <p className="text-muted-foreground mt-2 text-sm">Remember the people you meet</p>
        </div>

        {pendingVerification ? (
          <div className="space-y-4 text-center">
            <div className="p-6 rounded-xl bg-card border border-border space-y-2">
              <h2 className="font-serif text-xl text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a verification link to <span className="text-foreground">{email}</span>. Click it to activate your account, then sign in.
              </p>
            </div>
            <button
              onClick={handleResend}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Resend verification email'}
            </button>
            <button
              onClick={() => { setPendingVerification(false); setIsLogin(true); }}
              className="text-sm text-primary font-medium block w-full"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
                minLength={8}
              />
              {!isLogin && (
                <ul className="space-y-1.5 px-1 text-xs">
                  {[
                    { label: 'At least 8 characters', ok: password.length >= 8 },
                    { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
                    { label: 'One lowercase letter', ok: /[a-z]/.test(password) },
                    { label: 'One number', ok: /\d/.test(password) },
                    { label: 'One symbol (e.g. !@#$)', ok: /[^A-Za-z0-9]/.test(password) },
                    { label: 'Not a common/leaked password', ok: password.length >= 8 && !/^(password|12345678|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|football|password1)/i.test(password) },
                  ].map(req => (
                    <li key={req.label} className={`flex items-center gap-2 ${req.ok ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {req.ok ? <Check className="w-3.5 h-3.5 text-primary" /> : <X className="w-3.5 h-3.5 opacity-50" />}
                      <span>{req.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLogin ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {ENABLE_GOOGLE_AUTH && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">or</span></div>
                </div>

                <button
                  onClick={handleGoogle}
                  className="w-full py-3 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-accent/30 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>
              </>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium">
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
