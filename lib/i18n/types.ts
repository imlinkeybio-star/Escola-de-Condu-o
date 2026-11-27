export type LanguageCode = 'pt' | 'en' | 'es' | 'fr' | 'ru' | 'zh' | 'ja' | 'ar';

export interface LanguageMeta {
  code: LanguageCode;
  shortCode: string;
  nativeName: string;
  regionLabel: string;
  bcp47: string;
  ttsLanguageCode: string;
  ttsVoiceName: string;
  dir: 'ltr' | 'rtl';
  aiLanguageName: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageMeta[] = [
  {
    code: 'pt',
    shortCode: 'PT',
    nativeName: 'Português',
    regionLabel: 'Angola · Lusofonia',
    bcp47: 'pt-AO',
    ttsLanguageCode: 'pt-PT',
    ttsVoiceName: 'pt-PT-Wavenet-A',
    dir: 'ltr',
    aiLanguageName: 'Português de Angola',
  },
  {
    code: 'en',
    shortCode: 'EN',
    nativeName: 'English',
    regionLabel: 'International',
    bcp47: 'en-US',
    ttsLanguageCode: 'en-US',
    ttsVoiceName: 'en-US-Wavenet-F',
    dir: 'ltr',
    aiLanguageName: 'English',
  },
  {
    code: 'es',
    shortCode: 'ES',
    nativeName: 'Español',
    regionLabel: 'España · Latinoamérica',
    bcp47: 'es-ES',
    ttsLanguageCode: 'es-ES',
    ttsVoiceName: 'es-ES-Wavenet-C',
    dir: 'ltr',
    aiLanguageName: 'Español',
  },
  {
    code: 'fr',
    shortCode: 'FR',
    nativeName: 'Français',
    regionLabel: 'France · Francophonie',
    bcp47: 'fr-FR',
    ttsLanguageCode: 'fr-FR',
    ttsVoiceName: 'fr-FR-Wavenet-A',
    dir: 'ltr',
    aiLanguageName: 'Français',
  },
  {
    code: 'ru',
    shortCode: 'RU',
    nativeName: 'Русский',
    regionLabel: 'Россия · СНГ',
    bcp47: 'ru-RU',
    ttsLanguageCode: 'ru-RU',
    ttsVoiceName: 'ru-RU-Wavenet-A',
    dir: 'ltr',
    aiLanguageName: 'Russian (Русский)',
  },
  {
    code: 'zh',
    shortCode: 'ZH',
    nativeName: '中文 (普通话)',
    regionLabel: 'Mandarin · 简体中文',
    bcp47: 'zh-CN',
    ttsLanguageCode: 'cmn-CN',
    ttsVoiceName: 'cmn-CN-Wavenet-A',
    dir: 'ltr',
    aiLanguageName: 'Mandarin Chinese (简体中文)',
  },
  {
    code: 'ja',
    shortCode: 'JA',
    nativeName: '日本語',
    regionLabel: '日本 · Japanese',
    bcp47: 'ja-JP',
    ttsLanguageCode: 'ja-JP',
    ttsVoiceName: 'ja-JP-Wavenet-B',
    dir: 'ltr',
    aiLanguageName: 'Japanese (日本語)',
  },
  {
    code: 'ar',
    shortCode: 'AR',
    nativeName: 'العربية',
    regionLabel: 'العالم العربي · RTL',
    bcp47: 'ar-SA',
    ttsLanguageCode: 'ar-XA',
    ttsVoiceName: 'ar-XA-Wavenet-A',
    dir: 'rtl',
    aiLanguageName: 'Arabic (العربية)',
  },
] as const;

export const LANGUAGE_META_MAP: Record<LanguageCode, LanguageMeta> =
  SUPPORTED_LANGUAGES.reduce(
    (acc, item) => {
      acc[item.code] = item;
      return acc;
    },
    {} as Record<LanguageCode, LanguageMeta>
  );

export function normalizeLanguageCode(raw?: unknown): LanguageCode {
  if (typeof raw !== 'string') return 'pt';
  const clean = raw.trim().toLowerCase();
  if (clean in LANGUAGE_META_MAP) {
    return clean as LanguageCode;
  }
  return 'pt';
}
