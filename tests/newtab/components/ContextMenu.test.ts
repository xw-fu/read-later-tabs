import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ContextMenu from '../../../src/newtab/components/ContextMenu.svelte';

describe('ContextMenu', () => {
  it('renders all non-separator items as menuitems', () => {
    const items = [
      { label: '已读', onPick: vi.fn() },
      { separator: true },
      { label: '丢', danger: true, onPick: vi.fn() },
    ];
    render(ContextMenu, { items, x: 10, y: 10, onClose: vi.fn() });
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByText('已读')).toBeTruthy();
    expect(screen.getByText('丢')).toBeTruthy();
  });

  it('calls onPick then onClose when an item is clicked', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(ContextMenu, {
      items: [{ label: '已读', onPick }],
      x: 0, y: 0, onClose,
    });
    await fireEvent.click(screen.getByText('已读'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(ContextMenu, {
      items: [{ label: 'x', onPick: vi.fn() }],
      x: 0, y: 0, onClose,
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('positions itself at the given coords (when within viewport)', () => {
    render(ContextMenu, {
      items: [{ label: 'x', onPick: vi.fn() }],
      x: 200, y: 300, onClose: vi.fn(),
    });
    // After portal, the menu lives directly under <body>, not inside the
    // testing-library container. Query via document.
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).toBeTruthy();
    expect(menu.style.left).toBe('200px');
    expect(menu.style.top).toBe('300px');
  });

  it('portals itself to document.body to escape transformed ancestors', () => {
    render(ContextMenu, {
      items: [{ label: 'x', onPick: vi.fn() }],
      x: 0, y: 0, onClose: vi.fn(),
    });
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.parentElement).toBe(document.body);
  });

  it('calls onClose when clicking outside', async () => {
    const onClose = vi.fn();
    render(ContextMenu, {
      items: [{ label: 'x', onPick: vi.fn() }],
      x: 0, y: 0, onClose,
    });
    await fireEvent.click(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when right-clicking outside (so a new menu can open)', async () => {
    const onClose = vi.fn();
    render(ContextMenu, {
      items: [{ label: 'x', onPick: vi.fn() }],
      x: 0, y: 0, onClose,
    });
    await fireEvent.contextMenu(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});
