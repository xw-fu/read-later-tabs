import type { TabRecord, DomainProfile, VerdictLog, VerdictEvent, Settings } from './types';

const KEYS = {
  tabs: 'tabs',
  domains: 'domains',
  verdicts: 'verdicts',
  settings: 'settings',
  verdictEvents: 'verdict-events',
} as const;

const DEFAULT_SETTINGS: Settings = {
  aiKey: null,
  aiProvider: 'none',
  aiCustom: null,
  excludedDomains: [],
  thresholds: { agedDays: 14, toolMinDailySeconds: 300 },
  dailyTarget: 5,
};

const VERDICT_EVENTS_CAP = 50;

async function getKey<T>(key: string, fallback: T): Promise<T> {
  const r = await chrome.storage.local.get(key);
  return (r[key] as T) ?? fallback;
}

export const storage = {
  async getTabs(): Promise<TabRecord[]> {
    return getKey<TabRecord[]>(KEYS.tabs, []);
  },
  async setTabs(tabs: TabRecord[]): Promise<void> {
    await chrome.storage.local.set({ [KEYS.tabs]: tabs });
  },
  async upsertTab(tab: TabRecord): Promise<void> {
    const tabs = await this.getTabs();
    const idx = tabs.findIndex(t => t.tabId === tab.tabId);
    if (idx >= 0) tabs[idx] = tab; else tabs.push(tab);
    await this.setTabs(tabs);
  },
  async removeTab(tabId: number): Promise<void> {
    const tabs = await this.getTabs();
    await this.setTabs(tabs.filter(t => t.tabId !== tabId));
  },

  async getDomainProfiles(): Promise<Record<string, DomainProfile>> {
    return getKey<Record<string, DomainProfile>>(KEYS.domains, {});
  },
  async setDomainProfiles(profiles: Record<string, DomainProfile>): Promise<void> {
    await chrome.storage.local.set({ [KEYS.domains]: profiles });
  },
  async upsertDomainProfile(profile: DomainProfile): Promise<void> {
    const map = await this.getDomainProfiles();
    map[profile.domain] = profile;
    await this.setDomainProfiles(map);
  },
  async setDomainOverride(
    domain: string,
    override: 'tool' | 'content' | null,
  ): Promise<void> {
    const map = await this.getDomainProfiles();
    const existing = map[domain];
    map[domain] = existing
      ? { ...existing, userOverride: override }
      : {
          domain,
          totalVisitCount: 0,
          totalActiveSeconds: 0,
          isToolByHeuristic: false,
          userOverride: override,
        };
    await this.setDomainProfiles(map);
  },

  async getVerdictLogs(): Promise<VerdictLog[]> {
    return getKey<VerdictLog[]>(KEYS.verdicts, []);
  },
  async setVerdictLogs(logs: VerdictLog[]): Promise<void> {
    await chrome.storage.local.set({ [KEYS.verdicts]: logs });
  },

  async getVerdictEvents(): Promise<VerdictEvent[]> {
    const raw = await getKey<unknown>(KEYS.verdictEvents, []);
    return Array.isArray(raw) ? (raw as VerdictEvent[]) : [];
  },
  async pushVerdictEvent(event: VerdictEvent): Promise<void> {
    const list = await this.getVerdictEvents();
    list.push(event);
    const trimmed = list.length > VERDICT_EVENTS_CAP ? list.slice(-VERDICT_EVENTS_CAP) : list;
    await chrome.storage.local.set({ [KEYS.verdictEvents]: trimmed });
  },

  async getSettings(): Promise<Settings> {
    const stored = await getKey<Partial<Settings>>(KEYS.settings, {});
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      excludedDomains: Array.isArray(stored.excludedDomains) ? stored.excludedDomains : DEFAULT_SETTINGS.excludedDomains,
      thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(stored.thresholds ?? {}) },
    };
  },
  async setSettings(settings: Settings): Promise<void> {
    await chrome.storage.local.set({ [KEYS.settings]: settings });
  },
};
