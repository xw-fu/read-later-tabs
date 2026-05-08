<script lang="ts">
  import type { TabRecord, Verdict } from '../../lib/types';
  import { ageDays, agingClass, agingDecoration } from '../../lib/aging';
  import VerdictPicker from './VerdictPicker.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import { setDomainOverride } from '../actions';

  interface Props {
    tab: TabRecord;
    onClick: () => void;
    onVerdict: (v: Verdict) => void;
    onArchive: () => void;
  }
  let { tab, onClick, onVerdict, onArchive }: Props = $props();

  let pickerOpen = $state(false);
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressed = $state(false);

  let menu = $state<{ x: number; y: number } | null>(null);

  function openContext(e: MouseEvent) {
    e.preventDefault();
    menu = { x: e.clientX, y: e.clientY };
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  const menuItems = $derived([
    { icon: '✓', label: '已读', onPick: () => onVerdict('read') },
    { icon: '★', label: '书签', onPick: () => onVerdict('bookmark') },
    { icon: '✕', label: '丢', danger: true, onPick: () => onVerdict('trash') },
    { icon: '📦', label: '归档', onPick: () => onArchive() },
    { separator: true },
    { icon: '📋', label: '复制链接', onPick: () => navigator.clipboard.writeText(tab.url) },
    { separator: true },
    { icon: '🛠', label: '永远当作工具', onPick: () => setDomainOverride(tab.domain, 'tool') },
    { icon: '📰', label: '这不是工具', onPick: () => setDomainOverride(tab.domain, 'content') },
  ]);

  let faviconAttempt = $state(0);
  const faviconSources = $derived([
    tab.favIconUrl,
    tab.domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tab.domain)}&sz=64` : null,
  ].filter((s): s is string => !!s && /^https?:\/\//.test(s)));
  const faviconSrc = $derived(faviconSources[faviconAttempt] ?? null);
  const initial = $derived((tab.domain?.[0] ?? '?').toUpperCase());
  const hue = $derived(hashHue(tab.domain ?? ''));

  function hashHue(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }

  const days = $derived(ageDays(tab.firstSeenAt));
  const klass = $derived(agingClass(days));
  const decor = $derived(agingDecoration(days));

  function startPress() {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      onArchive();
    }, 500);
  }

  function onMouseDownPress(e: MouseEvent) {
    // Right/middle-click must NOT start the long-press archive timer —
    // right-click is reserved for the context menu, otherwise the card gets
    // archived 500ms after the user opens the menu.
    if (e.button !== 0) return;
    startPress();
  }

  function cancelPress() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }

  function handleClick() {
    if (longPressed) { longPressed = false; return; }
    onClick();
  }
</script>

<div
  class={`paper-card relative cursor-pointer ${klass}`}
  onmousedown={onMouseDownPress}
  onmouseup={cancelPress}
  onmouseleave={cancelPress}
  ontouchstart={startPress}
  ontouchend={cancelPress}
  onclick={handleClick}
  oncontextmenu={openContext}
  onkeydown={onKey}
  role="button"
  tabindex="0"
>
  <div class="flex justify-between items-start mb-2">
    {#if faviconSrc}
      <img
        src={faviconSrc}
        alt=""
        class="w-4 h-4 rounded-sm"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror={() => { faviconAttempt += 1; }}
      />
    {:else}
      <div
        class="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-medium text-paper-bg"
        style={`background: hsl(${hue} 28% 50%)`}
        aria-hidden="true"
      >{initial}</div>
    {/if}
    {#if decor}<span class="text-xs">{decor}</span>{/if}
  </div>
  <div class="text-sm font-medium leading-snug mb-1.5 line-clamp-2 min-h-[2.6em]">{tab.title || tab.domain}</div>
  <div class="font-serif italic text-[10px] text-paper-muted">{tab.domain} · 已开 {days} 天</div>

  <button
    class="absolute top-2 right-2 text-paper-dim opacity-0 hover:opacity-100 focus:opacity-100 text-xs px-2"
    onclick={(e) => { e.stopPropagation(); pickerOpen = true; }}
    aria-label="处理这个 tab"
  >×</button>

  {#if pickerOpen}
    <VerdictPicker onPick={(v) => { pickerOpen = false; onVerdict(v); }} onCancel={() => pickerOpen = false} />
  {/if}

  {#if menu}
    <ContextMenu
      items={menuItems}
      x={menu.x}
      y={menu.y}
      onClose={() => (menu = null)}
    />
  {/if}
</div>
