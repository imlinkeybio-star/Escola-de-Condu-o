'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  DICTIONARIES,
  LANGUAGE_META_MAP,
  LANGUAGE_STORAGE_KEY,
  LanguageCode,
  LanguageMeta,
  TranslationDict,
  normalizeLanguageCode,
  tFormat,
} from '@/lib/i18n';

interface LanguageContextValue {
  language: LanguageCode;
  meta: LanguageMeta;
  dict: TranslationDict;
  isRtl: boolean;
  setLanguage: (code: LanguageCode) => void;
  fmt: (template: string, vars?: Record<string, string | number>) => string;
}

const LANGUAGE_EVENT = 'ecl:language-change';

function subscribeLanguage(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onChange = () => callback();
  window.addEventListener('storage', onChange);
  window.addEventListener(LANGUAGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LANGUAGE_EVENT, onChange);
  };
}

function getClientLanguageSnapshot(): LanguageCode {
  try {
    return normalizeLanguageCode(
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    );
  } catch {
    return 'pt';
  }
}

function getServerLanguageSnapshot(): LanguageCode {
  return 'pt';
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'pt',
  meta: LANGUAGE_META_MAP.pt,
  dict: DICTIONARIES.pt,
  isRtl: false,
  setLanguage: () => {},
  fmt: tFormat,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getClientLanguageSnapshot,
    getServerLanguageSnapshot
  );

  // Sync <html lang> and <html dir> (supports RTL Arabic automatically)
  useEffect(() => {
    const meta = LANGUAGE_META_MAP[language];
    if (typeof document !== 'undefined') {
      document.documentElement.lang = meta.bcp47;
      document.documentElement.dir = meta.dir;
    }
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    const normalized = normalizeLanguageCode(code);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      window.dispatchEvent(new Event(LANGUAGE_EVENT));
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const meta = LANGUAGE_META_MAP[language];
    const dict = DICTIONARIES[language];
    return {
      language,
      meta,
      dict,
      isRtl: meta.dir === 'rtl',
      setLanguage,
      fmt: tFormat,
    };
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
