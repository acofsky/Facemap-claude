import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { haptics } from '@/lib/haptics';

type VoiceCaptureState = 'idle' | 'recording' | 'denied' | 'unsupported';

interface UseVoiceCaptureResult {
  state: VoiceCaptureState;
  transcript: string;
  partial: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

/**
 * Wraps @capacitor-community/speech-recognition with the surface the
 * VoiceAddSheet wants: a single committed transcript plus a rolling
 * partial chunk that's updated live while the user speaks. Recognition
 * is native iOS SFSpeechRecognizer; on the web fallback we expose
 * `unsupported` so the UI can show a "device only" message rather than
 * silently doing nothing.
 */
export function useVoiceCapture(): UseVoiceCaptureResult {
  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [transcript, setTranscript] = useState('');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Keep the in-flight partial in a ref so the partial-results listener
  // can promote it to `transcript` on stop without racing React state.
  const partialRef = useRef('');
  const listenerRef = useRef<PluginListenerHandle | null>(null);
  const stateListenerRef = useRef<PluginListenerHandle | null>(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    return () => {
      listenerRef.current?.remove().catch(() => {});
      stateListenerRef.current?.remove().catch(() => {});
      if (isNative) {
        SpeechRecognition.stop().catch(() => {});
      }
    };
  }, [isNative]);

  const reset = useCallback(() => {
    setTranscript('');
    setPartial('');
    partialRef.current = '';
    setError(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!isNative) {
      setState('unsupported');
      setError('Voice add only works on the iOS app.');
      return;
    }

    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        setState('unsupported');
        setError("This device doesn't support speech recognition.");
        return;
      }

      const perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions();
        if (req.speechRecognition !== 'granted') {
          setState('denied');
          setError('Membr needs microphone and speech permissions to listen. Enable them in Settings.');
          return;
        }
      }

      // Wire listeners before starting so we don't miss the first partial.
      listenerRef.current?.remove().catch(() => {});
      stateListenerRef.current?.remove().catch(() => {});

      listenerRef.current = await SpeechRecognition.addListener(
        'partialResults',
        (data: { matches?: string[] }) => {
          const best = data?.matches?.[0] ?? '';
          partialRef.current = best;
          setPartial(best);
        },
      );

      stateListenerRef.current = await SpeechRecognition.addListener(
        'listeningState',
        (data: { status: 'started' | 'stopped' }) => {
          if (data.status === 'stopped') {
            // Promote whatever partial we ended on to the committed transcript.
            setTranscript((prev) => {
              const joined = [prev, partialRef.current].filter(Boolean).join(' ').trim();
              return joined;
            });
            partialRef.current = '';
            setPartial('');
            setState('idle');
          }
        },
      );

      await SpeechRecognition.start({
        language: 'en-US',
        partialResults: true,
        popup: false,
      });

      haptics.light();
      setState('recording');
    } catch (e) {
      console.error('Voice capture start failed', e);
      setError(e instanceof Error ? e.message : 'Could not start listening.');
      setState('idle');
    }
  }, [isNative]);

  const stop = useCallback(async () => {
    if (!isNative) return;
    try {
      haptics.medium();
      await SpeechRecognition.stop();
      // listeningState 'stopped' handler will promote partial → transcript.
    } catch (e) {
      console.error('Voice capture stop failed', e);
      setState('idle');
    }
  }, [isNative]);

  return { state, transcript, partial, error, start, stop, reset };
}
