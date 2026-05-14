import { useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useNotificationPrefs } from '@/hooks/use-notification-prefs';
import {
  notificationPermissionStatus, requestNotificationPermission, type EoDFrequency,
} from '@/lib/notifications';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useSwipeBack } from '@/hooks/use-swipe-back';

interface NotificationPreferencesPageProps {
  onBack: () => void;
}

const FREQ_LABELS: Record<EoDFrequency, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays only',
  mwf: 'A few times a week (M / W / F)',
  'weekly-fri': 'Weekly (Fridays)',
};

export function NotificationPreferencesPage({ onBack }: NotificationPreferencesPageProps) {
  const { prefs, update } = useNotificationPrefs();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [showFreq, setShowFreq] = useState(false);
  const swipe = useSwipeBack(onBack, { disabled: showFreq });

  useEffect(() => {
    notificationPermissionStatus().then(setPermission);
  }, []);

  const isNative = Capacitor.isNativePlatform();
  const needsPermission = isNative && prefs.eod.enabled && permission !== 'granted';

  const handleEoDToggle = async (next: boolean) => {
    if (next && isNative && permission !== 'granted') {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== 'granted') {
        toast.error('Membr needs notification permission. Enable in iOS Settings.');
        return;
      }
    }
    update({ eod: { ...prefs.eod, enabled: next } });
    toast.success(next ? 'End-of-day reminder scheduled.' : 'End-of-day reminder off.');
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 36, stiffness: 380 }}
      className="fixed inset-0 z-50 bg-background flex flex-col safe-top safe-bottom max-w-md mx-auto"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : undefined,
      }}
      {...swipe.bind}
    >
      {/* Nav bar */}
      <div className="bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground">Notifications</h1>
        <span className="w-10" />
      </div>

      <div className="overflow-y-auto scrollbar-hide flex-1 px-5 pt-4 space-y-6 pb-10">
        {needsPermission && (
          <div className="rounded-lg bg-surface-1 border border-warning/30 p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="flex-1 text-[13px] text-foreground/90 leading-snug">
              Notifications are off in iOS Settings. Open <span className="font-medium">Settings → Membr → Notifications</span> to allow them.
            </div>
          </div>
        )}

        {!isNative && (
          <p className="text-[12px] text-muted-text italic">
            Notifications only run in the iPhone app. These settings are saved and will take effect there.
          </p>
        )}

        {/* End of Day */}
        <SectionCard>
          <ToggleRow
            label="End of day"
            sub="'Who'd you meet today?'"
            value={prefs.eod.enabled}
            onChange={handleEoDToggle}
          />
          {prefs.eod.enabled && (
            <>
              <DividerRow />
              <button
                onClick={() => setShowFreq(true)}
                className="w-full h-[52px] px-4 flex items-center text-left active:bg-[hsl(0_0%_100%/0.04)]"
              >
                <span className="text-[15px] text-foreground flex-1">How often?</span>
                <span className="text-[13px] text-muted-text mr-1.5">{FREQ_LABELS[prefs.eod.frequency]}</span>
                <ChevronRight className="w-4 h-4 text-muted-text" strokeWidth={1.75} />
              </button>
              <DividerRow />
              <label className="w-full h-[52px] px-4 flex items-center">
                <span className="text-[15px] text-foreground flex-1">What time?</span>
                <input
                  type="time"
                  value={prefs.eod.time}
                  onChange={(e) => update({ eod: { ...prefs.eod, time: e.target.value } })}
                  className="h-9 px-2.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-foreground text-[14px] focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                />
              </label>
            </>
          )}
        </SectionCard>

        <SectionCard>
          <ToggleRow
            label="Weekly summary"
            sub="Friday evening reminder to look back at who you added and saw this week"
            value={prefs.weeklySummary}
            onChange={(v) => {
              update({ weeklySummary: v });
              toast.success(v ? 'Weekly summary scheduled for Friday 7 PM.' : 'Weekly summary off.');
            }}
          />
        </SectionCard>

        <SectionCard>
          <ToggleRow
            label="Smart Circle suggestions"
            sub="Show the in-app banners that suggest creating an Event when you've added a few related people"
            value={prefs.smartCircleSuggestions}
            onChange={(v) => update({ smartCircleSuggestions: v })}
          />
        </SectionCard>
      </div>

      {/* Frequency picker sheet */}
      {showFreq && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={() => setShowFreq(false)}>
          <div
            className="w-full max-w-md bg-surface-2 rounded-t-2xl border border-[hsl(0_0%_100%/0.12)] safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">
              How often?
            </div>
            <div className="divide-y divide-[hsl(0_0%_100%/0.06)]">
              {(Object.keys(FREQ_LABELS) as EoDFrequency[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    update({ eod: { ...prefs.eod, frequency: key } });
                    setShowFreq(false);
                  }}
                  className={cn(
                    'w-full h-[52px] px-5 flex items-center text-left active:bg-[hsl(0_0%_100%/0.04)]',
                    prefs.eod.frequency === key ? 'text-foreground' : 'text-muted-text',
                  )}
                >
                  <span className="flex-1 text-[15px]">{FREQ_LABELS[key]}</span>
                  {prefs.eod.frequency === key && <span className="text-primary text-[15px]">✓</span>}
                </button>
              ))}
            </div>
            <div className="px-5 pb-5 pt-3">
              <button
                onClick={() => setShowFreq(false)}
                className="w-full h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-muted-text text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ----------------- helpers ----------------- */

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] overflow-hidden">
      {children}
    </div>
  );
}

function DividerRow() {
  return <div className="h-px bg-[hsl(0_0%_100%/0.06)] mx-4" />;
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
  comingSoon,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  comingSoon?: boolean;
}) {
  return (
    <div className="px-4 py-3.5 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-foreground flex items-center gap-2">
          {label}
          {comingSoon && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-[hsl(0_0%_100%/0.06)] text-[10px] uppercase tracking-[0.08em] text-muted-text">
              Soon
            </span>
          )}
        </div>
        {sub && <p className="text-[12px] text-muted-text leading-snug mt-1">{sub}</p>}
      </div>
      <Switch checked={value} onChange={onChange} disabled={comingSoon} />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => {
        if (disabled) return;
        haptics.light();
        onChange(!checked);
      }}
      disabled={disabled}
      className={cn(
        'relative w-[44px] h-[26px] rounded-full transition-colors shrink-0',
        checked ? 'bg-primary' : 'bg-[hsl(0_0%_100%/0.12)]',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className="absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white"
        style={{
          left: checked ? 22 : 2,
          transition: 'left 0.18s ease-out',
        }}
      />
    </button>
  );
}
