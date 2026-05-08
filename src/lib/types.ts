export interface TabRecord {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl: string | null;
  domain: string;

  firstSeenAt: number;        // ms epoch
  lastVisitedAt: number;      // ms epoch
  visitCount: number;

  estimatedReadingMinutes: number;

  isTool: boolean;
  isPinned: boolean;
  isArchived: boolean;
}

export interface DomainProfile {
  domain: string;
  totalVisitCount: number;
  totalActiveSeconds: number;
  isToolByHeuristic: boolean;
  userOverride: 'tool' | 'content' | null;
}

export interface VerdictLog {
  date: string;          // YYYY-MM-DD
  readCount: number;
  bookmarkCount: number;
  trashCount: number;
  archivedCount: number;
}

export interface VerdictEvent {
  ts: number;            // ms epoch — when applyVerdict ran
  verdict: Verdict;      // 'read' | 'bookmark' | 'trash' | 'archive'
  title: string;         // tab.title snapshot
  domain: string;        // tab.domain snapshot
}

export type Verdict = 'read' | 'bookmark' | 'trash' | 'archive';

export interface Settings {
  aiKey: string | null;                                      // encrypted ciphertext (base64)
  aiProvider: 'none' | 'openai' | 'anthropic' | 'custom';
  aiCustom: AICustomConfig | null;
  excludedDomains: string[];
  thresholds: {
    agedDays: number;            // default 14
    toolMinDailySeconds: number; // default 300
  };
  dailyTarget: number;        // TopBar 的 Y; default 5
}

export interface AICustomConfig {
  protocol: 'openai' | 'anthropic'; // wire format the gateway speaks
  baseUrl: string;                  // up to and including /v1, no trailing slash
  model: string;                    // model name to send to the gateway
  extraHeaders: string;             // encrypted ciphertext (base64) of "Header: value\n…"
}

export interface RecommendationResult {
  tab: TabRecord;
  reason: string | null;     // optional human reason (AI mode only)
  headline: string | null;   // NEW — short scene tag, null = UI uses fallback eyebrow
}
