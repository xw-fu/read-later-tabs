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

  it('hides the inline bulk action when count is below the threshold', () => {
    const onBulk = vi.fn();
    const tabs = Array.from({ length: 5 }, (_, i) => tab({ tabId: i + 1 }));
    render(TabGroup, {
      title: 'Archived', tabs,
      onClickTab: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
      bulkActionLabel: '批量处理', onBulkAction: onBulk, bulkActionThreshold: 30,
    });
    expect(screen.queryByText('批量处理')).toBeNull();
  });

  it('shows the inline bulk action when count is at or above the threshold', () => {
    const onBulk = vi.fn();
    const tabs = Array.from({ length: 30 }, (_, i) => tab({ tabId: i + 1 }));
    render(TabGroup, {
      title: 'Archived', tabs,
      onClickTab: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
      bulkActionLabel: '批量处理', onBulkAction: onBulk, bulkActionThreshold: 30,
    });
    expect(screen.getByText('批量处理')).toBeTruthy();
  });

  it('uses the .tab-grid class on the card container', () => {
    const { container } = render(TabGroup, {
      title: 'Open', tabs: [tab({ tabId: 1 })],
      onClickTab: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
    });
    expect(container.querySelector('.tab-grid')).toBeTruthy();
  });
});
