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

export function extractYouTubeEmbedUrl(raw?: string | null): string | null {
  const safe = sanitizeSafeUrl(raw);
  if (!safe || isInternalPath(safe)) return null;
  try {
    const u = new URL(safe);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    let videoId: string | null = null;
    if (host === 'youtu.be') {
      videoId = u.pathname.slice(1).split('/')[0] || null;
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.split('/')[2] || null;
      }
    }
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    }
    return null;
  } catch {
    return null;
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
