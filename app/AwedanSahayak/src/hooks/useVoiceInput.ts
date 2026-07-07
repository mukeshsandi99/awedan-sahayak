/**
 * Voice input hook for Hindi speech recognition.
 *
 * Uses expo-speech-recognition (Expo-native module with New Architecture support).
 * Replaces the legacy @react-native-voice/voice which does not support
 * React Native 0.86+ / Fabric / Turbo Modules.
 *
 * Usage:
 *   const { isListening, partialText, startListening, stopListening } = useVoiceInput();
 *   // Call startListening() on mic press, stopListening() on second press.
 *   // When speech results arrive, they fire the onResult callback.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Alert, Platform, ToastAndroid, Vibration } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// ── Types ───────────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'checking' | 'listening' | 'error';

export interface UseVoiceInputOptions {
  /** Locale for speech recognition. Default: 'hi-IN'. */
  locale?: string;
  /** Called when final speech results arrive. Receives the transcribed text string. */
  onResult?: (text: string) => void;
  /** Called when an error occurs. Receives a user-friendly Hindi + English message. */
  onError?: (message: string) => void;
}

export interface UseVoiceInputReturn {
  /** Current recording state. */
  state: VoiceState;
  /** Whether the mic is actively listening. */
  isListening: boolean;
  /** Partial (interim) transcribed text, updated as the user speaks. */
  partialText: string;
  /** Start listening for speech. Requests permission if needed. */
  startListening: () => Promise<void>;
  /** Manually stop listening before the silence timeout. */
  stopListening: () => Promise<void>;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { locale = 'hi-IN', onResult, onError } = options;

  const [state, setState] = useState<VoiceState>('idle');
  const [partialText, setPartialText] = useState('');

  // Refs to avoid stale closures in event handlers
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const isListening = state === 'listening';

  // ── Speech recognition event hooks (auto-cleaned on unmount) ─────

