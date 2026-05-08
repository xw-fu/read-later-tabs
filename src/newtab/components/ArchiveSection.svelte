<script lang="ts">
  import type { TabRecord } from '../../lib/types';
  import { storage } from '../../lib/storage';

  interface Props {
    tabs: TabRecord[];
    onChanged: () => void;
  }
  let { tabs, onChanged }: Props = $props();
  let open = $state(false);

  async function reopen(t: TabRecord) {
    await chrome.tabs.create({ url: t.url });
    const all = await storage.getTabs();
    await storage.setTabs(all.filter(x => x.tabId !== t.tabId || !x.isArchived));
    onChanged();
  }

  async function discard(t: TabRecord) {
    const all = await storage.getTabs();
    await storage.setTabs(all.filter(x => !(x.tabId === t.tabId && x.isArchived)));
    onChanged();
  }
</script>

<div class="mt-4">
  <button class="font-serif text-paper-muted text-sm" onclick={() => (open = !open)}>
    {open ? '▾' : '▸'} 库存 · {tabs.length}
  </button>
  {#if open}
    <ul class="mt-3 space-y-1">
      {#each tabs as t (t.tabId)}
        <li class="flex items-center justify-between p-2 hover:bg-paper-card rounded text-sm">
          <span class="truncate">{t.title || t.domain} <span class="text-xs text-paper-muted ml-2">{t.domain}</span></span>
          <span class="flex gap-2">
            <button class="text-xs text-paper-gold hover:underline" onclick={() => reopen(t)}>重开</button>
            <button class="text-xs text-red-700 hover:underline" onclick={() => discard(t)}>丢</button>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
