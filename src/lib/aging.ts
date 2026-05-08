const DAY_MS = 86_400_000;

export function ageDays(firstSeenAtMs: number, nowMs: number = Date.now()): number {
  const days = Math.floor((nowMs - firstSeenAtMs) / DAY_MS);
  return Math.max(0, days);
}

export function agingClass(ageInDays: number): string {
  if (ageInDays >= 14) return 'paper-aged-14';
  if (ageInDays >= 7) return 'paper-aged-7';
  if (ageInDays >= 3) return 'paper-aged-3';
  return 'paper-fresh';
}

export function agingDecoration(ageInDays: number): string {
  if (ageInDays >= 14) return '🥀';
  if (ageInDays >= 7) return '📎';
  return '';
}
