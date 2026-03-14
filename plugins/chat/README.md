# chat (fe-user plugin)

Real-time chat widget for the user-facing app.

## Routes

None (renders as a floating widget injected via `sdk.addComponent`).

## Store

Uses socket.io-client to connect to the backend chat service. Authentication token is passed from the auth store.

## Backend counterpart

`vbwd-backend/plugins/chat/`

## Admin counterpart

`vbwd-fe-admin/plugins/chat-admin/`
