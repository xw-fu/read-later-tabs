import { describe, it, expect } from 'vitest';
import { recordVisit, classifyDomain } from '../../src/background/domain-profiler';
import type { DomainProfile } from '../../src/lib/types';

describe('domain-profiler', () => {
  it('recordVisit creates a fresh profile when missing', () => {
    const next = recordVisit({}, 'example.com', 30);
    expect(next['example.com']).toEqual<DomainProfile>({
      domain: 'example.com', totalVisitCount: 1, totalActiveSeconds: 30,
      isToolByHeuristic: false, userOverride: null,
    });
  });

  it('recordVisit increments existing counters', () => {
    const start: Record<string, DomainProfile> = {
      'example.com': { domain: 'example.com', totalVisitCount: 2, totalActiveSeconds: 60, isToolByHeuristic: false, userOverride: null },
    };
    const next = recordVisit(start, 'example.com', 90);
    expect(next['example.com'].totalVisitCount).toBe(3);
    expect(next['example.com'].totalActiveSeconds).toBe(150);
  });

  it('classifyDomain marks as tool by visit-count threshold', () => {
    const profile: DomainProfile = { domain: 'a.com', totalVisitCount: 7, totalActiveSeconds: 30, isToolByHeuristic: false, userOverride: null };
    const out = classifyDomain(profile, { visitWindowDays: 7, recentVisits: 7, recentActiveSeconds: 30 });
    expect(out.isToolByHeuristic).toBe(true);
  });

  it('classifyDomain marks as tool by daily-active-time threshold', () => {
    const profile: DomainProfile = { domain: 'a.com', totalVisitCount: 1, totalActiveSeconds: 30, isToolByHeuristic: false, userOverride: null };
    const out = classifyDomain(profile, { visitWindowDays: 7, recentVisits: 1, recentActiveSeconds: 7 * 400 });
    expect(out.isToolByHeuristic).toBe(true);
  });

  it('classifyDomain returns false when neither threshold met', () => {
    const profile: DomainProfile = { domain: 'a.com', totalVisitCount: 1, totalActiveSeconds: 30, isToolByHeuristic: true, userOverride: null };
    const out = classifyDomain(profile, { visitWindowDays: 7, recentVisits: 1, recentActiveSeconds: 30 });
    expect(out.isToolByHeuristic).toBe(false);
  });
});
