import type { TabRecord, DomainProfile, VerdictLog, VerdictEvent, RecommendationResult } from '../types';
import type { Recommender } from './types';
import { HeuristicRecommender } from './heuristic';
import { computeCacheKey, readCache, writeCache, verdictSignature } from './cache';
import { todayKey } from '../dates';
import { storage } from '../storage';

export type Mode =
  | { kind: 'openai'; apiKey: string }
  | { kind: 'anthropic'; apiKey: string }
  | {
      kind: 'custom';
      protocol: 'openai' | 'anthropic';
      baseUrl: string;
      apiKey: string;
      model: string;
      extraHeaders: Record<string, string>;
    };

interface Options {
  mode: Mode;
  now?: number;
  lastDomain?: string | null;
  excludedDomains?: string[];
}

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_MODEL = 'gpt-4o-mini';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const HEADLINE_MAX = 30;
const REASON_MAX = 80;
const CANDIDATES_MAX = 10;
const RECENT_EVENTS_MAX = 15;

export class AIRecommender implements Recommender {
  private readonly fallback: HeuristicRecommender;
  private readonly opts: Options;

  constructor(opts: Options) {
    this.opts = opts;
    this.fallback = new HeuristicRecommender({
      now: opts.now,
      lastDomain: opts.lastDomain,
      excludedDomains: opts.excludedDomains,
    });
  }

  pick(tabs: TabRecord[], profiles: Record<string, DomainProfile>, history: VerdictLog[]): TabRecord | null {
    return this.fallback.pick(tabs, profiles, history);
  }

  async withReason(
    tabs: TabRecord[],
    profiles: Record<string, DomainProfile>,
    history: VerdictLog[],
    opts: { bypassCache?: boolean } = {},
  ): Promise<RecommendationResult | null> {
    const candidates = this.fallback.ranked(tabs, profiles, history);
    if (candidates.length === 0) return null;

    const events = await storage.getVerdictEvents();
    const sig = verdictSignature(events);

    const cacheKey = computeCacheKey(this.opts.mode, candidates, this.opts.lastDomain ?? null, sig);
    const today = todayKey();

    if (!opts.bypassCache) {
      const cached = await readCache();
      if (cached && cached.key === cacheKey && cached.dayKey === today) {
        return cached.result;
      }
    }

    const prompt = this.buildPrompt(candidates, events);

    try {
      const text = await this.callLLM(prompt);
      const parsed = this.parseResponse(text);
      const chosen = candidates.find(t => t.tabId === parsed.tabId) ?? candidates[0];
      const result: RecommendationResult = {
        tab: chosen,
        reason: parsed.reason,
        headline: parsed.headline,
      };
      await writeCache({ key: cacheKey, dayKey: today, result });
      return result;
    } catch {
      return { tab: candidates[0], reason: null, headline: null };
    }
  }

  private buildPrompt(candidates: TabRecord[], events: VerdictEvent[]): string {
    const top = candidates.slice(0, CANDIDATES_MAX).map(t => ({
      tabId: t.tabId,
      title: t.title,
      domain: t.domain,
      readingMin: t.estimatedReadingMinutes,
      ageDays: Math.floor((Date.now() - t.firstSeenAt) / 86_400_000),
    }));
    const recent = events.slice(-RECENT_EVENTS_MAX).map(e => ({
      verdict: e.verdict,
      title: e.title,
      domain: e.domain,
    }));
    return [
      'You are an aware, gentle reading curator. The user has many open tabs to triage.',
      'Pick ONE tab the user should read right now and explain in two parts.',
      '',
      'Output STRICT JSON only, no prose, no markdown:',
      '{',
      '  "tabId": <number from candidates>,',
      '  "headline": "<3-10 字符的场景钉选，中文，例：饭后轻读 / 晨间收尾 / 10 分钟搞清楚>",',
      '  "reason":   "<≤40 字符的具体原因，中文，引用 recent 中的 title/domain 增加说服力>"',
      '}',
      '',
      'IMPORTANT: Keep technical terms in English. Do NOT translate Agent / React / LLM / API / SDK / Vue / TypeScript / etc.',
      'Prefer shorter reads, older items, and topics related to recent reads.',
      '',
      `Recent verdicts (newest last): ${JSON.stringify(recent)}`,
      `Candidates (best first, pick 1): ${JSON.stringify(top)}`,
    ].join('\n');
  }

  private async callLLM(prompt: string): Promise<string> {
    const mode = this.opts.mode;
    const protocol = mode.kind === 'custom' ? mode.protocol : mode.kind;

    const url = mode.kind === 'custom'
      ? (protocol === 'openai' ? `${mode.baseUrl}/chat/completions` : `${mode.baseUrl}/messages`)
      : (protocol === 'openai' ? OPENAI_URL : ANTHROPIC_URL);

    const model = mode.kind === 'custom'
      ? mode.model
      : (protocol === 'openai' ? OPENAI_MODEL : ANTHROPIC_MODEL);

    const baseHeaders: Record<string, string> = protocol === 'anthropic'
      ? {
          'content-type': 'application/json',
          'x-api-key': mode.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }
      : {
          'content-type': 'application/json',
          authorization: `Bearer ${mode.apiKey}`,
        };

    const headers = mode.kind === 'custom'
      ? { ...baseHeaders, ...mode.extraHeaders }
      : baseHeaders;

    const body: Record<string, unknown> = {
      model,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    };
    if (protocol === 'openai' && mode.kind === 'openai') {
      body.response_format = { type: 'json_object' };
    }

    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${protocol} ${r.status}`);

    if (protocol === 'anthropic') {
      const data = await r.json() as { content: Array<{ type: string; text: string }> };
      return data.content[0]?.text ?? '';
    } else {
      const data = await r.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message.content ?? '';
    }
  }

  private parseResponse(raw: string): { tabId: number; headline: string | null; reason: string | null } {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    const parsed = JSON.parse(m[0]) as { tabId: unknown; headline?: unknown; reason?: unknown };
    return {
      tabId: Number(parsed.tabId),
      headline: typeof parsed.headline === 'string' ? parsed.headline.slice(0, HEADLINE_MAX) : null,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, REASON_MAX) : null,
    };
  }
}
