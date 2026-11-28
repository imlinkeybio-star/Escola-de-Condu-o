export const APP_OWNER_EMAIL = 'kordelmauvesp@gmail.com';
export const APP_OWNER_USERNAME = 'kordelmauve';

export function isAppOwnerEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === APP_OWNER_EMAIL);
}

/**
 * Validates and normalizes a user/owner-supplied URL so only safe http(s) or
 * relative app paths ('/...') are accepted. Rejects javascript:, data:, vbscript:, etc.
 */
export function sanitizeSafeUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return null;
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isInternalPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

export interface CleanVideoSource {
  kind: 'youtube' | 'vimeo' | 'direct' | 'iframe';
  embedUrl: string;
  videoId?: string;
}

export function extractYouTubeVideoId(raw?: string | null): string | null {
  const safe = sanitizeSafeUrl(raw);
  if (!safe || isInternalPath(safe)) return null;
  try {
    const u = new URL(safe);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    let videoId: string | null = null;
    if (host === 'youtu.be') {
      videoId = u.pathname.slice(1).split('/')[0] || null;
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v');
      } else if (
        u.pathname.startsWith('/embed/') ||
        u.pathname.startsWith('/shorts/') ||
        u.pathname.startsWith('/live/')
      ) {
        videoId = u.pathname.split('/')[2] || null;
      }
    }
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return videoId;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractYouTubeEmbedUrl(raw?: string | null): string | null {
  const videoId = extractYouTubeVideoId(raw);
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0&showinfo=0&enablejsapi=1&loop=1&playlist=${videoId}`;
}

export function parseCleanVideoSource(raw?: string | null): CleanVideoSource | null {
  const safe = sanitizeSafeUrl(raw);
  if (!safe) return null;

  const ytId = extractYouTubeVideoId(safe);
  if (ytId) {
    return {
      kind: 'youtube',
      videoId: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0&showinfo=0&enablejsapi=1&loop=1&playlist=${ytId}`,
    };
  }

  if (!isInternalPath(safe)) {
    try {
      const u = new URL(safe);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const parts = u.pathname.split('/').filter(Boolean);
        const maybeId = parts[parts.length - 1];
        if (maybeId && /^\d{4,15}$/.test(maybeId)) {
          return {
            kind: 'vimeo',
            videoId: maybeId,
            embedUrl: `https://player.vimeo.com/video/${maybeId}?autoplay=1&muted=1&controls=0&title=0&byline=0&portrait=0&dnt=1&loop=1&api=1`,
          };
        }
      }

      if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(u.pathname)) {
        return { kind: 'direct', embedUrl: safe };
      }

      if (host.includes('firebasestorage.googleapis.com')) {
        return { kind: 'direct', embedUrl: safe };
      }

      return { kind: 'iframe', embedUrl: safe };
    } catch {
      return null;
    }
  }

  return { kind: 'direct', embedUrl: safe };
}

export function getSafeLinkHostLabel(linkUrl?: string | null): string {
  const safe = sanitizeSafeUrl(linkUrl);
  if (!safe || isInternalPath(safe)) return 'ESCOLA DE CONDUÇÃO LIVE';
  try {
    const u = new URL(safe);
    return u.hostname.replace(/^www\./, '').toUpperCase();
  } catch {
    return 'ESCOLA DE CONDUÇÃO LIVE';
  }
}

export function sanitizeAvatarPhotoUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/assets/') && !trimmed.startsWith('//') && trimmed.length <= 500) {
    return trimmed;
  }

  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 80000 ? trimmed : null;
  }

  if (trimmed.length > 500) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export type AdBroadcastKindLite =
  | 'informative'
  | 'link'
  | 'ad_audio'
  | 'ad_banner'
  | 'ad_video';

export function getMaxAdDurationSeconds(kind: AdBroadcastKindLite): number {
  if (kind === 'ad_banner') return 8;
  if (kind === 'ad_video') return 20;
  return 60;
}

export function getDefaultAdDurationSeconds(kind: AdBroadcastKindLite): number {
  if (kind === 'ad_banner') return 8;
  if (kind === 'ad_video') return 20;
  return 10;
}

export function getMinAdDurationSeconds(): number {
  return 1;
}

export function clampAdDurationSeconds(
  kind: AdBroadcastKindLite,
  raw?: number | null
): number {
  const min = getMinAdDurationSeconds();
  const max = getMaxAdDurationSeconds(kind);
  const fallback = getDefaultAdDurationSeconds(kind);
  const value =
    typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fallback;
  return Math.min(Math.max(value, min), max);
}

export function validateAdDurationSeconds(
  kind: AdBroadcastKindLite,
  raw: unknown
): { valid: boolean; value: number; min: number; max: number; reason?: string } {
  const min = getMinAdDurationSeconds();
  const max = getMaxAdDurationSeconds(kind);
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return {
      valid: false,
      value: clampAdDurationSeconds(kind, null),
      min,
      max,
      reason: `A duração deve ser um número inteiro entre ${min}s e ${max}s.`,
    };
  }
  if (num < min || num > max) {
    return {
      valid: false,
      value: num,
      min,
      max,
      reason:
        kind === 'ad_banner'
          ? `Anúncio em banner deve ter entre ${min}s e máximo ${max}s.`
          : kind === 'ad_video'
            ? `Anúncio em vídeo deve ter entre ${min}s e máximo ${max}s.`
            : `Duração deve estar entre ${min}s e ${max}s.`,
    };
  }
  return { valid: true, value: num, min, max };
}

