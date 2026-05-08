export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// True only for URLs that represent reading material a user might want to
// triage later. Excludes the extension's own pages (chrome-extension://),
// browser-internal pages (chrome://, about:, edge://, devtools://, etc.),
// and unparseable strings.
export function isTrackableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:';
  } catch {
    return false;
  }
}
