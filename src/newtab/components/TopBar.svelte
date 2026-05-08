<script lang="ts">
  interface Props {
    pendingCount: number;
    todayDoneCount: number;
    todayTarget: number;
    oldestDays: number | null;
  }
  let { pendingCount, todayDoneCount, todayTarget, oldestDays }: Props = $props();

  const dateLabel = $derived.by(() => {
    const d = new Date();
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return `No. ${d.getDate()} · ${day}`;
  });
</script>

<header class="flex justify-between items-center mb-16 font-serif">
  <div class="text-paper-dim text-xs tracking-[3px] uppercase">{dateLabel}</div>
  <div class="text-paper-muted text-xs tracking-wider">
    {todayDoneCount} / {todayTarget} 今日 · {pendingCount} 待 {#if oldestDays !== null}· 最老 {oldestDays} 天{/if}
  </div>
</header>
