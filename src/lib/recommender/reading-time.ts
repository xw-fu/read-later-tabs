import { extractDomain } from '../domain';

interface Metadata {
  videoSeconds?: number;
  metaReadingMinutes?: number;
}

const FALLBACK = 8;
const CAP = 30;

const FIXED_BY_DOMAIN: Record<string, number> = {
  'github.com': 5,
};

const VIDEO_DOMAINS = new Set(['youtube.com', 'youtu.be', 'vimeo.com']);

export function estimateReadingMinutes(
  url: string,
  textLength: number,
  meta: Metadata = {},
): number {
  const d = extractDomain(url);

  if (VIDEO_DOMAINS.has(d)) {
    const sec = meta.videoSeconds;
    if (typeof sec === 'number' && sec > 0) return Math.min(CAP, Math.max(1, Math.round(sec / 60)));
    return 10;
  }

  if (d in FIXED_BY_DOMAIN) return FIXED_BY_DOMAIN[d];

  if (typeof meta.metaReadingMinutes === 'number' && meta.metaReadingMinutes > 0) {
    return Math.min(CAP, Math.max(1, Math.round(meta.metaReadingMinutes)));
  }

  if (textLength <= 0) return FALLBACK;

  // Roughly 1500 chars per minute, mixed CJK/Latin friendly.
  return Math.min(CAP, Math.max(1, Math.ceil(textLength / 1500)));
}
