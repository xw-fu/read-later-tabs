import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HeroCard from '../../../src/newtab/components/HeroCard.svelte';
import type { TabRecord } from '../../../src/lib/types';

function tab(o: Partial<TabRecord> = {}): TabRecord {
  return {
    tabId: 1, windowId: 1, url: 'https://a.com', title: 'Some Article',
    favIconUrl: null, domain: 'a.com',
    firstSeenAt: Date.now() - 5 * 86_400_000, lastVisitedAt: Date.now(), visitCount: 0,
    estimatedReadingMinutes: 8, isTool: false, isPinned: false, isArchived: false,
    ...o,
  };
}

describe('HeroCard', () => {
  it('renders the AI headline as the eyebrow when provided', () => {
    render(HeroCard, {
      tab: tab(), reason: null, headline: '饭后轻读',
      onStartReading: vi.fn(), onChangeOne: vi.fn(), onLater: vi.fn(),
    });
    expect(screen.getByText('饭后轻读')).toBeTruthy();
  });

  it('falls back to "现在花 X 分钟" eyebrow when headline is null', () => {
    render(HeroCard, {
      tab: tab({ estimatedReadingMinutes: 12 }), reason: null, headline: null,
      onStartReading: vi.fn(), onChangeOne: vi.fn(), onLater: vi.fn(),
    });
    expect(screen.getByText('现在花 12 分钟')).toBeTruthy();
  });

  it('renders the reason line under the title when reason is non-null', () => {
    render(HeroCard, {
      tab: tab({ title: 'My Article' }), reason: '与你昨天读的 React RSC 文章相关',
      headline: '继续读', onStartReading: vi.fn(), onChangeOne: vi.fn(), onLater: vi.fn(),
    });
    expect(screen.getByText('与你昨天读的 React RSC 文章相关')).toBeTruthy();
  });

  it('omits the reason line entirely when reason is null', () => {
    render(HeroCard, {
      tab: tab(), reason: null, headline: '饭后轻读',
      onStartReading: vi.fn(), onChangeOne: vi.fn(), onLater: vi.fn(),
    });
    // Whatever class we choose for the reason <p>, the meta line and title remain;
    // we assert the document does not contain a paragraph with the kind of text
    // a reason would have. Easiest signal: the only italic paragraph rendered
    // is the meta line "domain · X 分钟阅读 · 已开 N 天".
    const paragraphs = Array.from(document.querySelectorAll('p'));
    const texts = paragraphs.map(p => p.textContent ?? '');
    expect(texts.filter(t => t.includes('分钟阅读')).length).toBe(1);
    expect(texts.length).toBe(1); // only the meta paragraph
  });
});
