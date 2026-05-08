import { describe, it, expect } from 'vitest';
import {
  fingerprint, modeId, computeCacheKey, verdictSignature,
  readCache, writeCache,
} from '../../../src/lib/recommender/cache';
import type { Mode } from '../../../src/lib/recommender/ai';
import type { TabRecord, RecommendationResult, VerdictEvent } from '../../../src/lib/types';

function tab(id: number, domain = 'a.com'): TabRecord {
  return {
    tabId: id, windowId: 1, url: `https://${domain}`, title: 't',
    favIconUrl: null, domain,
    firstSeenAt: 0, lastVisitedAt: 0, visitCount: 0,
    estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
  };
}

describe('fingerprint', () => {
  it('is empty string for empty list', () => {
    expect(fingerprint([])).toBe('');
  });

  it('joins sorted tabIds with commas', () => {
    expect(fingerprint([tab(3), tab(1), tab(2)])).toBe('1,2,3');
  });

  it('is order-independent', () => {
    expect(fingerprint([tab(1), tab(2)])).toBe(fingerprint([tab(2), tab(1)]));
  });
});

describe('modeId', () => {
  it('encodes openai as just the kind', () => {
    expect(modeId({ kind: 'openai', apiKey: 'k' })).toBe('openai');
  });

  it('encodes anthropic as just the kind', () => {
    expect(modeId({ kind: 'anthropic', apiKey: 'k' })).toBe('anthropic');
  });

  it('encodes custom with protocol, baseUrl, model', () => {
    const m: Mode = {
      kind: 'custom', protocol: 'openai',
      baseUrl: 'https://gw.example/v1', model: 'gpt-x',
      apiKey: 'k', extraHeaders: {},
    };
    expect(modeId(m)).toBe('custom:openai:https://gw.example/v1:gpt-x');
  });
});

describe('computeCacheKey', () => {
  const m: Mode = { kind: 'openai', apiKey: 'k' };

  it('combines modeId, fingerprint, lastDomain, verdictSig', () => {
    expect(computeCacheKey(m, [tab(1), tab(2)], 'a.com', 'sig123'))
      .toBe('openai|1,2|a.com|sig123');
  });

  it('treats null lastDomain as empty', () => {
    expect(computeCacheKey(m, [tab(1)], null, '')).toBe('openai|1||');
  });

  it('produces different keys for different candidate sets', () => {
    expect(computeCacheKey(m, [tab(1)], null, ''))
      .not.toBe(computeCacheKey(m, [tab(2)], null, ''));
  });

  it('produces different keys when verdictSig differs', () => {
    expect(computeCacheKey(m, [tab(1)], null, 'a'))
      .not.toBe(computeCacheKey(m, [tab(1)], null, 'b'));
  });
});

describe('readCache / writeCache', () => {
  const sample = { key: 'k', dayKey: '2026-04-28', result: { tab: tab(7), reason: 'ok' } as RecommendationResult };

  it('returns null when nothing stored', async () => {
    expect(await readCache()).toBeNull();
  });

  it('roundtrips an entry', async () => {
    await writeCache(sample);
    expect(await readCache()).toEqual(sample);
  });

  it('overwrites on second write', async () => {
    await writeCache(sample);
    const next = { ...sample, key: 'k2' };
    await writeCache(next);
    expect(await readCache()).toEqual(next);
  });
});

describe('verdictSignature', () => {
  function ev(ts: number): VerdictEvent {
    return { ts, verdict: 'read', title: 't', domain: 'd' };
  }

  it('is empty string for empty list', () => {
    expect(verdictSignature([])).toBe('');
  });

  it('joins ts of last 15 events with commas', () => {
    expect(verdictSignature([ev(1), ev(2), ev(3)])).toBe('1,2,3');
  });

  it('only takes the last 15 events', () => {
    const events = Array.from({ length: 20 }, (_, i) => ev(i));
    const sig = verdictSignature(events);
    expect(sig.split(',').length).toBe(15);
    expect(sig.split(',')[0]).toBe('5');
    expect(sig.split(',')[14]).toBe('19');
  });

  it('a new event changes the signature', () => {
    const before = verdictSignature([ev(1), ev(2)]);
    const after = verdictSignature([ev(1), ev(2), ev(3)]);
    expect(before).not.toBe(after);
  });
});