  useSpeechRecognitionEvent('start', () => {
    setState('listening');
    setPartialText('');
    // Visual + haptic cue so the user knows exactly when to start speaking
    if (Platform.OS === 'android') {
      ToastAndroid.show('🎤 अब बोलें — Speak now', ToastAndroid.LONG);
      Vibration.vibrate(80); // Short haptic buzz on listening start
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setState('idle');
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0]?.transcript ?? '';
      if (event.isFinal) {
        // In continuous mode, the recognizer stays active after delivering
        // a final result — do NOT set state to idle. The user must explicitly
        // call stopListening() to end the session.
        if (transcript.trim().length > 0) {
          onResultRef.current?.(transcript.trim());
        }
      } else {
        setPartialText(transcript);
      }
    }
  });

  // nomatch fires when a final result is returned with no significant
  // recognition. In continuous mode this is harmless — the recognizer
  // stays active. Just clear the partial text.
  useSpeechRecognitionEvent('nomatch', () => {
    setPartialText('');
  });

  useSpeechRecognitionEvent('error', (event) => {
    const code = event.error ?? 'unknown';
    const message = event.message ?? '';

    let userMessage: string | undefined;
    switch (code) {
      case 'no-speech':
        // In continuous mode the recognizer stays active — no-speech
        // just means the current silence window passed with no input.
        // Don't set error state; the user is still able to speak.
        // Just reset to idle so the user can try again.
        setState('idle');
        return; // Early return — not a real error
      case 'speech-timeout':
        // Android-only: similar to no-speech, no speech input received.
        // Reset to idle silently so the user can retry.
        setState('idle');
        return;
      case 'service-not-allowed':
      case 'not-allowed':
        userMessage = 'स्पीच रिकग्निशन सेवा उपलब्ध नहीं है।\n\nSpeech recognition service is not available on this device.';
        break;
      case 'busy':
        userMessage = 'माइक्रोफ़ोन व्यस्त है। कृपया प्रतीक्षा करें और पुनः प्रयास करें।\n\nMicrophone is busy. Please wait and try again.';
        break;
      case 'audio-capture':
        userMessage = 'माइक्रोफ़ोन त्रुटि। कृपया माइक्रोफ़ोन अनुमति जाँचें।\n\nMicrophone error. Please check microphone permissions.';
        break;
      case 'network':
        userMessage = 'इंटरनेट कनेक्शन नहीं मिला।\n\nकृपया वाई-फ़ाई या मोबाइल डेटा चालू करें और पुनः प्रयास करें।\nआवाज़ पहचानने के लिए इंटरनेट आवश्यक है।\n\nNo internet connection. Please turn on WiFi or mobile data and try again. Voice recognition requires internet.';
        break;
      case 'language-not-supported':
        userMessage = `हिंदी (${locale}) स्पीच रिकग्निशन समर्थित नहीं है।\n\nHindi speech recognition is not supported on this device.`;
        break;
      default:
        userMessage = `आवाज़ पहचान में त्रुटि। कृपया पुनः प्रयास करें।\n\nSpeech recognition error: ${message || code}`;
    }

    // Only reach here for real errors (not no-speech / speech-timeout)
    setState('error');

    if (userMessage) {
      onErrorRef.current?.(userMessage);
    }

    // Auto-reset to idle after a short delay so the user can retry
    setTimeout(() => {
      setState((prev) => (prev === 'error' ? 'idle' : prev));
    }, 2000);
  });

  // ── Cleanup on unmount ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Abort any ongoing recognition when the component unmounts
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    try {
      setState('checking');

      // Check and request permissions
      const permResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permResult.granted) {
        const msg = 'माइक्रोफ़ोन की अनुमति नहीं दी गई। कृपया सेटिंग्स में जाकर अनुमति दें।\n\nMicrophone permission denied. Please enable it in Settings.';
        onErrorRef.current?.(msg);
        Alert.alert('🎤 अनुमति आवश्यक', msg);
        setState('idle');
        return;
      }

      // Delay to let the native speech recognizer initialise after permission grant.
      // 500ms gives enough time for the Android RecognizerIntent service to bind.
      // Without this, the recognizer may fire no-speech immediately.
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Start recognition with Hindi locale.
      // continuous: true keeps the mic open until the user explicitly stops,
      // avoiding premature no-speech errors.
      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        continuous: true,
        // Explicitly use network-based (online) recognition.
        // Hindi on-device packs are not pre-installed on most Android devices.
        // If the user wants offline mode, set this to true and guide them to
        // download the Hindi pack via: Settings → System → Languages →
        // On-device speech recognition → Download Hindi (हिंदी).
        requiresOnDeviceRecognition: false,
        // Generous silence windows for Hindi (slower speech cadence, longer pauses).
        // EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: recognizer won't stop before this
        //   many ms — set to 3s so the user has ample time to begin speaking.
        // EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: silence after last speech
        //   before considering the utterance complete — 6s for Hindi's natural pauses.
        // EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: mid-utterance
        //   pause threshold — 4s so mid-sentence pauses aren't treated as end-of-speech.
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 3000,
          EXTRA_PROMPT: '🎤 अब बोलें — Speak now',
        },
      });
      // State will be set to 'listening' by the 'start' event
    } catch (err: any) {
      setState('error');
      const msg = err?.message ?? 'Unknown voice error';
      console.error('[useVoiceInput] start error:', msg);

      // Check for permission errors
      if (
        msg.includes('permission') ||
        msg.includes('Permission') ||
        msg.includes('security') ||
        msg.includes('not-allowed')
      ) {
        const permMsg = 'माइक्रोफ़ोन की अनुमति नहीं दी गई। कृपया सेटिंग्स में जाकर अनुमति दें।\n\nMicrophone permission denied. Please enable it in Settings.';
        onErrorRef.current?.(permMsg);
        Alert.alert('🎤 अनुमति आवश्यक', permMsg);
      } else {
        onErrorRef.current?.(`आवाज़ प्रारंभ करने में त्रुटि।\n\n${msg}`);
      }
      setState('idle');
    }
  }, [locale]);

  const stopListening = useCallback(async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
      // The 'end' event will set state to 'idle'
    } catch (err: any) {
      console.error('[useVoiceInput] stop error:', err?.message);
      setState('idle');
    }
  }, []);

  return {
    state,
    isListening,
    partialText,
    startListening,
    stopListening,
  };
}
