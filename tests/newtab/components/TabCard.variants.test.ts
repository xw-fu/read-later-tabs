import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
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

  it('does not apply any paper-aged class to the tool variant', () => {
    const { container } = render(TabCard, {
      // Old timestamp would normally trigger paper-aged-14.
      tab: tab({ isTool: true, firstSeenAt: Date.now() - 20 * 86_400_000 }),
      onClick: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
    });
    const card = container.querySelector('.paper-card') as HTMLElement;
    expect(card.className).not.toMatch(/paper-aged-/);
  });

  it('does not apply any paper-aged class to the archive variant', () => {
    const { container } = render(TabCard, {
      tab: tab({ isArchived: true, firstSeenAt: Date.now() - 20 * 86_400_000 }),
      onClick: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
    });
    const card = container.querySelector('.paper-card') as HTMLElement;
    expect(card.className).not.toMatch(/paper-aged-/);
  });

  it('still applies the paper-aged class to the default variant', () => {
    const { container } = render(TabCard, {
      tab: tab({ firstSeenAt: Date.now() - 20 * 86_400_000 }),
      onClick: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
    });
    const card = container.querySelector('.paper-card') as HTMLElement;
    expect(card.className).toMatch(/paper-aged-/);
  });

  it('archive variant context menu shows Reopen / Discard / 复制链接 and omits verdict items', async () => {
    const onReopen = vi.fn();
    const onDiscard = vi.fn();
    const { container } = render(TabCard, {
      tab: tab({ isArchived: true }),
      onClick: vi.fn(), onVerdict: vi.fn(), onArchive: vi.fn(),
      onReopen, onDiscard,
    });
    const card = container.querySelector('.paper-card') as HTMLElement;
    await fireEvent.contextMenu(card, { clientX: 50, clientY: 50 });

    // ContextMenu portals itself to document.body.
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).toBeTruthy();
    const labels = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(el => el.textContent?.trim() ?? '');
    expect(labels.some(l => l.includes('Reopen'))).toBe(true);
    expect(labels.some(l => l.includes('Discard'))).toBe(true);
    expect(labels.some(l => l.includes('复制链接'))).toBe(true);
    expect(labels.some(l => l.includes('已读'))).toBe(false);
    expect(labels.some(l => l.includes('书签'))).toBe(false);
    expect(labels.some(l => l.includes('归档'))).toBe(false);
  });
});
