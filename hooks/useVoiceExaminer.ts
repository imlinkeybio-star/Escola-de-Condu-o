'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useLanguage } from '@/components/LanguageProvider';

export function useVoiceExaminer(initialEnabled = true) {
  const { language, meta } = useLanguage();
  const [voiceEnabled, setVoiceEnabled] = useState(initialEnabled);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stopSpeech = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsLoadingAudio(false);
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const speak = useCallback(
    async (text: string, force = false) => {
      if (!voiceEnabled && !force) return;
      const clean = text.trim();
      if (!clean) return;

      stopSpeech();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoadingAudio(true);

      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Sem autenticação');
        const idToken = await user.getIdToken();

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ text: clean, language }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error('TTS indisponível');
        }

        const data = (await res.json()) as {
          audioBase64: string;
          mimeType: string;
        };
        if (controller.signal.aborted) return;

        const audio = new Audio(
          `data:${data.mimeType};base64,${data.audioBase64}`
        );
        audioRef.current = audio;

        audio.onplay = () => {
          setIsLoadingAudio(false);
          setIsSpeaking(true);
        };
        audio.onended = () => {
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setIsLoadingAudio(false);
        };

        await audio.play();
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setIsLoadingAudio(false);
        // Browser speech synthesis fallback if autoplay or server TTS throttled
        if (
          typeof window !== 'undefined' &&
          'speechSynthesis' in window &&
          (voiceEnabled || force)
        ) {
          try {
            const utter = new SpeechSynthesisUtterance(clean);
            utter.lang = meta.ttsLanguageCode;
            utter.rate = 1.0;
            utter.onstart = () => setIsSpeaking(true);
            utter.onend = () => setIsSpeaking(false);
            utter.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utter);
          } catch {
            setIsSpeaking(false);
          }
        }
      }
    },
    [language, meta.ttsLanguageCode, stopSpeech, voiceEnabled]
  );

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) stopSpeech();
      return !prev;
    });
  }, [stopSpeech]);

  return {
    voiceEnabled,
    setVoiceEnabled,
    toggleVoice,
    isSpeaking,
    isLoadingAudio,
    speak,
    stopSpeech,
  };
}
