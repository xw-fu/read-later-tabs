import { storage } from '../lib/storage';
import { selectRecommender } from '../lib/recommender';
import { fingerprint } from '../lib/recommender/cache';
import { pickTodayReadCount } from '../lib/verdicts';
import { todayKey } from '../lib/dates';
import { isTrackableUrl } from '../lib/domain';
import type { TabRecord, Settings, RecommendationResult, VerdictLog } from '../lib/types';

interface State {
  tabs: TabRecord[];
  verdicts: VerdictLog[];
  settings: Settings | null;
  loading: boolean;
  recommendation: RecommendationResult | null;
  rejectedTabIds: Set<number>;     // 改天 list
  changeHistory: number[];          // tabIds shown via 换一个
  lastCandidateFingerprint: string | null;
}

export function createNewTabStore() {
  const state = $state<State>({
    tabs: [],
    verdicts: [],
    settings: null,
    loading: true,
    recommendation: null,
    rejectedTabIds: new Set(),
    changeHistory: [],
    lastCandidateFingerprint: null,
  });

  // Defensive: drop any pre-existing records for the extension's own newtab
  // page or other internal URLs that may have been persisted before the
  // TabTracker filter was added. Keeps archived records (history) intact.
  const openTabs = $derived(state.tabs.filter(t => !t.isArchived && isTrackableUrl(t.url)));
  const visible = $derived(openTabs.filter(t => !t.isTool && !t.isPinned));
  const tools = $derived(openTabs.filter(t => t.isTool && !t.isPinned));
  const archived = $derived(state.tabs.filter(t => t.isArchived));
  const todayReadCount = $derived(pickTodayReadCount(state.verdicts, todayKey()));

  async function refresh() {
    state.tabs = await storage.getTabs();
    state.settings = await storage.getSettings();
    state.verdicts = await storage.getVerdictLogs();
    await refreshRecommendation();
    state.loading = false;
  }

  async function refreshRecommendation(opts: { bypassCache?: boolean } = {}) {
    if (!state.settings) state.settings = await storage.getSettings();

    const candidates = filteredCandidates();
    const fp = fingerprint(candidates);
    if (
      !opts.bypassCache &&
      state.recommendation &&
      state.lastCandidateFingerprint === fp
    ) {
      return; // same candidate set, no need to recompute
    }
    state.lastCandidateFingerprint = fp;

    const lastDomain = state.recommendation?.tab.domain ?? null;
    const installKeyEntry = await chrome.storage.local.get('install-key');
    let plaintext: string | null = null;
    if (state.settings.aiKey && installKeyEntry['install-key']) {
      try {
        const { decryptString } = await import('../lib/crypto');
        plaintext = await decryptString(state.settings.aiKey, installKeyEntry['install-key'] as string);
      } catch { plaintext = null; }
    }
    const installKey = (installKeyEntry['install-key'] as string | undefined) ?? null;
    const recommender = await selectRecommender(state.settings, plaintext, installKey, { lastDomain });
    if (recommender.withReason) {
      const r = await recommender.withReason(candidates, {}, state.verdicts, { bypassCache: opts.bypassCache });
      state.recommendation = r;
    } else {
      const tab = recommender.pick(candidates, {}, []);
      state.recommendation = tab ? { tab, reason: null, headline: null } : null;
    }
  }

  function filteredCandidates(): TabRecord[] {
    return visible.filter(t => !state.rejectedTabIds.has(t.tabId) && !state.changeHistory.includes(t.tabId));
  }

  function rejectCurrentRecommendation() {
    if (state.recommendation) state.rejectedTabIds.add(state.recommendation.tab.tabId);
  }

  function noteChanged() {
    if (state.recommendation) state.changeHistory.push(state.recommendation.tab.tabId);
  }

  return {
    get state() { return state; },
    get openTabs() { return openTabs; },
    get visible() { return visible; },
    get tools() { return tools; },
    get archived() { return archived; },
    get todayReadCount() { return todayReadCount; },
    refresh,
    refreshRecommendation,
    rejectCurrentRecommendation,
    noteChanged,
  };
}

export type NewTabStore = ReturnType<typeof createNewTabStore>;
