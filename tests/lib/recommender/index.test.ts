import { describe, it, expect, vi } from 'vitest';
import { selectRecommender } from '../../../src/lib/recommender';
import { HeuristicRecommender } from '../../../src/lib/recommender/heuristic';
import { AIRecommender } from '../../../src/lib/recommender/ai';
import * as crypto from '../../../src/lib/crypto';
import type { Settings } from '../../../src/lib/types';

const baseSettings: Settings = {
  aiKey: null, aiProvider: 'none', aiCustom: null, excludedDomains: [],
  thresholds: { agedDays: 14, toolMinDailySeconds: 300 },
  dailyTarget: 5,
};

describe('selectRecommender', () => {
  it('returns heuristic when aiProvider is none', async () => {
    const r = await selectRecommender(baseSettings, 'plaintext-key', 'install-key');
    expect(r).toBeInstanceOf(HeuristicRecommender);
  });

  it('returns heuristic when aiKey-derived plaintext is null even if provider set', async () => {
    const r = await selectRecommender({ ...baseSettings, aiProvider: 'anthropic' }, null, 'install-key');
    expect(r).toBeInstanceOf(HeuristicRecommender);
  });

  it('returns AI when openai provider+key both present', async () => {
    const r = await selectRecommender({ ...baseSettings, aiProvider: 'openai', aiKey: 'enc' }, 'plain-key', 'install-key');
    expect(r).toBeInstanceOf(AIRecommender);
  });

  it('returns AI when anthropic provider+key both present', async () => {
    const r = await selectRecommender({ ...baseSettings, aiProvider: 'anthropic', aiKey: 'enc' }, 'plain-key', 'install-key');
    expect(r).toBeInstanceOf(AIRecommender);
  });

  it('returns AI for custom provider with full config and decryptable extraHeaders', async () => {
    const decryptSpy = vi.spyOn(crypto, 'decryptString').mockResolvedValue('X-Foo: bar');
    const r = await selectRecommender(
      {
        ...baseSettings,
        aiProvider: 'custom',
        aiKey: 'enc',
        aiCustom: {
          protocol: 'openai',
          baseUrl: 'https://gw.example/v1',
          model: 'm',
          extraHeaders: 'enc-headers',
        },
      },
      'plain-key',
      'install-key',
    );
    expect(r).toBeInstanceOf(AIRecommender);
    expect(decryptSpy).toHaveBeenCalledWith('enc-headers', 'install-key');
    decryptSpy.mockRestore();
  });

  it('returns heuristic for custom provider missing baseUrl', async () => {
    const r = await selectRecommender(
      {
        ...baseSettings,
        aiProvider: 'custom',
        aiKey: 'enc',
        aiCustom: { protocol: 'openai', baseUrl: '', model: 'm', extraHeaders: '' },
      },
      'plain-key',
      'install-key',
    );
    expect(r).toBeInstanceOf(HeuristicRecommender);
  });

  it('returns heuristic for custom provider missing model', async () => {
    const r = await selectRecommender(
      {
        ...baseSettings,
        aiProvider: 'custom',
        aiKey: 'enc',
        aiCustom: { protocol: 'openai', baseUrl: 'https://gw.example/v1', model: '', extraHeaders: '' },
      },
      'plain-key',
      'install-key',
    );
    expect(r).toBeInstanceOf(HeuristicRecommender);
  });

  it('returns heuristic for custom provider with null aiCustom', async () => {
    const r = await selectRecommender(
      { ...baseSettings, aiProvider: 'custom', aiKey: 'enc', aiCustom: null },
      'plain-key',
      'install-key',
    );
    expect(r).toBeInstanceOf(HeuristicRecommender);
  });

  it('returns heuristic for custom provider when extraHeaders decryption throws', async () => {
    const decryptSpy = vi.spyOn(crypto, 'decryptString').mockRejectedValue(new Error('boom'));
    const r = await selectRecommender(
      {
        ...baseSettings,
        aiProvider: 'custom',
        aiKey: 'enc',
        aiCustom: { protocol: 'openai', baseUrl: 'https://gw.example/v1', model: 'm', extraHeaders: 'enc-bad' },
      },
      'plain-key',
      'install-key',
    );
    expect(r).toBeInstanceOf(HeuristicRecommender);
    decryptSpy.mockRestore();
  });

  it('returns AI with empty extraHeaders for custom provider when ciphertext decrypts to empty string', async () => {
    const decryptSpy = vi.spyOn(crypto, 'decryptString').mockResolvedValue('');
    const r = await selectRecommender(
      {
        ...baseSettings,
        aiProvider: 'custom',
        aiKey: 'enc',
        aiCustom: { protocol: 'openai', baseUrl: 'https://gw.example/v1', model: 'm', extraHeaders: 'enc-empty' },
      },
      'plain-key',
      'install-key',
    );
    expect(r).toBeInstanceOf(AIRecommender);
    decryptSpy.mockRestore();
  });

  it('returns heuristic for custom provider when installKey is null', async () => {
    const r = await selectRecommender(
      {
        ...baseSettings,
        aiProvider: 'custom',
        aiKey: 'enc',
        aiCustom: { protocol: 'openai', baseUrl: 'https://gw.example/v1', model: 'm', extraHeaders: 'enc' },
      },
      'plain-key',
      null,
    );
    expect(r).toBeInstanceOf(HeuristicRecommender);
  });
});
