import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TabCard from '../../../src/newtab/components/TabCard.svelte';
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

describe('TabCard variants', () => {
  it('renders a "tool" badge when the tab is a tool', () => {
    render(TabCard, {
      tab: tab({ isTool: true }),
      onClick: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
    });
    expect(screen.getByText('tool')).toBeTruthy();
  });

  it('does not render a "tool" badge for a non-tool reading tab', () => {
    render(TabCard, {
      tab: tab({ isTool: false }),
      onClick: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
    });
    expect(screen.queryByText('tool')).toBeNull();
  });
});
