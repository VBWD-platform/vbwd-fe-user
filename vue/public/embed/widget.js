(function() {
  'use strict';

  // Find our script tag — supports both data-origin and data-embed selectors
  var scripts = document.querySelectorAll('script[data-origin], script[data-embed]');
  var scriptTag = scripts[scripts.length - 1];

  if (!scriptTag) {
    console.error('[VBWD] Widget script must have a data-origin or data-embed attribute');
    return;
  }

  // Default origin to current page origin so widgets work without hardcoded URLs
  var origin = scriptTag.getAttribute('data-origin') || window.location.origin;
  var embed = scriptTag.getAttribute('data-embed') || 'landing1';
  var locale = scriptTag.getAttribute('data-locale') || 'en';
  var theme = scriptTag.getAttribute('data-theme') || 'light';
  var category = scriptTag.getAttribute('data-category') || '';
  var containerId = scriptTag.getAttribute('data-container') || 'vbwd-iframe';
  var height = scriptTag.getAttribute('data-height') || '600';

  // Sanitize origin — must be a valid URL
  try {
    new URL(origin);
  } catch (e) {
    console.error('[VBWD] Invalid data-origin URL:', origin);
    return;
  }

  // Find container
  var container = document.getElementById(containerId);
  if (!container) {
    console.error('[VBWD] Container element #' + containerId + ' not found');
    return;
  }

  // Build iframe URL
  var iframeSrc = origin + '/embed/' + encodeURIComponent(embed) +
    '?locale=' + encodeURIComponent(locale) + '&theme=' + encodeURIComponent(theme) +
    (category ? '&category=' + encodeURIComponent(category) : '');

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.style.width = '100%';
  iframe.style.height = height + 'px';
  iframe.style.border = 'none';
  iframe.style.overflow = 'hidden';
  iframe.setAttribute('title', 'VBWD Plans');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

  container.appendChild(iframe);

  // Listen for postMessage from iframe
  window.addEventListener('message', function(event) {
    // Validate origin — only accept messages from our VBWD instance
    if (event.origin !== origin) {
      return;
    }

    var data = event.data;
    if (!data || typeof data !== 'object' || !data.type) {
      return;
    }

    if (data.type === 'vbwd:plan-selected') {
      // Dispatch custom event on container for host page to handle
      var customEvent = new CustomEvent('vbwd:plan-selected', {
        detail: data.payload,
        bubbles: true
      });
      container.dispatchEvent(customEvent);

      // Default behaviour: redirect to checkout unless host page called preventDefault()
      if (!customEvent.defaultPrevented) {
        var checkoutBase = scriptTag.getAttribute('data-checkout-url') || (origin + '/checkout');
        window.location.href = checkoutBase + '?tarif_plan_id=' + encodeURIComponent(data.payload.planSlug);
      }
    }

    if (data.type === 'vbwd:resize') {
      // Auto-resize iframe to content height
      iframe.style.height = data.payload.height + 'px';
    }
  });
})();
