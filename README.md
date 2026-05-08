# Read Later Tabs

A warm Chrome extension that takes over your New Tab page and turns your open
tabs into a "paper notes" library. Each new tab gives you one hand-picked
recommendation to read right now, while older tabs visibly age until you
process them.

## Install (Development)

```bash
npm install
npm run build
```

Then in Chrome:

1. Visit `chrome://extensions/`.
2. Toggle Developer Mode on.
3. Click "Load unpacked" and select the generated `dist/` directory.
4. Open a New Tab — Read Later Tabs takes over.

## Optional AI Mode

Open the extension's options page (popup → 设置) and paste an Anthropic or
OpenAI API key. The key is encrypted with AES-256-GCM in `chrome.storage.local`
and only the title + domain of each candidate tab is ever sent to the LLM.
Without a key, the extension uses a transparent local heuristic.

To point the extension at a custom AI gateway (e.g. an internal Cloudflare AI
Gateway, OpenRouter, LiteLLM, etc.), pick "自定义 (gateway)" as the provider in
the options page. Fill in:

- **协议** — pick OpenAI- or Anthropic-compatible based on what your gateway speaks
- **Base URL** — up to and including `/v1`, e.g. `https://gateway.example.com/v1`
- **Model** — the model name your gateway expects, e.g. `gpt-4o-mini`
- **API Key** — the bearer token / API key your gateway requires
- **额外 Header** — optional `Name: value` lines for routing / auth headers (encrypted)

The extension will POST to `${baseUrl}/chat/completions` (OpenAI-compatible) or
`${baseUrl}/messages` (Anthropic-compatible), with default protocol headers plus
your extras merged on top.

## Scripts

- `npm run dev` — vite dev server (use `npm run build` for actual extension testing)
- `npm run build` — produce a loadable extension in `dist/`
- `npm test` — vitest unit tests
- `npm run test:e2e` — Playwright smoke tests

## Architecture

See `docs/superpowers/specs/2026-04-27-read-later-tabs-design.md` for the full
spec, and `docs/superpowers/plans/2026-04-27-read-later-tabs.md` for this plan.
