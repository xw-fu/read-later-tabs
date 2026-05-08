import type { DomainProfile } from '../lib/types';

const VISITS_PER_WEEK_TOOL = 5;
const AVG_DAILY_ACTIVE_SECS_TOOL = 300; // 5 minutes

export function recordVisit(
  profiles: Record<string, DomainProfile>,
  domain: string,
  activeSeconds: number,
): Record<string, DomainProfile> {
  const next = { ...profiles };
  const existing = next[domain];
  if (existing) {
    next[domain] = {
      ...existing,
      totalVisitCount: existing.totalVisitCount + 1,
      totalActiveSeconds: existing.totalActiveSeconds + activeSeconds,
    };
  } else {
    next[domain] = {
      domain, totalVisitCount: 1, totalActiveSeconds: activeSeconds,
      isToolByHeuristic: false, userOverride: null,
    };
  }
  return next;
}

export interface RecentSnapshot {
  visitWindowDays: number;
  recentVisits: number;
  recentActiveSeconds: number;
}

export function classifyDomain(profile: DomainProfile, recent: RecentSnapshot): DomainProfile {
  const avgDaily = recent.recentActiveSeconds / Math.max(1, recent.visitWindowDays);
  const isToolByHeuristic =
    recent.recentVisits >= VISITS_PER_WEEK_TOOL ||
    avgDaily >= AVG_DAILY_ACTIVE_SECS_TOOL;
  return { ...profile, isToolByHeuristic };
}

export function isTool(profile: DomainProfile | undefined): boolean {
  if (!profile) return false;
  if (profile.userOverride === 'tool') return true;
  if (profile.userOverride === 'content') return false;
  return profile.isToolByHeuristic;
}
