<script lang="ts">
  import type { Verdict } from '../../lib/types';

  interface Props {
    onPick: (v: Verdict) => void;
    onCancel: () => void;
  }
  let { onPick, onCancel }: Props = $props();
</script>

<div
  class="absolute inset-x-2 bottom-2 flex justify-around items-center bg-paper-card border border-paper-edge rounded shadow-md py-2 z-10"
  role="dialog"
  aria-modal="true"
  aria-label="选择处理方式"
  tabindex={-1}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <button class="text-xs text-emerald-700 hover:underline" onclick={() => onPick('read')}>✓ 已读</button>
  <button class="text-xs text-paper-gold hover:underline" onclick={() => onPick('bookmark')}>★ 书签</button>
  <button class="text-xs text-red-700 hover:underline" onclick={() => onPick('trash')}>✕ 丢</button>
  <button class="text-xs text-paper-dim ml-1" onclick={onCancel}>取消</button>
</div>
