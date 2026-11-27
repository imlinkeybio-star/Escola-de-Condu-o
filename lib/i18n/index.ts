import { ptDict, TranslationDict } from './dict-base';
import { enDict, esDict } from './dict-en-es';
import { frDict, ruDict } from './dict-fr-ru';
import { zhDict, jaDict, arDict } from './dict-zh-ja-ar';
import {
  LanguageCode,
  LANGUAGE_META_MAP,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES,
} from './types';
import {
  ACHIEVEMENT_I18N,
  CATEGORY_TRANSLATIONS,
  CORE_RULES_I18N,
  DIFFICULTY_TRANSLATIONS,
  ROOM_STATUS_TRANSLATIONS,
  SIGN_LABELS_I18N,
  TIER_TRANSLATIONS,
} from './catalog';
import { DriverTier, DifficultyLevel, RoomStatus } from '@/lib/types';

export * from './types';
export * from './catalog';
export type { TranslationDict };

export const LANGUAGE_STORAGE_KEY = 'ecl_language';

export const DICTIONARIES: Record<LanguageCode, TranslationDict> = {
  pt: ptDict,
  en: enDict,
  es: esDict,
  fr: frDict,
  ru: ruDict,
  zh: zhDict,
  ja: jaDict,
  ar: arDict,
};

export function getDictionary(lang: LanguageCode): TranslationDict {
  return DICTIONARIES[lang] ?? ptDict;
}

export function tFormat(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return Object.entries(vars).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value));
  }, template);
}

export function getActiveLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'pt';
  try {
    return normalizeLanguageCode(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return 'pt';
  }
}

export function translateTier(lang: LanguageCode, tier?: DriverTier | string): string {
  if (!tier) return '';
  const map = TIER_TRANSLATIONS[lang] ?? TIER_TRANSLATIONS.pt;
  return (map as Record<string, string>)[tier] ?? tier;
}

export function translateDifficulty(
  lang: LanguageCode,
  diff?: DifficultyLevel | string
): string {
  if (!diff) return '';
  const map = DIFFICULTY_TRANSLATIONS[lang] ?? DIFFICULTY_TRANSLATIONS.pt;
  return (map as Record<string, string>)[diff] ?? diff;
}

export function translateCategory(lang: LanguageCode, category?: string): string {
  if (!category) return '';
  const map = CATEGORY_TRANSLATIONS[lang] ?? CATEGORY_TRANSLATIONS.pt;
  return map[category] ?? category;
}

export function translateRoomStatus(
  lang: LanguageCode,
  status?: RoomStatus
): string {
  if (!status) return '';
  const map = ROOM_STATUS_TRANSLATIONS[lang] ?? ROOM_STATUS_TRANSLATIONS.pt;
  return map[status] ?? status;
}

export function translateSignLabel(lang: LanguageCode, signType: string): string {
  const map = SIGN_LABELS_I18N[lang] ?? SIGN_LABELS_I18N.pt;
  return map[signType] ?? signType;
}

export function translateAchievement(
  lang: LanguageCode,
  id: string,
  fallbackTitle: string,
  fallbackDesc: string
): { title: string; description: string } {
  const map = ACHIEVEMENT_I18N[lang] ?? ACHIEVEMENT_I18N.pt;
  return map[id] ?? { title: fallbackTitle, description: fallbackDesc };
}

export function getCoreRules(lang: LanguageCode) {
  return CORE_RULES_I18N[lang] ?? CORE_RULES_I18N.pt;
}

export function formatDateLocale(
  lang: LanguageCode,
  ms: number,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  const locale = LANGUAGE_META_MAP[lang]?.bcp47 ?? 'pt-AO';
  return new Date(ms).toLocaleDateString(locale, options);
}

export function formatNumberLocale(lang: LanguageCode, value: number): string {
  const locale = LANGUAGE_META_MAP[lang]?.bcp47 ?? 'pt-AO';
  return value.toLocaleString(locale);
}

export { SUPPORTED_LANGUAGES, LANGUAGE_META_MAP };
