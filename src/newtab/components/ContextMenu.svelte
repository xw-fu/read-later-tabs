<script lang="ts" module>
  export interface Item {
    label?: string;
    icon?: string;
    onPick?: () => void;
    danger?: boolean;
    separator?: boolean;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    items: Item[];
    x: number;
    y: number;
    onClose: () => void;
  }
  let { items, x, y, onClose }: Props = $props();

  let menuEl = $state<HTMLDivElement | null>(null);
  let focusIdx = $state(0);
  // Clamped position. Initially null so we render at the raw (x, y) and then
  // jump to the clamped coordinates once we've measured the menu in onMount.
  // Starting null avoids the `state_referenced_locally` warning that
  // `$state(x)` would trigger.
  let clampedX = $state<number | null>(null);
  let clampedY = $state<number | null>(null);

  // Indices of pickable (non-separator) items, used for keyboard navigation.
  const pickable = $derived(
    items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => !it.separator),
  );

  function pick(item: Item) {
    item.onPick?.();
    onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIdx = (focusIdx + 1) % pickable.length;
      (menuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]')[focusIdx])?.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIdx = (focusIdx - 1 + pickable.length) % pickable.length;
      (menuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]')[focusIdx])?.focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const { it } = pickable[focusIdx] ?? {};
      if (it) {
        e.preventDefault();
        pick(it);
      }
    }
  }

  function onOutside(e: MouseEvent) {
    if (!menuEl) return;
    if (menuEl.contains(e.target as Node)) return;
    onClose();
    // For left-clicks, swallow the event so the underlying element
    // (e.g. another TabCard) doesn't also fire its onclick — the user's
    // intent was to dismiss the menu.
    if (e.type === 'click') e.stopPropagation();
  }

  function clampToViewport() {
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(margin, vw - rect.width - margin);
    const maxY = Math.max(margin, vh - rect.height - margin);
    clampedX = Math.min(Math.max(x, margin), maxX);
    clampedY = Math.min(Math.max(y, margin), maxY);
  }

  onMount(() => {
    // Portal out of any transformed/positioned ancestor so the `position: fixed`
    // below is truly viewport-relative. Without this, `.paper-card:hover`'s
    // `transform: translateY(-1px)` becomes the containing block and the menu
    // jitters every time hover state flips on the underlying card.
    if (menuEl) document.body.appendChild(menuEl);
    clampToViewport();

    document.addEventListener('click', onOutside, true);
    document.addEventListener('contextmenu', onOutside, true);
    return () => {
      document.removeEventListener('click', onOutside, true);
      document.removeEventListener('contextmenu', onOutside, true);
      if (menuEl?.parentNode) menuEl.parentNode.removeChild(menuEl);
    };
  });
</script>

<svelte:window onkeydown={onKey} />

<div
  bind:this={menuEl}
  role="menu"
  aria-label="操作菜单"
  class="fixed bg-paper-card border border-paper-edge rounded shadow-md py-1 z-50 min-w-[12rem] font-sans text-sm"
  style="left: {clampedX ?? x}px; top: {clampedY ?? y}px;"
>
  {#each items as item, i (i)}
    {#if item.separator}
      <hr class="my-1 border-paper-edge" />
    {:else}
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        class="w-full text-left px-3 py-1.5 hover:bg-paper-aged flex items-center gap-2 {item.danger ? 'text-red-700' : ''}"
        onclick={() => pick(item)}
      >
        {#if item.icon}<span class="w-4 inline-block text-center">{item.icon}</span>{/if}
        <span>{item.label}</span>
      </button>
    {/if}
  {/each}
</div>
