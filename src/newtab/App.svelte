<script lang="ts">
  import { onMount } from 'svelte';
  import { createNewTabStore } from './stores.svelte';
  import { ageDays } from '../lib/aging';
  import { switchToTab, applyVerdict } from './actions';
  import type { TabRecord, Verdict } from '../lib/types';
  import TopBar from './components/TopBar.svelte';
  import HeroCard from './components/HeroCard.svelte';
  import TabGrid from './components/TabGrid.svelte';
  import ToolsSection from './components/ToolsSection.svelte';
  import ArchiveSection from './components/ArchiveSection.svelte';
  import SearchOverlay from './components/SearchOverlay.svelte';
  import ShortcutHelp from './components/ShortcutHelp.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import BulkTriageModal from './components/BulkTriageModal.svelte';

  const store = createNewTabStore();
  const { state: storeState } = store;

  onMount(() => {
    store.refresh();
    const listener = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local') store.refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  });

  const oldestDays = $derived.by(() => {
    if (store.visible.length === 0) return null;
    const oldestSeen = Math.min(...store.visible.map(t => t.firstSeenAt));
    return ageDays(oldestSeen);
  });

  async function handleStartReading() {
    if (!storeState.recommendation) return;
    try { await switchToTab(storeState.recommendation.tab.tabId); }
    catch { await store.refreshRecommendation(); }
  }
  async function handleChangeOne() {
    store.noteChanged();
    await store.refreshRecommendation({ bypassCache: true });
  }
  async function handleLater() {
    store.rejectCurrentRecommendation();
    await store.refreshRecommendation({ bypassCache: true });
  }
  async function handleClickTab(id: number) {
    try { await switchToTab(id); } catch { await store.refresh(); }
  }
  async function handleVerdict(tab: TabRecord, v: Verdict) {
    await applyVerdict(tab, v);
    await store.refresh();
  }
  async function handleArchive(tab: TabRecord) {
    await applyVerdict(tab, 'archive');
    await store.refresh();
  }

  let searchOpen = $state(false);
  let helpOpen = $state(false);
  let bulkOpen = $state(false);
  const bulkPromptThreshold = 30;
  const showArchivePrompt = $derived(store.archived.length >= bulkPromptThreshold);

  function onGlobalKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); searchOpen = true; }
    else if (meta && e.key === 'Enter') { e.preventDefault(); handleStartReading(); }
    else if (meta && e.key.toLowerCase() === 'r') { e.preventDefault(); handleChangeOne(); }
    else if (e.key === '?' && !meta) { e.preventDefault(); helpOpen = true; }
  }
</script>

<main class="min-h-screen px-12 py-12 max-w-5xl mx-auto">
  {#if storeState.loading}
    <p class="text-paper-muted italic">Loading…</p>
  {:else}
    <TopBar
      pendingCount={store.visible.length}
      todayDoneCount={store.todayReadCount}
      todayTarget={storeState.settings?.dailyTarget ?? 5}
      oldestDays={oldestDays}
    />

    {#if store.visible.length === 0 && store.tools.length === 0}
      <EmptyState />
    {:else}
      {#if storeState.recommendation}
        <HeroCard
          tab={storeState.recommendation.tab}
          reason={storeState.recommendation.reason}
          headline={storeState.recommendation.headline}
          onStartReading={handleStartReading}
          onChangeOne={handleChangeOne}
          onLater={handleLater}
        />
      {/if}

      {#if store.visible.length > 0}
        <TabGrid
          tabs={store.visible}
          onClickTab={handleClickTab}
          onVerdict={handleVerdict}
          onArchive={handleArchive}
        />
      {/if}

      {#if showArchivePrompt && !bulkOpen}
        <div class="mt-8 p-4 bg-paper-aged border-l-4 border-paper-gold font-serif">
          <p class="italic text-sm text-paper-muted">
            你的库存有 {store.archived.length} 张纸笺。
            <button class="text-paper-gold underline ml-2" onclick={() => (bulkOpen = true)}>花 5 分钟过一遍</button>
          </p>
        </div>
      {/if}

      {#if store.tools.length > 0}
        <ToolsSection tabs={store.tools} onClickTab={handleClickTab} />
      {/if}
      {#if store.archived.length > 0}
        <ArchiveSection tabs={store.archived} onChanged={() => store.refresh()} />
      {/if}
    {/if}
  {/if}
</main>

<svelte:window onkeydown={onGlobalKey} />

{#if searchOpen}
  <SearchOverlay
    tabs={store.visible}
    onPick={(id) => { searchOpen = false; handleClickTab(id); }}
    onClose={() => (searchOpen = false)}
  />
{/if}

{#if helpOpen}
  <ShortcutHelp onClose={() => (helpOpen = false)} />
{/if}

{#if bulkOpen}
  <BulkTriageModal
    queue={store.archived}
    onVerdict={async (tab, v) => { await applyVerdict(tab, v); await store.refresh(); }}
    onClose={() => (bulkOpen = false)}
  />
{/if}
