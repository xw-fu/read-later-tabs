import type { Settings } from '../types';
import { HeuristicRecommender } from './heuristic';
import { AIRecommender } from './ai';
import type { Recommender } from './types';
import { decryptString } from '../crypto';
import { parseHeaders } from './headers';

export interface RecommenderOptions {
  now?: number;
  lastDomain?: string | null;
}

export async function selectRecommender(
  settings: Settings,
  plaintextKey: string | null,
  installKey: string | null,
  opts: RecommenderOptions = {},
): Promise<Recommender> {
  const merged = { ...opts, excludedDomains: settings.excludedDomains };

  if (settings.aiProvider === 'openai' || settings.aiProvider === 'anthropic') {
    if (!plaintextKey) return new HeuristicRecommender(merged);
    return new AIRecommender({
      mode: { kind: settings.aiProvider, apiKey: plaintextKey },
      ...merged,
    });
  }

  if (settings.aiProvider === 'custom') {
    if (!plaintextKey || !installKey || !settings.aiCustom) return new HeuristicRecommender(merged);
    const { protocol, baseUrl, model, extraHeaders } = settings.aiCustom;
    if (!baseUrl || !model) return new HeuristicRecommender(merged);
    let headers: Record<string, string> = {};
    try {
      const plain = await decryptString(extraHeaders, installKey);
      headers = parseHeaders(plain);
    } catch {
      return new HeuristicRecommender(merged);
    }
    return new AIRecommender({
      mode: { kind: 'custom', protocol, baseUrl, apiKey: plaintextKey, model, extraHeaders: headers },
      ...merged,
    });
  }

  return new HeuristicRecommender(merged);
}

export { HeuristicRecommender } from './heuristic';
export { AIRecommender } from './ai';
export type { Recommender } from './types';
