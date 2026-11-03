/**
 * ApplyPilot AI — Content Script
 * Extracts form field metadata from job application pages (Greenhouse, Lever, standard forms).
 * Safely fills reviewed inputs without touching passwords or clicking submit buttons.
 */

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_FIELDS') {
    const fields = extractApplicationFormFields();
    sendResponse({ ok: true, fields, url: window.location.href });
    return true;
  }

  if (request.action === 'AUTOFILL_FIELDS') {
    const result = fillApprovedFields(request.mappings || []);
    sendResponse({ ok: true, result });
    return true;
  }
});

/**
 * Traverses forms on the active page and gathers accessible labels & input metadata.
 */
function extractApplicationFormFields() {
  const fields = [];
  const processedElements = new Set();

  // Query common input controls, excluding passwords, hidden, submits
  const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="password"]):not([type="button"]):not([type="reset"]), textarea, select';
  const elements = document.querySelectorAll(selector);

  elements.forEach((el, index) => {
    if (processedElements.has(el)) return;
    processedElements.add(el);

    const type = el.tagName.toLowerCase() === 'textarea'
      ? 'textarea'
      : el.tagName.toLowerCase() === 'select'
      ? 'select'
      : (el.getAttribute('type') || 'text').toLowerCase();

    // Find best accessible label
    const label = findLabelForElement(el);
    if (!label) return; // Skip unlabeled or obscure widgets

    const fieldId = el.id || el.name || `field_${index}_${type}`;
    const required = el.required || el.getAttribute('aria-required') === 'true' || label.includes('*');
    const placeholder = el.getAttribute('placeholder') || '';

    let options = [];
    if (type === 'select') {
      options = Array.from(el.querySelectorAll('option'))
        .map((opt) => opt.text.trim())
        .filter(Boolean);
    }

    fields.push({
      fieldId,
      fieldLabel: label.replace(/\s*\*$/, '').trim(),
      fieldType: ['text', 'textarea', 'email', 'tel', 'select', 'radio', 'checkbox'].includes(type) ? type : 'text',
      options: options.length > 0 ? options : undefined,
      required,
      placeholder,
    });
  });

  return fields;
}

/**
 * Resolves accessible text label for an input element.
 */
function findLabelForElement(el) {
  // 1. Explicit label[for="id"]
  if (el.id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (labelEl && labelEl.innerText.trim()) {
      return labelEl.innerText.trim();
    }
  }

  // 2. Parent label element
  const parentLabel = el.closest('label');
  if (parentLabel && parentLabel.innerText.trim()) {
    return parentLabel.innerText.trim();
  }

  // 3. aria-label or aria-labelledby
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  const ariaLabelledby = el.getAttribute('aria-labelledby');
  if (ariaLabelledby) {
    const ref = document.getElementById(ariaLabelledby);
    if (ref && ref.innerText.trim()) return ref.innerText.trim();
  }

  // 4. Surrounding Greenhouse / Lever wrappers
  const greenhouseField = el.closest('.field');
  if (greenhouseField) {
    const lbl = greenhouseField.querySelector('label');
    if (lbl && lbl.innerText.trim()) return lbl.innerText.trim();
  }

  const leverField = el.closest('.application-question');
  if (leverField) {
    const lbl = leverField.querySelector('.text');
    if (lbl && lbl.innerText.trim()) return lbl.innerText.trim();
  }

  // 5. Fallback: placeholder or name attribute
  return el.getAttribute('placeholder') || el.name || '';
}

/**
 * Safely fills matching form elements with approved values and fires input events.
 */
function fillApprovedFields(mappings) {
  let filledCount = 0;
  let skippedCount = 0;
  const details = [];

  for (const mapping of mappings) {
    if (!mapping.proposedValue || mapping.proposedValue.trim() === '') {
      skippedCount++;
      details.push({ fieldLabel: mapping.fieldLabel, status: 'skipped_empty' });
      continue;
    }

    // Try finding element by ID, Name, or Label Match
    let el = null;
    if (mapping.fieldId) {
      el = document.getElementById(mapping.fieldId) || document.querySelector(`[name="${CSS.escape(mapping.fieldId)}"]`);
    }

    if (!el) {
      // Find element matching the label
      const allLabels = Array.from(document.querySelectorAll('label'));
      const matchingLabel = allLabels.find((lbl) => lbl.innerText.trim().toLowerCase().includes(mapping.fieldLabel.toLowerCase()));
      if (matchingLabel) {
        if (matchingLabel.htmlFor) {
          el = document.getElementById(matchingLabel.htmlFor);
        } else {
          el = matchingLabel.querySelector('input, textarea, select');
        }
      }
    }

    if (!el) {
      skippedCount++;
      details.push({ fieldLabel: mapping.fieldLabel, status: 'not_found' });
      continue;
    }

    // Never overwrite an existing user entry without confirmation
    if (el.value && el.value.trim().length > 0 && el.value !== mapping.proposedValue) {
      // Keep existing manual answer intact
      skippedCount++;
      details.push({ fieldLabel: mapping.fieldLabel, status: 'preserved_existing' });
      continue;
    }

    // Fill element
    if (el.tagName.toLowerCase() === 'select') {
      const options = Array.from(el.querySelectorAll('option'));
      const match = options.find((opt) => opt.text.trim().toLowerCase() === mapping.proposedValue.toLowerCase());
      if (match) {
        el.value = match.value;
      }
    } else if (el.type === 'checkbox') {
      el.checked = mapping.proposedValue.toLowerCase() === 'true' || mapping.proposedValue.toLowerCase() === 'yes';
    } else {
      el.value = mapping.proposedValue;
    }

    // Dispatch input and change events so framework listeners (React/Angular/Vue) register values
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    // Highlight subtly in green to show filled
    el.style.outline = '2px solid #27694e';
    filledCount++;
    details.push({ fieldLabel: mapping.fieldLabel, status: 'filled' });
  }

  return {
    filledCount,
    skippedCount,
    details,
  };
}

