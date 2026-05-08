<script lang="ts">
  import type { TabRecord } from '../../lib/types';
  import { ageDays } from '../../lib/aging';

  interface Props {
    tab: TabRecord;
    reason: string | null;
    headline: string | null;
    onStartReading: () => void;
    onChangeOne: () => void;
    onLater: () => void;
  }
  let { tab, reason, headline, onStartReading, onChangeOne, onLater }: Props = $props();

  const ageLabel = $derived(ageDays(tab.firstSeenAt));
  const eyebrow = $derived(headline ?? `现在花 ${tab.estimatedReadingMinutes} 分钟`);
</script>

<section class="text-center mb-16">
  <div class="text-paper-dim text-xs tracking-[6px] mb-2">— · —</div>
  <div class="font-serif text-paper-gold text-xs tracking-[4px] uppercase mb-5">{eyebrow}</div>

  <h2 class="font-serif text-4xl font-semibold leading-tight tracking-tight mb-4 max-w-3xl mx-auto">
    {tab.title || tab.domain}
  </h2>

  {#if reason}
    <p class="font-serif italic text-base text-paper-ink/80 mb-3 max-w-2xl mx-auto">
      {reason}
    </p>
  {/if}

  <p class="font-serif italic text-sm text-paper-muted mb-8">
    {tab.domain} · {tab.estimatedReadingMinutes} 分钟阅读 · 已开 {ageLabel} 天
  </p>

  <div class="flex justify-center gap-3">
    <button class="bg-paper-ink text-paper-bg px-7 py-2.5 text-sm rounded font-medium" onclick={onStartReading}>开始读</button>
    <button class="border border-paper-edge text-paper-ink px-5 py-2 text-sm rounded" onclick={onChangeOne}>换一个</button>
    <button class="border border-paper-edge text-paper-ink px-5 py-2 text-sm rounded" onclick={onLater}>改天</button>
  </div>
</section>
