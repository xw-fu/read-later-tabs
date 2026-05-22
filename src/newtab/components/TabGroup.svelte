<script lang="ts">
  import type { TabRecord, Verdict } from '../../lib/types';
  import { ageDays } from '../../lib/aging';
  import TabCard from './TabCard.svelte';

  interface Props {
    title: string;
    tabs: TabRecord[];
    onClickTab: (id: number) => void;
    onVerdict: (tab: TabRecord, v: Verdict) => void;
    onArchive: (tab: TabRecord) => void;
    onReopen?: (tab: TabRecord) => void;
    onDiscard?: (tab: TabRecord) => void;
    bulkActionLabel?: string;
    onBulkAction?: () => void;
    bulkActionThreshold?: number;
  }
  let {
    title, tabs, onClickTab, onVerdict, onArchive,
    onReopen, onDiscard,
    bulkActionLabel, onBulkAction, bulkActionThreshold = 30,
  }: Props = $props();

  const sorted = $derived([...tabs].sort((a, b) => ageDays(b.firstSeenAt) - ageDays(a.firstSeenAt)));
  const showBulkAction = $derived(
    !!bulkActionLabel && !!onBulkAction && tabs.length >= bulkActionThreshold,
  );
</script>

<section class="mt-8">
  <div class="flex justify-between items-baseline border-t border-paper-edge pt-6 mb-5">
    <h3 class="font-serif text-base font-semibold tracking-wide">{title}</h3>
    <span class="font-serif italic text-xs text-paper-dim flex items-center gap-3">
      {#if showBulkAction}
        <button class="text-paper-gold underline text-xs not-italic" onclick={onBulkAction}>
          {bulkActionLabel}
        </button>
      {/if}
      共 {tabs.length} 张
    </span>
  </div>

  <div class="tab-grid">
    {#each sorted as tab (tab.tabId)}
      <TabCard
        {tab}
        onClick={() => onClickTab(tab.tabId)}
        onVerdict={(v) => onVerdict(tab, v)}
        onArchive={() => onArchive(tab)}
        onReopen={onReopen ? () => onReopen(tab) : undefined}
        onDiscard={onDiscard ? () => onDiscard(tab) : undefined}
      />
    {/each}
  </div>
</section>
