<script lang="ts">
  import type { TabRecord } from '../../lib/types';

  interface Props {
    tabs: TabRecord[];
    onPick: (id: number) => void;
    onClose: () => void;
  }
  let { tabs, onPick, onClose }: Props = $props();

  let query = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => { inputEl?.focus(); });

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabs.slice(0, 10);
    return tabs
      .filter(t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
      .slice(0, 30);
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<button
  type="button"
  class="fixed inset-0 bg-paper-bg/95 z-50 cursor-default"
  onclick={onClose}
  aria-label="关闭搜索"
></button>

<div class="fixed inset-0 z-50 flex flex-col items-center pt-24 px-4 pointer-events-none">
  <div class="bg-paper-card border border-paper-edge rounded shadow-lg w-full max-w-2xl pointer-events-auto">
    <input
      type="text"
      bind:value={query}
      bind:this={inputEl}
      placeholder="搜索 tab 标题或 URL…"
      class="w-full p-4 text-base bg-transparent border-b border-paper-edge focus:outline-none font-serif"
    />
    <ul class="max-h-96 overflow-auto">
      {#each results as t (t.tabId)}
        <li>
          <button class="w-full text-left p-3 hover:bg-paper-aged" onclick={() => onPick(t.tabId)}>
            <div class="font-medium">{t.title || t.domain}</div>
            <div class="text-xs text-paper-muted">{t.domain}</div>
          </button>
        </li>
      {/each}
      {#if results.length === 0}
        <li class="p-3 text-paper-muted italic">没有匹配的 tab</li>
      {/if}
    </ul>
  </div>
</div>
