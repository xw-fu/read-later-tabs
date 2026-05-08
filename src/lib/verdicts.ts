import type { VerdictLog } from './types';

export function pickTodayReadCount(logs: VerdictLog[], today: string): number {
  return logs.find(l => l.date === today)?.readCount ?? 0;
}
