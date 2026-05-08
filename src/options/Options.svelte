<script lang="ts">
  import { onMount } from 'svelte';
  import { storage } from '../lib/storage';
  import { generateInstallKey, encryptString, decryptString } from '../lib/crypto';
  import type { Settings, AICustomConfig } from '../lib/types';
  import { setDomainOverride } from '../newtab/actions';
  import type { DomainProfile } from '../lib/types';

  const INSTALL_KEY = 'install-key';

  let settings = $state<Settings | null>(null);
  let plainKey = $state('');
  let plainExtraHeaders = $state('');
  let customDraft = $state<{ protocol: 'openai' | 'anthropic'; baseUrl: string; model: string }>({
    protocol: 'openai',
    baseUrl: '',
    model: '',
  });
  let saved = $state(false);
  let validationError = $state<string | null>(null);
  let overriddenProfiles = $state<DomainProfile[]>([]);

  async function loadOverrides() {
    const profiles = await storage.getDomainProfiles();
    overriddenProfiles = Object.values(profiles).filter(p => p.userOverride !== null);
  }

  async function clearOverride(domain: string) {
    await setDomainOverride(domain, null);
    await loadOverrides();
  }

  async function getInstallKey(): Promise<string> {
    const r = await chrome.storage.local.get(INSTALL_KEY);
    if (r[INSTALL_KEY]) return r[INSTALL_KEY] as string;
    const k = await generateInstallKey();
    await chrome.storage.local.set({ [INSTALL_KEY]: k });
    return k;
  }

  onMount(async () => {
    settings = await storage.getSettings();
    if (settings.aiKey) {
      try {
        const ik = await getInstallKey();
        plainKey = await decryptString(settings.aiKey, ik);
      } catch { plainKey = ''; }
    }
    if (settings.aiCustom) {
      customDraft = {
        protocol: settings.aiCustom.protocol,
        baseUrl: settings.aiCustom.baseUrl,
        model: settings.aiCustom.model,
      };
      if (settings.aiCustom.extraHeaders) {
        try {
          const ik = await getInstallKey();
          plainExtraHeaders = await decryptString(settings.aiCustom.extraHeaders, ik);
        } catch { plainExtraHeaders = ''; }
      }
    }
    await loadOverrides();
  });

  async function save() {
    if (!settings) return;
    validationError = null;

    if (settings.aiProvider === 'custom') {
      const baseUrl = customDraft.baseUrl.trim().replace(/\/+$/, '');
      const model = customDraft.model.trim();
      if (!baseUrl || !model) {
        validationError = '请填写 Base URL 和 Model';
        return;
      }
      const ik = await getInstallKey();
      const newCustom: AICustomConfig = {
        protocol: customDraft.protocol,
        baseUrl,
        model,
        extraHeaders: await encryptString(plainExtraHeaders, ik),
      };
      settings.aiCustom = newCustom;
      if (plainKey.trim() === '') {
        settings.aiKey = null;
      } else {
        settings.aiKey = await encryptString(plainKey.trim(), ik);
      }
    } else if (settings.aiProvider === 'none') {
      settings.aiKey = null;
      // leave aiCustom untouched so user can switch back without losing config
    } else {
      // openai or anthropic
      if (plainKey.trim() === '') {
        settings.aiKey = null;
      } else {
        const ik = await getInstallKey();
        settings.aiKey = await encryptString(plainKey.trim(), ik);
      }
      // leave aiCustom untouched
    }

    await storage.setSettings(settings);
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }
</script>

