# Landing1 Plugin

Public landing page with tariff plan selection. Can be used standalone (`/landing1`) or embedded via iframe on external websites.

## Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/landing1` | No | Standalone plan selection page |
| `/embed/landing1` | No | Embeddable version for iframes |

## Standalone Usage

Navigate directly to your VBWD instance:

```
http://your-vbwd-domain.com/landing1
```

Clicking a plan redirects to `/checkout?tarif_plan_id=<slug>`.

## Embedding on External Websites

The embed mode renders the plan selection inside an iframe. Plan clicks send a `postMessage` to the parent page instead of navigating.

### Basic Embed

```html
<div id="vbwd-iframe"></div>
<script
  src="http://your-vbwd-domain.com/embed/widget.js"
  data-origin="http://your-vbwd-domain.com"
></script>
```

### Full Example with Checkout Redirect

```html
<div id="vbwd-iframe"></div>
<script
  src="http://your-vbwd-domain.com/embed/widget.js"
  data-origin="http://your-vbwd-domain.com"
  data-locale="en"
  data-theme="light"
  data-height="600"
></script>
<script>
  document.getElementById('vbwd-iframe').addEventListener('vbwd:plan-selected', function(e) {
    // Redirect to VBWD checkout
    window.location.href = 'http://your-vbwd-domain.com/checkout?tarif_plan_id=' + e.detail.planSlug;
  });
</script>
```

### Widget Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-origin` | Yes | — | Full URL of your VBWD instance |
| `data-locale` | No | `en` | Language (`en` or `de`) |
| `data-theme` | No | `light` | Theme (`light` or `dark`) |
| `data-height` | No | `600` | Initial iframe height in pixels |
| `data-container` | No | `vbwd-iframe` | ID of the container element |

### Events

The iframe communicates with the parent page via `postMessage`. The widget script converts these into DOM `CustomEvent`s on the container element.

#### `vbwd:plan-selected`

Fired when a user clicks "Choose Plan".

```js
document.getElementById('vbwd-iframe').addEventListener('vbwd:plan-selected', function(e) {
  console.log(e.detail);
  // {
  //   planSlug: "basic-monthly",
  //   planName: "Basic",
  //   price: 9.99,
  //   currency: "EUR"
  // }
});
```

#### `vbwd:resize`

Fired automatically when the iframe content height changes. The widget handles this internally — the iframe resizes itself. No action needed from the host page.

### Security

- The iframe uses `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`
- Only `/embed/*` paths allow framing (`Content-Security-Policy: frame-ancestors *`)
- All other routes respond with `X-Frame-Options: DENY`
- The widget validates `data-origin` as a valid URL before creating the iframe
- `postMessage` events are validated against the configured origin

## Files

| File | Description |
|------|-------------|
| `index.ts` | Plugin entry — registers routes and translations |
| `Landing1View.vue` | Standalone plan selection page |
| `EmbedLanding1View.vue` | Embed wrapper — handles postMessage, locale, theme, auto-resize |
| `embed-widget.js` | JS snippet loaded by external sites — creates iframe, relays events |
| `locales/en.json` | English translations |
| `locales/de.json` | German translations |
| `config.json` | Plugin config schema |
| `admin-config.json` | Admin panel UI config |

---

## Related

**Core:** [vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user) · [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core)
