# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-23

### Added

- **TabGroup component** — groups tabs under a titled, collapsible section with a live count badge and a bulk-action button that appears once enough tabs are selected.
- **TabCard variants** — cards now derive an `archive` or `tool` variant from their tab metadata, with a tool badge and a dedicated context menu for archived cards.
- **`reopenArchived` action** — restores an archived tab back to the active reading list.
- **`discardArchived` action** — permanently removes an archived tab.

### Changed

- New Tab page renders two `TabGroup` sections (active and archived) in a full-width container, replacing the previous single-column grid layout.
- Aging indicators are suppressed for `tool` and `archive` variant cards so only actively deferred tabs show urgency.

### Removed

- `TabGrid`, `ToolsSection`, and `ArchiveSection` components — all superseded by the unified `TabGroup`.
- Archive prompt banner on the New Tab page.

### Fixed

- Bulk-action button inside `TabGroup` now defaults to `type="button"`, preventing accidental form submission.

## [0.1.1] - 2026-05-08

Initial public release. Read Later Tabs is a Chrome extension that takes over
the New Tab page and turns your open tabs into a "paper notes" library. Each
new tab gives you one hand-picked recommendation to read right now, while older
tabs visibly age until you process them.

### Added

- **New Tab takeover** — replaces Chrome's New Tab page with a paper-themed
  reading library backed by your currently open tabs.
- **Hero recommendation** — one hand-picked tab is surfaced on every New Tab
  open, with a short reason and an estimated reading time.
- **Visible aging** — tabs you've kept around longer than others fade and
  show their age so the backlog stays honest. A background alarm reprocesses
  ages on a schedule.
- **Triage actions** — keep, archive, discard, snooze, and bulk-triage flows,
  driven by a context menu, a verdict picker, and keyboard shortcuts.
- **Search overlay** — fuzzy search across open tabs from the New Tab page.
- **Domain profiler** — passive per-domain signal collection used by the
  recommender.
- **Local heuristic recommender** — transparent, no-key-required ranking based
  on recency, domain profile, and estimated reading time.
- **Optional AI mode** — pluggable recommender backed by Anthropic, OpenAI, or
  a custom OpenAI-/Anthropic-compatible gateway (e.g. Cloudflare AI Gateway,
  OpenRouter, LiteLLM). Only the title and domain of each candidate are sent.
- **Custom gateway support** — configurable base URL, model, bearer token, and
  extra headers, with protocol selection between OpenAI- and
  Anthropic-compatible chat APIs.
- **Client-side key encryption** — the API key (and any extra headers) are
  encrypted with AES-256-GCM and stored in `chrome.storage.local`.
- **Popup and options pages** — quick access via the toolbar popup, with full
  AI configuration on the options page.

### Security

- API keys never leave the browser unencrypted; they are sealed with
  AES-256-GCM before being persisted to `chrome.storage.local`.

[0.2.0]: https://github.com/xw-fu/read-later-tabs/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/xw-fu/read-later-tabs/releases/tag/v0.1.1
