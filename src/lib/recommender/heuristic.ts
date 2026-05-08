import type { TabRecord, DomainProfile, VerdictLog } from '../types';
import type { Recommender } from './types';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_READING = 30;

interface Options {
  now?: number;
  lastDomain?: string | null;
  agedHorizon?: number;   // days at which ageWeight saturates
  excludedDomains?: string[];
}

export class HeuristicRecommender implements Recommender {
  private readonly now: number;
  private readonly lastDomain: string | null;
  private readonly agedHorizon: number;
  private readonly excluded: Set<string>;

  constructor(opts: Options = {}) {
    this.now = opts.now ?? Date.now();
    this.lastDomain = opts.lastDomain ?? null;
    this.agedHorizon = opts.agedHorizon ?? 14;
    this.excluded = new Set(opts.excludedDomains ?? []);
  }

  pick(tabs: TabRecord[], profiles: Record<string, DomainProfile>, history: VerdictLog[]): TabRecord | null {
    const r = this.ranked(tabs, profiles, history);
    return r.length === 0 ? null : r[0];
  }

  ranked(tabs: TabRecord[], _profiles: Record<string, DomainProfile>, _history: VerdictLog[]): TabRecord[] {
    const candidates = tabs.filter(t =>
      !t.isTool && !t.isPinned && !t.isArchived &&
      t.estimatedReadingMinutes <= MAX_READING &&
      !this.excluded.has(t.domain),
    );
    return candidates
      .map(t => ({ tab: t, score: this.score(t) }))
      .sort((a, b) => b.score - a.score)
      .map(r => r.tab);
  }

  private score(t: TabRecord): number {
    const ageDays = Math.max(0, (this.now - t.firstSeenAt) / DAY_MS);
    const ageWeight = Math.min(ageDays / this.agedHorizon, 1);

    const shortReadingBonus = Math.max(0, Math.min(1, 1 - t.estimatedReadingMinutes / MAX_READING));

    const hoursSinceVisit = (this.now - t.lastVisitedAt) / HOUR_MS;
    const revisitDecay = hoursSinceVisit > 24 ? 1 : 0;

    const varietyBonus = (this.lastDomain && t.domain !== this.lastDomain) ? 1 : 0;

    return 0.45 * ageWeight + 0.30 * shortReadingBonus + 0.15 * revisitDecay + 0.10 * varietyBonus;
  }
}