<main class="max-w-2xl mx-auto p-8 font-serif">
  <h1 class="text-3xl mb-6">Settings</h1>

  {#if settings}
    <section class="mb-8">
      <h2 class="text-lg font-semibold mb-2">AI 推荐</h2>
      <p class="text-sm text-paper-muted mb-3">填入 API key 即启用智能推荐。Key 在本地 AES-256-GCM 加密，不会离开浏览器。</p>
      <label class="block mb-3">
        <span class="block text-sm mb-1">Provider</span>
        <select bind:value={settings.aiProvider} class="border border-paper-edge bg-paper-card p-2 rounded w-48 font-sans">
          <option value="none">关闭</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="custom">自定义 (gateway)</option>
        </select>
      </label>

      {#if settings.aiProvider === 'custom'}
        <label class="block mb-3">
          <span class="block text-sm mb-1">协议</span>
          <select bind:value={customDraft.protocol} class="border border-paper-edge bg-paper-card p-2 rounded w-48 font-sans">
            <option value="openai">OpenAI 兼容</option>
            <option value="anthropic">Anthropic 兼容</option>
          </select>
        </label>

        <label class="block mb-3">
          <span class="block text-sm mb-1">Base URL</span>
          <input type="text" bind:value={customDraft.baseUrl} class="border border-paper-edge bg-paper-card p-2 rounded w-full font-sans" placeholder="https://gateway.example.com/v1" />
        </label>

        <label class="block mb-3">
          <span class="block text-sm mb-1">Model</span>
          <input type="text" bind:value={customDraft.model} class="border border-paper-edge bg-paper-card p-2 rounded w-full font-sans" placeholder="gpt-4o-mini" />
        </label>
      {/if}

      <label class="block mb-3">
        <span class="block text-sm mb-1">API Key</span>
        <input type="password" bind:value={plainKey} class="border border-paper-edge bg-paper-card p-2 rounded w-full font-sans" placeholder="sk-…" />
      </label>

      {#if settings.aiProvider === 'custom'}
        <label class="block mb-3">
          <span class="block text-sm mb-1">额外 Header（每行一个 "Name: value"，留空表示无）</span>
          <textarea
            rows="4"
            bind:value={plainExtraHeaders}
            class="border border-paper-edge bg-paper-card p-2 rounded w-full font-sans text-sm"
            placeholder="X-Project-ID: read-later"
          ></textarea>
        </label>
      {/if}
    </section>

    <section class="mb-8">
      <h2 class="text-lg font-semibold mb-2">阈值</h2>
      <label class="block mb-3">
        <span class="block text-sm mb-1">老化天数（≥ 此值视为最老态）</span>
        <input type="number" min="1" max="60" bind:value={settings.thresholds.agedDays} class="border border-paper-edge bg-paper-card p-2 rounded w-32 font-sans" />
      </label>
      <label class="block mt-3">
        <span class="block text-sm mb-1">工具识别 · 日均停留秒数阈值</span>
        <input type="number" min="60" max="3600" bind:value={settings.thresholds.toolMinDailySeconds} class="border border-paper-edge bg-paper-card p-2 rounded w-32 font-sans" />
      </label>
      <label class="block mt-3">
        <span class="block text-sm mb-1">每日目标（TopBar 的 Y）</span>
        <input
          type="number" min="1" max="20"
          bind:value={settings.dailyTarget}
          class="border border-paper-edge bg-paper-card p-2 rounded w-32 font-sans"
        />
      </label>
    </section>

    <section class="mb-8">
      <h2 class="text-lg font-semibold mb-2">已手动标记的域名</h2>
      <p class="text-sm text-paper-muted mb-3">这些标记会覆盖自动检测。</p>
      {#if overriddenProfiles.length === 0}
        <p class="text-sm italic text-paper-muted">还没有手动标记。在 New Tab 卡片上右键可以标。</p>
      {:else}
        <ul class="text-sm divide-y divide-paper-edge">
          {#each overriddenProfiles as p (p.domain)}
            <li class="flex items-center justify-between py-2">
              <span class="font-mono">{p.domain}</span>
              <span class="font-serif italic text-paper-muted">{p.userOverride === 'tool' ? '工具' : '内容'}</span>
              <button
                type="button"
                class="text-paper-gold underline text-xs"
                onclick={() => clearOverride(p.domain)}
              >撤销</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="mb-8">
      <h2 class="text-lg font-semibold mb-2">排除域名</h2>
      <p class="text-sm text-paper-muted mb-3">这些域名永远不会出现在推荐池里（每行一个）。</p>
      <textarea
        rows="5"
        class="border border-paper-edge bg-paper-card p-2 rounded w-full font-sans text-sm"
        value={settings.excludedDomains.join('\n')}
        oninput={(e) => settings!.excludedDomains = (e.currentTarget as HTMLTextAreaElement).value.split('\n').map(s => s.trim()).filter(Boolean)}
      ></textarea>
    </section>

    <button class="bg-paper-ink text-paper-bg px-6 py-2 rounded font-sans text-sm" onclick={save}>保存</button>
    {#if saved}<span class="ml-3 text-sm text-emerald-700">已保存</span>{/if}
    {#if validationError}<span class="ml-3 text-sm text-rose-700">{validationError}</span>{/if}
  {:else}
    <p class="text-paper-muted italic">Loading…</p>
  {/if}
</main>
