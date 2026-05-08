import type { TabRecord, DomainProfile, VerdictLog, RecommendationResult } from '../types';

export interface Recommender {
  pick(
    tabs: TabRecord[],
    profiles: Record<string, DomainProfile>,
    history: VerdictLog[],
  ): TabRecord | null;
  ranked?(
    tabs: TabRecord[],
    profiles: Record<string, DomainProfile>,
    history: VerdictLog[],
  ): TabRecord[];
  withReason?(
    tabs: TabRecord[],
    profiles: Record<string, DomainProfile>,
    history: VerdictLog[],
    opts?: { bypassCache?: boolean },
  ): Promise<RecommendationResult | null>;
}
