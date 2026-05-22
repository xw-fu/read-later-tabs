import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TabGroup from '../../../src/newtab/components/TabGroup.svelte';
import type { TabRecord } from '../../../src/lib/types';

function tab(o: Partial<TabRecord> = {}): TabRecord {
  return {
    tabId: 1, windowId: 1, url: 'https://a.com', title: 'Article',
    favIconUrl: null, domain: 'a.com',
    firstSeenAt: Date.now() - 86_400_000, lastVisitedAt: Date.now(), visitCount: 0,
    estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
    ...o,
  };
}

describe('TabGroup', () => {
  it('renders the title and count', () => {
    render(TabGroup, {
      title: 'Open', tabs: [tab({ tabId: 1 }), tab({ tabId: 2 })],
      onClickTab: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
    });
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('共 2 张')).toBeTruthy();
  });
});
