<script lang="ts">
  import type { TabRecord, Verdict } from '../../lib/types';
  import { ageDays } from '../../lib/aging';
  import TabCard from './TabCard.svelte';

  interface Props {
    tabs: TabRecord[];
    onClickTab: (id: number) => void;
    onVerdict: (tab: TabRecord, v: Verdict) => void;
    onArchive: (tab: TabRecord) => void;
  }
  let { tabs, onClickTab, onVerdict, onArchive }: Props = $props();

  const sorted = $derived([...tabs].sort((a, b) => ageDays(b.firstSeenAt) - ageDays(a.firstSeenAt)));
</script>

<section>
  <div class="flex justify-between items-baseline border-t border-paper-edge pt-6 mb-5">
    <h3 class="font-serif text-base font-semibold tracking-wide">你的纸笺</h3>
    <span class="font-serif italic text-xs text-paper-dim">共 {tabs.length} 张</span>
  </div>

  <div class="grid grid-cols-4 gap-3.5">
    {#each sorted as tab (tab.tabId)}
      <TabCard
        {tab}
        onClick={() => onClickTab(tab.tabId)}
        onVerdict={(v) => onVerdict(tab, v)}
        onArchive={() => onArchive(tab)}
      />
    {/each}
  </div>
</section>
