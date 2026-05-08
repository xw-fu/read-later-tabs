import type { TabRecord, RecommendationResult, VerdictEvent } from '../types';
import type { Mode } from './ai';

const SESSION_KEY = 'ai-rec-cache-v2';

export interface CachedEntry {
  key: string;
  dayKey: string;
  result: RecommendationResult;
}

export function fingerprint(candidates: TabRecord[]): string {
  return candidates.map(t => t.tabId).sort((a, b) => a - b).join(',');
}

export function modeId(mode: Mode): string {
  if (mode.kind === 'custom') {
    return `custom:${mode.protocol}:${mode.baseUrl}:${mode.model}`;
  }
  return mode.kind;
}

export function verdictSignature(events: VerdictEvent[]): string {
  return events.slice(-15).map(e => e.ts).join(',');
}

export function computeCacheKey(
  mode: Mode,
  candidates: TabRecord[],
  lastDomain: string | null,
  verdictSig: string,
): string {
  return `${modeId(mode)}|${fingerprint(candidates)}|${lastDomain ?? ''}|${verdictSig}`;
}

export async function readCache(): Promise<CachedEntry | null> {
  try {
    const r = await chrome.storage.session.get(SESSION_KEY);
    return (r[SESSION_KEY] as CachedEntry | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeCache(entry: CachedEntry): Promise<void> {
  try {
    await chrome.storage.session.set({ [SESSION_KEY]: entry });
  } catch {
    // session storage missing or full — silently skip; AI still works
  }
}
