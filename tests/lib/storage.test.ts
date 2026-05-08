import { describe, it, expect } from 'vitest';
import { storage } from '../../src/lib/storage';
import type { TabRecord } from '../../src/lib/types';

const sampleTab: TabRecord = {
  tabId: 1, windowId: 1, url: 'https://a.com', title: 'A',
  favIconUrl: null, domain: 'a.com',
  firstSeenAt: 1000, lastVisitedAt: 1000, visitCount: 0,
  estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
};

describe('storage', () => {
  it('returns empty defaults when nothing stored', async () => {
    const tabs = await storage.getTabs();
    const profiles = await storage.getDomainProfiles();
    const verdicts = await storage.getVerdictLogs();
    expect(tabs).toEqual([]);
    expect(profiles).toEqual({});
    expect(verdicts).toEqual([]);
  });

  it('roundtrips a TabRecord', async () => {
    await storage.setTabs([sampleTab]);
    const got = await storage.getTabs();
    expect(got).toEqual([sampleTab]);
  });

  it('upserts a single TabRecord by tabId', async () => {
    await storage.setTabs([sampleTab]);
    await storage.upsertTab({ ...sampleTab, title: 'A v2' });
    const got = await storage.getTabs();
    expect(got).toHaveLength(1);
    expect(got[0].title).toBe('A v2');
  });

  it('removes a tab by tabId', async () => {
    await storage.setTabs([sampleTab]);
    await storage.removeTab(1);
    const got = await storage.getTabs();
    expect(got).toEqual([]);
  });

  it('returns default settings when none stored', async () => {
    const s = await storage.getSettings();
    expect(s.aiKey).toBeNull();
    expect(s.aiProvider).toBe('none');
    expect(s.thresholds.agedDays).toBe(14);
  });

  it('persists and reads settings', async () => {
    await storage.setSettings({
      aiKey: 'enc', aiProvider: 'anthropic', aiCustom: null, excludedDomains: ['x.com'],
      thresholds: { agedDays: 7, toolMinDailySeconds: 600 }, dailyTarget: 5,
    });
    const s = await storage.getSettings();
    expect(s.aiProvider).toBe('anthropic');
    expect(s.thresholds.agedDays).toBe(7);
  });

  it('returns aiCustom: null in default settings', async () => {
    const s = await storage.getSettings();
    expect(s.aiCustom).toBeNull();
  });

  it('preserves aiCustom when present in stored settings', async () => {
    await storage.setSettings({
      aiKey: 'enc',
      aiProvider: 'custom',
      aiCustom: {
        protocol: 'openai',
        baseUrl: 'https://gw.example/v1',
        model: 'foo',
        extraHeaders: 'enc-headers',
      },
      excludedDomains: [],
      thresholds: { agedDays: 14, toolMinDailySeconds: 300 },
      dailyTarget: 5,
    });
    const s = await storage.getSettings();
    expect(s.aiCustom).toEqual({
      protocol: 'openai',
      baseUrl: 'https://gw.example/v1',
      model: 'foo',
      extraHeaders: 'enc-headers',
    });
  });

  it('reads back aiCustom: null for older settings missing the field', async () => {
    // simulate stored shape from before the migration
    await chrome.storage.local.set({
      settings: { aiKey: null, aiProvider: 'none', excludedDomains: [], thresholds: { agedDays: 14, toolMinDailySeconds: 300 } },
    });
    const s = await storage.getSettings();
    expect(s.aiCustom).toBeNull();
  });

  it('returns dailyTarget: 5 in default settings', async () => {
    const s = await storage.getSettings();
    expect(s.dailyTarget).toBe(5);
  });

  it('reads back dailyTarget: 5 for older settings missing the field', async () => {
    await chrome.storage.local.set({
      settings: {
        aiKey: null, aiProvider: 'none', aiCustom: null,
        excludedDomains: [], thresholds: { agedDays: 14, toolMinDailySeconds: 300 },
      },
    });
    const s = await storage.getSettings();
    expect(s.dailyTarget).toBe(5);
  });

  it('persists a custom dailyTarget', async () => {
    await storage.setSettings({
      aiKey: null, aiProvider: 'none', aiCustom: null,
      excludedDomains: [], thresholds: { agedDays: 14, toolMinDailySeconds: 300 },
      dailyTarget: 3,
    });
    const s = await storage.getSettings();
    expect(s.dailyTarget).toBe(3);
  });

  it('setDomainOverride creates a minimal profile if domain unknown', async () => {
    await storage.setDomainOverride('news.ycombinator.com', 'tool');
    const profiles = await storage.getDomainProfiles();
    expect(profiles['news.ycombinator.com']).toEqual({
      domain: 'news.ycombinator.com',
      totalVisitCount: 0,
      totalActiveSeconds: 0,
      isToolByHeuristic: false,
      userOverride: 'tool',
    });
  });

  it('setDomainOverride updates existing profile without losing other fields', async () => {
    await storage.setDomainProfiles({
      'medium.com': {
        domain: 'medium.com',
        totalVisitCount: 7,
        totalActiveSeconds: 1800,
        isToolByHeuristic: false,
        userOverride: null,
      },
    });
    await storage.setDomainOverride('medium.com', 'content');
    const profiles = await storage.getDomainProfiles();
    expect(profiles['medium.com']).toEqual({
      domain: 'medium.com',
      totalVisitCount: 7,
      totalActiveSeconds: 1800,
      isToolByHeuristic: false,
      userOverride: 'content',
    });
  });

  it('setDomainOverride(null) clears the override', async () => {
    await storage.setDomainProfiles({
      'foo.com': {
        domain: 'foo.com', totalVisitCount: 0, totalActiveSeconds: 0,
        isToolByHeuristic: true, userOverride: 'content',
      },
    });
    await storage.setDomainOverride('foo.com', null);
    const profiles = await storage.getDomainProfiles();
    expect(profiles['foo.com'].userOverride).toBeNull();
    expect(profiles['foo.com'].isToolByHeuristic).toBe(true);  // unchanged
  });

  it('returns empty array when no verdict events stored', async () => {
    expect(await storage.getVerdictEvents()).toEqual([]);
  });

  it('pushVerdictEvent appends in order', async () => {
    await storage.pushVerdictEvent({ ts: 1, verdict: 'read', title: 'A', domain: 'a.com' });
    await storage.pushVerdictEvent({ ts: 2, verdict: 'trash', title: 'B', domain: 'b.com' });
    const events = await storage.getVerdictEvents();
    expect(events.map(e => e.title)).toEqual(['A', 'B']);
  });

  it('pushVerdictEvent caps the buffer at 50 (oldest dropped)', async () => {
    for (let i = 0; i < 60; i++) {
      await storage.pushVerdictEvent({ ts: i, verdict: 'read', title: `T${i}`, domain: 'a.com' });
    }
    const events = await storage.getVerdictEvents();
    expect(events).toHaveLength(50);
    expect(events[0].title).toBe('T10');     // dropped 0..9
    expect(events[49].title).toBe('T59');
  });

  it('getVerdictEvents returns [] when stored payload is corrupt', async () => {
    await chrome.storage.local.set({ 'verdict-events': 'not-an-array' });
    expect(await storage.getVerdictEvents()).toEqual([]);
  });
});
