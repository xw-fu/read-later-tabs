import { describe, it, expect } from 'vitest';
import { extractDomain, isTrackableUrl } from '../../src/lib/domain';

describe('extractDomain', () => {
  it('returns hostname without www', () => {
    expect(extractDomain('https://www.example.com/foo')).toBe('example.com');
    expect(extractDomain('https://example.com')).toBe('example.com');
    expect(extractDomain('https://sub.example.com/')).toBe('sub.example.com');
  });

  it('handles protocols other than https', () => {
    expect(extractDomain('http://example.com')).toBe('example.com');
    expect(extractDomain('chrome://settings')).toBe('settings');
  });

  it('returns empty string for invalid url', () => {
    expect(extractDomain('not-a-url')).toBe('');
    expect(extractDomain('')).toBe('');
  });
});

describe('isTrackableUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isTrackableUrl('https://example.com/x')).toBe(true);
    expect(isTrackableUrl('http://example.com')).toBe(true);
  });

  it('rejects the extension new tab page (chrome-extension://)', () => {
    expect(isTrackableUrl('chrome-extension://abcdefghij/newtab.html')).toBe(false);
  });

  it('rejects browser-internal URLs', () => {
    expect(isTrackableUrl('chrome://newtab/')).toBe(false);
    expect(isTrackableUrl('chrome://settings')).toBe(false);
    expect(isTrackableUrl('about:blank')).toBe(false);
    expect(isTrackableUrl('edge://settings')).toBe(false);
    expect(isTrackableUrl('view-source:https://example.com')).toBe(false);
    expect(isTrackableUrl('devtools://devtools/bundled/inspector.html')).toBe(false);
  });

  it('rejects empty / unparseable URLs', () => {
    expect(isTrackableUrl('')).toBe(false);
    expect(isTrackableUrl('not-a-url')).toBe(false);
  });
});
