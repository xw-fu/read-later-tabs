import { storage } from '../lib/storage';
import { isTool } from './domain-profiler';
import type { TabTracker } from './tab-tracker';
import type { TabRecord } from '../lib/types';

const DAY = 86_400_000;

export interface CronOpts { now?: number }

// Tracker is optional purely so existing standalone unit tests can keep calling
// `runAgingCron()` without wiring up a tracker. In production (service-worker)
// it MUST be passed: routing the tabs read-modify-write through the tracker's
// enqueue is what prevents the cron from resurrecting a tab that was closed
// mid-run (the bug the user hit right after `chrome.runtime.onInstalled` fired
// this cron and they immediately closed a Chrome tab).
export async function runAgingCron(
  opts: CronOpts = {},
  tracker?: TabTracker,
): Promise<void> {
  const now = opts.now ?? Date.now();
  const profiles = await storage.getDomainProfiles();

  const updateIsTool = (tabs: TabRecord[]): TabRecord[] =>
    tabs.map(t => {
      const desired = isTool(profiles[t.domain]);
      return desired === t.isTool ? t : { ...t, isTool: desired };
    });

  if (tracker) {
    await tracker.updateTabs(updateIsTool);
  } else {
    const tabs = await storage.getTabs();
    await storage.setTabs(updateIsTool(tabs));
  }

  // Verdict logs use a separate storage key, so they can't race with tab writes.
  const cutoff = now - 30 * DAY;
  const logs = await storage.getVerdictLogs();
  const fresh = logs.filter(l => new Date(l.date).getTime() >= cutoff);
  if (fresh.length !== logs.length) await storage.setVerdictLogs(fresh);
}
