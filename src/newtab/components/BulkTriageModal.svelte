<script lang="ts">
  import type { TabRecord, Verdict } from '../../lib/types';

  interface Props {
    queue: TabRecord[];
    onVerdict: (tab: TabRecord, v: Verdict) => Promise<void>;
    onClose: () => void;
  }
  let { queue, onVerdict, onClose }: Props = $props();

  let index = $state(0);
  const current = $derived(queue[index]);

  async function pick(v: Verdict) {
    if (!current) return;
    await onVerdict(current, v);
    index += 1;
    if (index >= queue.length) onClose();
  }
</script>

<div class="fixed inset-0 bg-paper-bg/95 z-50 flex items-center justify-center p-6" role="dialog">
  {#if current}
    <div class="bg-paper-card border border-paper-edge rounded shadow-lg max-w-md p-6">
      <p class="font-serif text-paper-gold text-xs tracking-[3px] mb-3 uppercase">{index + 1} / {queue.length}</p>
      <h3 class="font-serif text-2xl mb-2">{current.title || current.domain}</h3>
      <p class="font-serif italic text-sm text-paper-muted mb-6">{current.domain}</p>
      <div class="flex gap-2 justify-between">
        <button class="bg-emerald-700 text-white px-4 py-2 rounded text-sm" onclick={() => pick('read')}>✓ 已读</button>
        <button class="bg-paper-gold text-white px-4 py-2 rounded text-sm" onclick={() => pick('bookmark')}>★ 书签</button>
        <button class="bg-red-700 text-white px-4 py-2 rounded text-sm" onclick={() => pick('trash')}>✕ 丢</button>
        <button class="text-paper-dim text-sm" onclick={onClose}>稍后</button>
      </div>
    </div>
  {/if}
</div>
