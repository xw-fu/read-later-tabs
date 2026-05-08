<script lang="ts">
  import { onMount } from 'svelte';
  import { storage } from '../lib/storage';

  let pending = $state(0);
  let archived = $state(0);
  let aiOn = $state(false);

  onMount(async () => {
    const tabs = await storage.getTabs();
    const settings = await storage.getSettings();
    pending = tabs.filter(t => !t.isArchived && !t.isTool && !t.isPinned).length;
    archived = tabs.filter(t => t.isArchived).length;
    aiOn = settings.aiProvider !== 'none' && settings.aiKey !== null;
  });
</script>

<main class="p-4 font-sans">
  <h2 class="font-serif text-lg mb-3">Read Later Tabs</h2>
  <dl class="text-sm text-paper-muted space-y-1 mb-4">
    <div class="flex justify-between"><dt>待处理</dt><dd>{pending}</dd></div>
    <div class="flex justify-between"><dt>库存</dt><dd>{archived}</dd></div>
    <div class="flex justify-between"><dt>AI 模式</dt><dd>{aiOn ? '开启' : '关闭'}</dd></div>
  </dl>
  <button class="text-paper-gold underline text-sm" onclick={() => chrome.runtime.openOptionsPage()}>设置</button>
</main>
