# taro (fe-user plugin)

Taro subscription onboarding — guided session flow for new subscribers.

## Routes

Registered via `sdk.addRoute` in `index.ts`. See `src/views/` for the exact paths.

## Store

`src/stores/useTaroStore.ts` — session state and step management.

## Backend counterpart

`vbwd-backend/plugins/taro/` — `/api/v1/taro/*`

## Admin counterpart

`vbwd-fe-admin/plugins/taro-admin/`
