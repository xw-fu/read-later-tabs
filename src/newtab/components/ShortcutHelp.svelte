<script lang="ts">
  interface Props { onClose: () => void; }
  let { onClose }: Props = $props();
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
</script>

<svelte:window onkeydown={onKey} />

<button
  type="button"
  class="fixed inset-0 bg-paper-bg/95 z-50 cursor-default"
  onclick={onClose}
  aria-label="关闭快捷键面板"
></button>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
  <div class="bg-paper-card border border-paper-edge rounded shadow-lg max-w-md p-6 font-serif pointer-events-auto">
    <h3 class="text-lg mb-4">快捷键</h3>
    <dl class="text-sm space-y-2">
      <div class="flex justify-between"><dt>⌘K / Ctrl+K</dt><dd class="text-paper-muted">搜索</dd></div>
      <div class="flex justify-between"><dt>⌘Enter</dt><dd class="text-paper-muted">开始读 Hero 推荐</dd></div>
      <div class="flex justify-between"><dt>⌘R</dt><dd class="text-paper-muted">换一个推荐</dd></div>
      <div class="flex justify-between"><dt>?</dt><dd class="text-paper-muted">显示这个面板</dd></div>
      <div class="flex justify-between"><dt>Esc</dt><dd class="text-paper-muted">关闭面板</dd></div>
    </dl>
    <p class="text-xs text-paper-muted mt-4">长按任意纸笺 0.5 秒可快速归档（无需选裁决）。</p>
  </div>
</div>
