<script lang="ts">
  import type { TabRecord } from '../../lib/types';

  interface Props {
    tabs: TabRecord[];
    onClickTab: (id: number) => void;
  }
  let { tabs, onClickTab }: Props = $props();
  let open = $state(false);
</script>

<div class="mt-10 pt-6 border-t border-paper-edge">
  <button class="font-serif text-paper-muted text-sm" onclick={() => (open = !open)}>
    {open ? '▾' : '▸'} 工具 · {tabs.length}
  </button>
  {#if open}
    <ul class="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
      {#each tabs as t (t.tabId)}
        <li>
          <button class="text-left w-full p-2 hover:bg-paper-card rounded text-sm" onclick={() => onClickTab(t.tabId)}>
            {t.title || t.domain}
            <span class="block text-xs text-paper-muted">{t.domain}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
