/**
 * notify-me.js
 *
 * Robust OS 2.0 strategy:
 * 1. Reuse the theme's real variant selection whenever it is present and usable.
 * 2. Fall back to the block's own selector when the theme does not expose a usable picker.
 * 3. Never default subscriptions to selected_or_first_available_variant.
 */
(function () {
  'use strict';

  var container = document.getElementById('notify-me-container');
  if (!container) return;

  var form = document.getElementById('notify-me-form');
  var submitBtn = document.getElementById('notify-me-submit');
  var messageEl = document.getElementById('notify-me-message');
  var variantIdInput = document.getElementById('notify-me-variant-id');
  var inventoryItemIdInput = document.getElementById('notify-me-inventory-item-id');
  var variantTitleInput = document.getElementById('notify-me-variant-title');
  var productHandleInput = document.getElementById('notify-me-product-handle');
  var emailInput = document.getElementById('notify-me-email');
  var fallbackWrap = document.getElementById('notify-me-selector-wrap');
  var fallbackLabel = document.getElementById('notify-me-selector-label');
  var fallbackSelect = document.getElementById('notify-me-variant-select');
  var productDataEl = document.getElementById('notify-me-product-data');

  if (
    !form ||
    !submitBtn ||
    !messageEl ||
    !variantIdInput ||
    !inventoryItemIdInput ||
    !variantTitleInput ||
    !productHandleInput ||
    !emailInput ||
    !fallbackWrap ||
    !fallbackLabel ||
    !fallbackSelect ||
    !productDataEl
  ) {
    return;
  }

  var backendUrl = (container.dataset.backendUrl || '').replace(/\/+$/, '');
  var productData = parseProductData(productDataEl.textContent);
  if (!productData || !Array.isArray(productData.variants) || !productData.variants.length) return;

  var variantsById = {};
  productData.variants.forEach(function (variant) {
    variantsById[String(variant.id)] = variant;
  });

  var themeVariantEvents = ['variant:change', 'on:variant:change', 'variantChange'];
  var currentVariant = null;
  var lastThemeVariantId = null;
  var singleVariant = productData.variants.length === 1;
  var multiVariant = productData.variants.length > 1;
  var fallbackRequired = false;
  var optionNames = Array.isArray(productData.option_names) ? productData.option_names : [];
  var sizeOptionIndex = getSizeOptionIndex(optionNames);
  var hasUnavailableVariants = productData.variants.some(function (variant) {
    return !variant.available;
  });

  function parseProductData(raw) {
    try {
      return JSON.parse(raw || '{}');
    } catch (_error) {
      return null;
    }
  }

  function setLoading(loading) {
    if (!submitBtn.dataset.originalText) {
      submitBtn.dataset.originalText = submitBtn.textContent.trim();
    }

    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Enviando...' : (submitBtn.dataset.originalText || 'Avisarme');
  }

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'notify-me__message notify-me__message--' + type;
    messageEl.style.display = '';
  }

  function hideMessage() {
    messageEl.textContent = '';
    messageEl.className = 'notify-me__message';
    messageEl.style.display = 'none';
  }

  function resetFormState() {
    form.style.display = '';
    hideMessage();
    setLoading(false);
  }

  function getVariantById(variantId) {
    if (variantId == null || variantId === '') return null;
    return variantsById[String(variantId)] || null;
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function getSizeOptionIndex(names) {
    var sizeNames = ['talla', 'size', 'taille', 'groesse', 'grosse'];

    for (var i = 0; i < names.length; i += 1) {
      if (sizeNames.indexOf(normalizeText(names[i])) >= 0) {
        return i;
      }
    }

    return -1;
  }

  function getSelectedVariantIdFromUrl() {
    return new URLSearchParams(window.location.search).get('variant');
  }

  function getProductForms() {
    return Array.prototype.slice.call(
      document.querySelectorAll('form[action*="/cart/add"], form[data-type="add-to-cart-form"]')
    );
  }

  function getThemeIdInputs() {
    return getProductForms()
      .map(function (formEl) { return formEl.querySelector('input[name="id"]'); })
      .filter(Boolean);
  }

  function getThemeOptionInputs() {
    return Array.prototype.slice.call(
      document.querySelectorAll(
        'variant-selects select,' +
        'variant-radios fieldset input,' +
        'input[name^="options["],' +
        'select[name^="options["],' +
        '[data-option-position] input,' +
        '[data-option-position] select'
      )
    ).filter(isUsableElement);
  }

  function getVisibleLabelText(element) {
    if (!element) return '';

    var labelText = '';
    var label = element.closest('label');
    if (label) labelText += ' ' + label.textContent;

    var fieldset = element.closest('fieldset');
    if (fieldset) {
      var legend = fieldset.querySelector('legend');
      if (legend) labelText += ' ' + legend.textContent;
    }

    var wrapper = element.closest('[data-option-name], [data-option-position], [data-index], .product-form__input, .selector-wrapper');
    if (wrapper) {
      labelText += ' ' + (wrapper.getAttribute('data-option-name') || '');
      labelText += ' ' + (wrapper.getAttribute('data-index') || '');
      labelText += ' ' + (wrapper.textContent || '');
    }

    labelText += ' ' + (element.getAttribute('name') || '');
    labelText += ' ' + (element.getAttribute('aria-label') || '');

    return normalizeText(labelText);
  }

  function themeHasVisibleSizeSelector() {
    if (sizeOptionIndex < 0) return false;

    var expectedName = normalizeText(optionNames[sizeOptionIndex]);
    var expectedPosition = String(sizeOptionIndex + 1);

    return getThemeOptionInputs().some(function (element) {
      var labelText = getVisibleLabelText(element);
      return (
        labelText.indexOf(expectedName) >= 0 ||
        labelText.indexOf('option' + expectedPosition) >= 0 ||
        labelText.indexOf('option ' + expectedPosition) >= 0 ||
        labelText.indexOf('options[' + expectedName + ']') >= 0
      );
    });
  }

  function isUsableElement(element) {
    if (!element) return false;
    if (element.disabled) return false;
    if (!(element.offsetWidth || element.offsetHeight || element.getClientRects().length)) return false;
    return true;
  }

  function getThemeVariantFromInputs() {
    var idInputs = getThemeIdInputs();
    for (var i = 0; i < idInputs.length; i += 1) {
      var value = idInputs[i].value;
      var variant = getVariantById(value);
      if (variant) return variant;
    }

    return getVariantById(getSelectedVariantIdFromUrl());
  }

  function hasUsableThemeSelector() {
    if (!multiVariant) return false;

    if (sizeOptionIndex >= 0) {
      if (!themeHasVisibleSizeSelector()) return false;
      return Boolean(getThemeVariantFromInputs());
    }

    if (getThemeOptionInputs().length > 0) {
      return Boolean(getThemeVariantFromInputs());
    }

    return false;
  }

  function shouldUseFallbackSelector() {
    if (singleVariant) return false;
    return !hasUsableThemeSelector();
  }

  function getFallbackPromptText() {
    var label = sizeOptionIndex >= 0 ? optionNames[sizeOptionIndex] : 'talla';
    return 'Selecciona tu ' + label;
  }

  function getFallbackOptionLabel(variant) {
    var optionValue =
      sizeOptionIndex >= 0 && Array.isArray(variant.options)
        ? variant.options[sizeOptionIndex]
        : variant.option1 || variant.title || ('Variante ' + variant.id);
    return variant.available ? optionValue + ' - disponible' : optionValue;
  }

  function renderFallbackSelector(selectedId) {
    fallbackLabel.textContent = getFallbackPromptText();
    fallbackSelect.innerHTML = '';

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = getFallbackPromptText();
    placeholder.disabled = true;
    placeholder.selected = !selectedId;
    fallbackSelect.appendChild(placeholder);

    productData.variants.forEach(function (variant) {
      var option = document.createElement('option');
      option.value = String(variant.id);
      option.textContent = getFallbackOptionLabel(variant);
      option.disabled = Boolean(variant.available);
      option.selected = String(variant.id) === String(selectedId || '');
      fallbackSelect.appendChild(option);
    });
  }

  function syncThemeInputs(variant) {
    if (!variant) return;

    getThemeIdInputs().forEach(function (input) {
      if (input.value !== String(variant.id)) {
        input.value = String(variant.id);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function setFallbackVisibility(visible) {
    fallbackWrap.style.display = visible ? '' : 'none';
    fallbackSelect.required = visible;
  }

  function applyVariant(variant, source) {
    currentVariant = variant;

    if (!variant) {
      variantIdInput.value = '';
      inventoryItemIdInput.value = '';
      variantTitleInput.value = '';
      hideMessage();
      if (fallbackRequired && hasUnavailableVariants) {
        resetFormState();
        container.style.display = '';
      } else {
        container.style.display = 'none';
      }
      return;
    }

    variantIdInput.value = String(variant.id);
    inventoryItemIdInput.value = String(variant.inventory_item_id || '');
    variantTitleInput.value = variant.title || '';
    container.dataset.variantId = String(variant.id);
    container.dataset.variantTitle = variant.title || '';

    if (source === 'theme') {
      lastThemeVariantId = String(variant.id);
    }

    if (variant.available) {
      container.style.display = 'none';
      hideMessage();
      return;
    }

    resetFormState();
    container.style.display = '';
  }

  function ensureResolvedVariant() {
    fallbackRequired = shouldUseFallbackSelector();
    setFallbackVisibility(fallbackRequired);

    if (singleVariant) {
      applyVariant(productData.variants[0], 'single');
      return;
    }

    if (!fallbackRequired) {
      var themeVariant = getThemeVariantFromInputs();
      applyVariant(themeVariant, 'theme');
      return;
    }

    var preselectedVariant = getVariantById(fallbackSelect.value) || getVariantById(lastThemeVariantId);
    renderFallbackSelector(preselectedVariant ? preselectedVariant.id : '');
    applyVariant(preselectedVariant, 'fallback');
  }

  function handleThemeVariantChange(candidate) {
    var variant = candidate && typeof candidate.id !== 'undefined'
      ? getVariantById(candidate.id) || candidate
      : getThemeVariantFromInputs();

    if (!variant) return;

    fallbackRequired = shouldUseFallbackSelector();
    setFallbackVisibility(fallbackRequired);

    if (fallbackRequired) return;

    applyVariant(variant, 'theme');
  }

  themeVariantEvents.forEach(function (eventName) {
    document.addEventListener(eventName, function (event) {
      var detail = event.detail || {};
      handleThemeVariantChange(detail.variant || detail.selectedVariant || detail);
    });
  });

  document.addEventListener('change', function (event) {
    var target = event.target;

    if (target === fallbackSelect) {
      var selectedFallbackVariant = getVariantById(target.value);
      applyVariant(selectedFallbackVariant, 'fallback');
      syncThemeInputs(selectedFallbackVariant);
      return;
    }

    if (
      target.matches('form[action*="/cart/add"] input[name="id"], form[data-type="add-to-cart-form"] input[name="id"]') ||
      target.matches('variant-selects select, variant-radios fieldset input, input[name^="options["], select[name^="options["]')
    ) {
      handleThemeVariantChange(getThemeVariantFromInputs());
    }
  });

  window.addEventListener('popstate', function () {
    ensureResolvedVariant();
  });

  var observer = new MutationObserver(function () {
    var nextFallbackRequired = shouldUseFallbackSelector();

    if (nextFallbackRequired !== fallbackRequired) {
      ensureResolvedVariant();
      return;
    }

    if (!nextFallbackRequired) {
      var themeVariant = getThemeVariantFromInputs();
      if (themeVariant && (!currentVariant || String(themeVariant.id) !== String(currentVariant.id))) {
        applyVariant(themeVariant, 'theme');
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['value', 'checked', 'selected', 'disabled', 'class', 'style', 'hidden']
  });

  ensureResolvedVariant();

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (!backendUrl) {
      showMessage('Error de configuración: falta la URL del backend.', 'error');
      return;
    }

    if (!variantIdInput.value) {
      showMessage('Selecciona una talla concreta para suscribirte.', 'error');
      if (fallbackRequired) fallbackSelect.focus();
      return;
    }

    var email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      showMessage('Por favor, introduce un email válido.', 'error');
      emailInput.focus();
      return;
    }

    setLoading(true);

    var payload = {
      email: email,
      productId: String(container.dataset.productId || ''),
      productHandle: String(productHandleInput.value || container.dataset.productHandle || ''),
      variantId: String(variantIdInput.value || ''),
      inventoryItemId: String(inventoryItemIdInput.value || ''),
      productTitle: String(container.dataset.productTitle || productData.title || ''),
      variantTitle: String(variantTitleInput.value || ''),
      honeypot: String(document.getElementById('notify-me-honeypot') && document.getElementById('notify-me-honeypot').value || '')
    };

    try {
      var response = await fetch(backendUrl + '/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      var data = await response.json();

      if (response.ok && data.ok) {
        form.style.display = 'none';
        showMessage(data.message || 'Te avisaremos cuando esté disponible.', 'success');
        return;
      }

      showMessage(data.error || 'Ha ocurrido un error. Por favor, inténtalo de nuevo.', 'error');
      setLoading(false);
    } catch (_error) {
      showMessage('Error de conexión. Por favor, inténtalo de nuevo.', 'error');
      setLoading(false);
    }
  });
})();
