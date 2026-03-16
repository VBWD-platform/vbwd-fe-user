# Plugin: taro (fe-user)

## Purpose

Tarot card reading UI with AI-powered interpretations. Full-featured oracle system with 3-card spread (Past/Present/Future), animated card reveals, conversation-based follow-up questions, situation readings, daily session limits, session history, and privacy-respecting conversation clearing on session expiry. Uses the backend `taro` plugin for LLM generation.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

Requires the backend `taro` plugin to be enabled.

## Routes Added

| Path | Component | Auth required |
|------|-----------|---------------|
| `/dashboard/taro` | `Taro.vue` | Yes |

## Stores

**Store name:** `taro`

| State key | Type | Description |
|-----------|------|-------------|
| `currentSession` | `TaroSession \| null` | Active reading session |
| `sessionHistory` | `TaroSession[]` | Past sessions (paginated) |
| `dailyLimits` | `DailyLimits \| null` | Token/session limits from plan |
| `openedCards` | `Set<string>` | Revealed cards in current spread |
| `conversationMessages` | `ConversationMessage[]` | Oracle dialogue |
| `oraclePhase` | enum | State machine: `idle \| asking_mode \| asking_situation \| reading \| done` |
| `loading` | `boolean` | Loading state |
| `error` | `string \| null` | Error message |

**Key actions:** `createSession()`, `addFollowUp(question, type)`, `fetchHistory(params)`, `fetchDailyLimits()`, `submitSituation(text)`, `askFollowUpQuestion(question)`, `askCardExplanation()`, `closeSession()`, `initialize()`, `reset()`

**Key getters:** `hasActiveSession`, `isSessionExpired`, `canCreateSession`, `sessionsRemaining`, `canAddFollowUp`, `followUpsRemaining`, `hasExpiryWarning`, `sessionTimeRemaining`, `allCardsOpened`

## i18n Keys

Translations live in `plugins/taro/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/taro/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/taro/
├── index.ts
├── src/
│   ├── Taro.vue                 # Main oracle view
│   ├── components/
│   │   ├── CardDisplay.vue
│   │   ├── CardsGrid.vue
│   │   ├── ConversationBox.vue
│   │   ├── OracleDialog.vue
│   │   ├── SessionExpiryWarning.vue
│   │   ├── SessionHistory.vue
│   │   ├── DailyLimitsCard.vue
│   │   └── ...
│   ├── stores/
│   │   └── taro.ts             # Full state machine + API calls
│   └── utils/
│       └── markdownFormatter.ts # Oracle response formatting
├── assets/arcana/               # Card SVG assets (fetched from backend)
└── locales/                     # 8 locale files
```

## Extending

The oracle phase state machine (`oraclePhase`) controls which UI mode is active. Add new phases (e.g. `'sharing'` for social sharing) by extending the store's `setOraclePhase()` and adding corresponding UI branches in `Taro.vue`.
