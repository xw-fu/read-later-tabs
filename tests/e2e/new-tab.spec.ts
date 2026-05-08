import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');

test('new tab page renders top bar and shows empty state when no tabs tracked', async () => {
  test.skip(!fs.existsSync(distDir), 'Run `npm run build` first');
  test.skip(true, 'Chrome blocks chrome://newtab/ in headless mode; see manual checklist below');

  const userDataDir = path.join('.playwright-tmp', String(Date.now()));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
  });

  // Wait briefly for service worker to register.
  await new Promise(r => setTimeout(r, 1500));

  const page = await ctx.newPage();
  await page.goto('chrome://newtab/');

  await expect(page.locator('header')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=今日')).toBeVisible();

  await ctx.close();
});

/*
 * Manual dogfood checklist (run after `npm run build`):
 *
 * 1. Open chrome://extensions/ → Developer Mode → "Load unpacked" → select `dist/`.
 * 2. Open a few real article tabs (e.g., a Medium post, a github repo, a youtube video).
 * 3. Open a New Tab.
 *    - TopBar should show date + counts.
 *    - HeroCard should show a recommendation.
 *    - Grid should show the rest with aging visuals (newer tabs are crisp, older ones fade).
 *    - Click a card → switches to that tab.
 *    - Click × on a card → verdict picker appears; ✓ 已读 closes the tab and the card disappears.
 *    - Long-press a card 0.5s → archive happens, card moves to "库存" section.
 *    - ⌘K opens search; ? opens help.
 * 4. Open settings (popup → 设置).
 *    - Enter an Anthropic key, save, refresh new tab → recommendation reason should appear under the title.
 */
