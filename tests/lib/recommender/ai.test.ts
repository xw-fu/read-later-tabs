import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIRecommender } from '../../../src/lib/recommender/ai';
import { writeCache } from '../../../src/lib/recommender/cache';
import type { TabRecord } from '../../../src/lib/types';
import { storage } from '../../../src/lib/storage';

const DAY = 86400 * 1000;
const NOW = 100 * DAY;

function makeTab(o: Partial<TabRecord>): TabRecord {
  return {
    tabId: 1, windowId: 1, url: 'https://a.com', title: 'A',
    favIconUrl: null, domain: 'a.com',
    firstSeenAt: NOW - 5 * DAY, lastVisitedAt: NOW - 5 * DAY, visitCount: 0,
    estimatedReadingMinutes: 10, isTool: false, isPinned: false, isArchived: false,
    ...o,
  };
}

describe('AIRecommender', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
  });

  it('returns null when no candidates', async () => {
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    expect(await ai.withReason!([], {}, [])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to heuristic when API call fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 })];
    const result = await ai.withReason!(tabs, {}, []);
    expect(result?.tab.tabId).toBe(7);
    expect(result?.reason).toBeNull();
    expect(result?.headline).toBeNull();
  });

  it('parses anthropic response and attaches reason', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"tabId": 7, "headline": "饭后轻读", "reason": "接续昨天的 RSC"}' }],
      }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 }), makeTab({ tabId: 8 })];
    const result = await ai.withReason!(tabs, {}, []);
    expect(result?.tab.tabId).toBe(7);
    expect(result?.headline).toBe('饭后轻读');
    expect(result?.reason).toBe('接续昨天的 RSC');
  });

  it('parses openai response (chat completions choices[0].message.content)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"tabId": 8, "headline": "晨间收尾", "reason": "短小精悍"}' } }],
      }),
    });
    const ai = new AIRecommender({ mode: { kind: 'openai', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 }), makeTab({ tabId: 8 })];
    const result = await ai.withReason!(tabs, {}, []);
    expect(result?.tab.tabId).toBe(8);
    expect(result?.headline).toBe('晨间收尾');
    expect(result?.reason).toBe('短小精悍');
  });

  it('only sends title and domain to LLM (no full URL)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"x","reason":"x"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    await ai.withReason!([makeTab({ tabId: 7, url: 'https://secret.example/private/path?token=xyz', title: 'Hello', domain: 'secret.example' })], {}, []);
    const call = fetchMock.mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    const payload = JSON.stringify(body);
    expect(payload).not.toContain('private/path');
    expect(payload).not.toContain('token=xyz');
    expect(payload).toContain('Hello');
    expect(payload).toContain('secret.example');
  });

  it('custom + openai: hits ${baseUrl}/chat/completions with configured model and Bearer auth', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"tabId":7,"headline":"h","reason":"ok"}' } }] }),
    });
    const ai = new AIRecommender({
      mode: {
        kind: 'custom',
        protocol: 'openai',
        baseUrl: 'https://gw.example.com/v1',
        apiKey: 'sk-custom',
        model: 'my-model',
        extraHeaders: {},
      },
      now: NOW,
    });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://gw.example.com/v1/chat/completions');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('my-model');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-custom');
  });

  it('custom + anthropic: hits ${baseUrl}/messages with x-api-key and version header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"ok"}' }] }),
    });
    const ai = new AIRecommender({
      mode: {
        kind: 'custom',
        protocol: 'anthropic',
        baseUrl: 'https://gw.example.com/v1',
        apiKey: 'sk-anthropic',
        model: 'my-claude',
        extraHeaders: {},
      },
      now: NOW,
    });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://gw.example.com/v1/messages');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('my-claude');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-anthropic');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('custom: extraHeaders are merged into the fetch request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"tabId":7,"headline":"h","reason":"ok"}' } }] }),
    });
    const ai = new AIRecommender({
      mode: {
        kind: 'custom',
        protocol: 'openai',
        baseUrl: 'https://gw.example.com/v1',
        apiKey: 'sk-custom',
        model: 'm',
        extraHeaders: { 'X-Project-ID': 'read-later', 'X-Trace': 'abc' },
      },
      now: NOW,
    });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Project-ID']).toBe('read-later');
    expect(headers['X-Trace']).toBe('abc');
    expect(headers.authorization).toBe('Bearer sk-custom');     // default still present
  });

  it('custom: extraHeaders override default auth header when key matches', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"tabId":7,"headline":"h","reason":"ok"}' } }] }),
    });
    const ai = new AIRecommender({
      mode: {
        kind: 'custom',
        protocol: 'openai',
        baseUrl: 'https://gw.example.com/v1',
        apiKey: 'sk-ignored',
        model: 'm',
        extraHeaders: { authorization: 'Custom my-token' },
      },
      now: NOW,
    });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Custom my-token');
  });

  it('returns the cached result without calling fetch on second call', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"ok"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 })];
    await ai.withReason!(tabs, {}, []);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await ai.withReason!(tabs, {}, []);
    expect(fetchMock).toHaveBeenCalledTimes(1);   // still 1 — cache hit
  });

  it('bypassCache forces a fresh fetch even when cache would hit', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"ok"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 })];
    await ai.withReason!(tabs, {}, []);
    await ai.withReason!(tabs, {}, [], { bypassCache: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not write the cache when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 })];
    await ai.withReason!(tabs, {}, []);

    // second call should hit fetch again — no cached entry
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"ok"}' }] }),
    });
    await ai.withReason!(tabs, {}, []);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cache miss when dayKey changes (simulated by manual write)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"ok"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 })];
    // Pre-fill cache with stale dayKey but matching key
    await writeCache({
      key: 'anthropic|7||',
      dayKey: 'stale-day',
      result: { tab: makeTab({ tabId: 99 }), reason: 'stale', headline: 'stale' },
    });
    const result = await ai.withReason!(tabs, {}, []);
    expect(fetchMock).toHaveBeenCalled();          // miss → real call
    expect(result?.tab.tabId).toBe(7);             // not the stale 99
  });

  it('prompt includes the tech-term-no-translation constraint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"r"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain('Keep technical terms in English');
    expect(prompt).toContain('Agent');
    expect(prompt).toContain('React');
    expect(prompt).toContain('LLM');
  });

  it('prompt asks for the 3-field JSON schema', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"r"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain('"tabId"');
    expect(prompt).toContain('"headline"');
    expect(prompt).toContain('"reason"');
  });

  it('prompt limits candidates to top 10', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":1,"headline":"h","reason":"r"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    // 12 candidates — only top 10 (heuristic-ranked) should reach the prompt
    const tabs = Array.from({ length: 12 }, (_, i) => makeTab({ tabId: 100 + i, title: `T${i}` }));
    await ai.withReason!(tabs, {}, []);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.messages[0].content as string;
    // Tabs 100..109 are sent (first 10 by score with identical inputs);
    // simply assert at least 10 tabIds present and no "T10"/"T11" titles.
    const candidateBlock = prompt.split('Candidates')[1] ?? '';
    // exactly 10 tabIds in the candidate block
    expect((candidateBlock.match(/"tabId":/g) ?? []).length).toBe(10);
  });

  it('prompt includes recent verdict events from storage (title + domain + verdict)', async () => {
    await storage.pushVerdictEvent({ ts: 1, verdict: 'read', title: 'React 19 RSC', domain: 'react.dev' });
    await storage.pushVerdictEvent({ ts: 2, verdict: 'bookmark', title: 'TypeScript 5.6', domain: 'typescriptlang.org' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"r"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain('React 19 RSC');
    expect(prompt).toContain('typescriptlang.org');
    expect(prompt).toContain('bookmark');
  });

  it('parser truncates oversize headline (>30) and reason (>80)', async () => {
    const longHead = 'x'.repeat(50);
    const longReason = 'y'.repeat(120);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ tabId: 7, headline: longHead, reason: longReason }) }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const result = await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    expect(result?.headline?.length).toBe(30);
    expect(result?.reason?.length).toBe(80);
  });

  it('parser tolerates missing headline (returns null for it)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"reason":"only-reason"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const result = await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    expect(result?.headline).toBeNull();
    expect(result?.reason).toBe('only-reason');
  });

  it('parser tolerates missing reason (returns null for it)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"only-head"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const result = await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    expect(result?.headline).toBe('only-head');
    expect(result?.reason).toBeNull();
  });

  it('cache invalidates when a new VerdictEvent arrives between calls', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"r"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    const tabs = [makeTab({ tabId: 7 })];
    await ai.withReason!(tabs, {}, []);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // new verdict happens — sig changes → cache miss
    await storage.pushVerdictEvent({ ts: Date.now(), verdict: 'read', title: 'X', domain: 'x.com' });
    await ai.withReason!(tabs, {}, []);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses max_tokens 200 (room for headline+reason)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"tabId":7,"headline":"h","reason":"r"}' }] }),
    });
    const ai = new AIRecommender({ mode: { kind: 'anthropic', apiKey: 'k' }, now: NOW });
    await ai.withReason!([makeTab({ tabId: 7 })], {}, []);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.max_tokens).toBe(200);
  });
});
