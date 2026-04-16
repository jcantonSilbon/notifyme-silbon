/**
 * notify-me.js — Silbon Back-in-Stock App Block
 * ───────────────────────────────────────────────
 * Responsibilities:
 *  1. Detect the selected variant on the product page
 *  2. Show the "Notify Me" form when the variant is OOS
 *  3. Hide it when the variant is in stock (add-to-cart takes over)
 *  4. POST to the NotifyMe backend on submit
 *  5. Always leave the component in a consistent state after any variant change
 *
 * No framework. No dependencies. Vanilla JS only.
 *
 * ── HOW TO CONFIGURE FOR THE SILBON THEME ───────────────────────────────
 * 1. Open DevTools on the product page (in the Silbon theme)
 * 2. Paste in the console:
 *      ['variant:change','on:variant:change','variantChange'].forEach(n =>
 *        document.addEventListener(n, e => console.log(n, e.detail), true));
 * 3. Change a variant selector and observe which event logs in the console
 * 4. Set that event name as SILBON_THEME_EVENT below
 * ────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // ① SILBON-SPECIFIC EVENT — SET THIS ONCE YOU KNOW THE THEME'S EVENT NAME
  // ═══════════════════════════════════════════════════════════════════════
  // Set to the exact event name your theme fires on variant change.
  // When non-null, this is used as the PRIMARY listener. Generic fallbacks
  // are still registered but won't conflict (duplicate-bind guard below).
  // Example: const SILBON_THEME_EVENT = 'variant:change';
  const SILBON_THEME_EVENT = null; // ← fill in after theme inspection

  // ② Generic fallback events tried in order (Dawn, Impulse/Prestige, legacy)
  const GENERIC_VARIANT_EVENTS = [
    'variant:change',     // Dawn and most official Shopify themes
    'on:variant:change',  // Impulse, Prestige, Archetype themes
    'variantChange',      // Some legacy / custom themes
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // DOM references — bail early if block is not on this page
  // ═══════════════════════════════════════════════════════════════════════
  const container       = document.getElementById('notify-me-container');
  if (!container) return;

  const form               = document.getElementById('notify-me-form');
  const submitBtn          = document.getElementById('notify-me-submit');
  const messageEl          = document.getElementById('notify-me-message');
  const variantIdInput     = document.getElementById('notify-me-variant-id');
  const variantTitleInput  = document.getElementById('notify-me-variant-title');
  const productHandleInput = document.getElementById('notify-me-product-handle');
  const emailInput         = document.getElementById('notify-me-email');

  if (!form || !submitBtn || !messageEl || !variantIdInput || !variantTitleInput || !productHandleInput || !emailInput) {
    return;
  }

  // ── Normalize backendUrl — strip trailing slash to avoid //api/subscribe ──
  const backendUrl = (container.dataset.backendUrl || '').replace(/\/+$/, '');

  // ═══════════════════════════════════════════════════════════════════════
  // UI STATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * FIXED: saves original button text BEFORE mutating it.
   * On first call with loading=true: reads textContent (still original), saves it,
   * then sets "Enviando...".
   * On subsequent calls: reads from dataset.originalText (already saved).
   */
  function setLoading(loading) {
    // Snapshot original text on the very first call, before any mutation
    if (!submitBtn.dataset.originalText) {
      submitBtn.dataset.originalText = submitBtn.textContent.trim();
    }
    submitBtn.disabled = loading;
    submitBtn.textContent = loading
      ? 'Enviando...'
      : (submitBtn.dataset.originalText || 'Avisarme');
  }

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'notify-me__message notify-me__message--' + type;
    messageEl.style.display = '';
  }

  function hideMessage() {
    messageEl.style.display = 'none';
    messageEl.textContent = '';
    messageEl.className = 'notify-me__message';
  }

  /**
   * Resets the form to a clean ready-to-submit state.
   * Called every time we switch to a new OOS variant, so the user
   * always sees a fresh form — even if they previously submitted for
   * a different variant and the form was hidden.
   *
   * Optionally uncomment `emailInput.value = ''` to also clear the email field.
   */
  function resetFormState() {
    form.style.display = '';  // always show the form (re-show after post-submit hide)
    hideMessage();             // clear success/error message from previous variant
    setLoading(false);         // re-enable button, restore original text
    // emailInput.value = ''; // uncomment to clear email on variant change
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VARIANT UPDATE — single source of truth for show/hide logic
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Called whenever the selected variant changes (from events or fallback observer).
   * Always leaves the component in a consistent state:
   *   - OOS variant  → container shown, form reset to clean state
   *   - In-stock     → container hidden, message cleared (no leftover state)
   *
   * Covered flow:
   *   1. PDP loads  → init() sets initial state from Liquid data attribute
   *   2. → OOS      → container shown, form visible, clean
   *   3. Submit OK  → form hidden, success message shown
   *   4. → in-stock → container hidden (step 5 below)
   *   5. → OOS again → container shown, form RE-SHOWN, message cleared ✓
   */
  function updateVariant(variant) {
    if (!variant || typeof variant.id === 'undefined') return;

    // Update hidden inputs and data attributes
    variantIdInput.value = String(variant.id);
    variantTitleInput.value = variant.title || variant.name || '';
    container.dataset.variantId = String(variant.id);
    container.dataset.variantTitle = variant.title || variant.name || '';

    const isAvailable = Boolean(variant.available);

    if (isAvailable) {
      // In stock: hide everything, clear any lingering message
      container.style.display = 'none';
      hideMessage();
    } else {
      // OOS: reset form to clean state THEN show container
      // resetFormState() handles: form visible, message cleared, button enabled
      resetFormState();
      container.style.display = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VARIANT CHANGE DETECTION — priority order
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Extracts the variant object from a theme custom event.
   * Handles the three most common detail shapes:
   *   { variant: {...} }          — Dawn
   *   { selectedVariant: {...} }  — some Archetype themes
   *   variant object directly     — some custom themes
   */
  function handleVariantChangeEvent(event) {
    const detail = event.detail;
    if (!detail) return;
    const variant = detail.variant || detail.selectedVariant || detail;
    if (variant && typeof variant.id !== 'undefined') {
      updateVariant(variant);
    }
  }

  // Priority 1 — theme-specific event (most reliable, set SILBON_THEME_EVENT above)
  if (SILBON_THEME_EVENT) {
    document.addEventListener(SILBON_THEME_EVENT, handleVariantChangeEvent);
  }

  // Priority 2 — generic fallback events
  // Skips any event already registered as SILBON_THEME_EVENT (no double-binding)
  GENERIC_VARIANT_EVENTS.forEach(function (eventName) {
    if (eventName !== SILBON_THEME_EVENT) {
      document.addEventListener(eventName, handleVariantChangeEvent);
    }
  });

  // Priority 3 — MutationObserver fallback (themes that don't dispatch custom events)
  // Watches the add-to-cart button's disabled/text state change, then
  // reads the selected variant ID from the form and fetches via product.js.
  // This is async (requires a fetch) so it's intentionally last resort.
  (function setupMutationFallback() {
    const addToCartBtn =
      document.querySelector('[name="add"]') ||
      document.querySelector('button[data-variant-id]') ||
      document.querySelector('.product-form__cart-submit');

    if (!addToCartBtn) return;

    // Track last seen variantId to avoid spurious re-fetches
    let lastObservedVariantId = variantIdInput.value;

    const observer = new MutationObserver(function () {
      const currentId = getSelectedVariantIdFromPage();
      if (currentId && currentId !== lastObservedVariantId) {
        lastObservedVariantId = currentId;
        fetchAndUpdateVariant(currentId);
      }
    });

    observer.observe(addToCartBtn, { attributes: true, childList: false, subtree: false });
  })();

  // ── Reads the selected variant ID from standard theme form inputs or URL ──
  function getSelectedVariantIdFromPage() {
    // Most themes: hidden input inside the product form
    const input = document.querySelector(
      'form[action*="/cart/add"] input[name="id"],' +
      'form[data-type="add-to-cart-form"] input[name="id"]'
    );
    if (input && input.value) return input.value;

    // Fallback: URL query parameter (?variant=xxx)
    const urlVariant = new URLSearchParams(window.location.search).get('variant');
    if (urlVariant) return urlVariant;

    return null;
  }

  // ── Fetches variant availability via Shopify's product.js endpoint ────────
  function fetchAndUpdateVariant(variantId) {
    const handle = getProductHandleFromPage();
    if (!handle) return;

    fetch('/products/' + handle + '.js')
      .then(function (res) { return res.json(); })
      .then(function (product) {
        const variant = product.variants.find(function (v) {
          return String(v.id) === String(variantId);
        });
        if (variant) updateVariant(variant);
      })
      .catch(function () {
        // Silent fail — page still works, form just won't auto-toggle
      });
  }

  function getProductHandleFromPage() {
    // Prefer og:url meta tag (available in all Shopify themes)
    const meta = document.querySelector('meta[property="og:url"]');
    if (meta) {
      const match = (meta.getAttribute('content') || '').match(/\/products\/([^/?#]+)/);
      if (match) return match[1];
    }
    // Fallback: parse from window.location.pathname
    const pathMatch = window.location.pathname.match(/\/products\/([^/?#]+)/);
    if (pathMatch) return pathMatch[1];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALISATION — reads from Liquid-rendered data attribute
  // ═══════════════════════════════════════════════════════════════════════
  /**
   * The Liquid template renders data-initially-available="true|false" directly.
   * No API call needed — Liquid already knows the correct state at render time.
   *
   * The container always starts with display:none (safe default).
   * We show it here only if the initial variant is OOS.
   */
  (function init() {
    // Liquid renders "true" or "false" as a string
    const initiallyAvailable = container.dataset.initiallyAvailable === 'true';
    if (!initiallyAvailable) {
      // Initial variant is OOS — show the form immediately
      // (No resetFormState needed — this is a fresh page load, form is already clean)
      container.style.display = '';
    }
    // If available: container stays hidden (display:none from inline style)
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // FORM SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════
  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (!backendUrl) {
      showMessage('Error de configuración: falta la URL del backend.', 'error');
      return;
    }

    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      showMessage('Por favor, introduce un email válido.', 'error');
      emailInput.focus();
      return;
    }

    setLoading(true);

    const payload = {
      email,
      productId:     String(container.dataset.productId || ''),
      productHandle: String(productHandleInput.value || container.dataset.productHandle || ''),
      variantId:     String(variantIdInput.value || ''),
      productTitle:  String(
        container.dataset.productTitle ||
        document.querySelector('h1')?.textContent?.trim() || ''
      ),
      variantTitle:  String(variantTitleInput.value || ''),
      honeypot:      String(document.getElementById('notify-me-honeypot')?.value || ''),
    };

    try {
      const response = await fetch(backendUrl + '/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        // Success: hide the form, show the message
        form.style.display = 'none';
        showMessage(data.message || '¡Te avisaremos cuando esté disponible!', 'success');
        // Button stays disabled — no point re-enabling a hidden form.
        // resetFormState() will restore it if the user switches to another OOS variant.
      } else {
        showMessage(data.error || 'Ha ocurrido un error. Por favor, inténtalo de nuevo.', 'error');
        setLoading(false);
      }
    } catch (_err) {
      showMessage('Error de conexión. Por favor, inténtalo de nuevo.', 'error');
      setLoading(false);
    }
  });

})();
