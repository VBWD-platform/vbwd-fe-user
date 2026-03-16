# Plugin: chat (fe-user)

## Purpose

LLM chat UI in the user dashboard. Provides a dedicated chat view for conversational interactions with the backend `chat` plugin. Users spend platform tokens per message. Supports 8 interface languages.

## Installation

The plugin self-registers in `plugins/plugins.json`. It is loaded by `vue/src/main.ts` via `pluginLoader`.

Requires the backend `chat` plugin to be enabled.

## Routes Added

| Path | Component | Auth required |
|------|-----------|---------------|
| `/dashboard/chat` | `ChatView.vue` | Yes |

## Stores

No Pinia store. API calls are made directly from `ChatView.vue` via `src/api.ts`.

## i18n Keys

Translations live in `plugins/chat/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/chat/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/chat/
├── index.ts              # Plugin install: addRoute /dashboard/chat
├── src/
│   ├── ChatView.vue      # Main chat UI (message list + input)
│   ├── ChatHeader.vue
│   ├── ChatInput.vue
│   ├── ChatMessage.vue
│   └── api.ts            # send(), estimate(), getConfig()
└── locales/              # 8 locale files
```

## Extending

To add streaming responses, replace `api.ts` with a `fetch` + `ReadableStream` implementation and update `ChatView.vue` to render incremental tokens.
