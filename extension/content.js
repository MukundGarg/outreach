/**
 * ApplyPilot AI — Content Script
 * Extracts form field metadata from job application pages (Greenhouse, Lever, standard forms).
 * Safely fills reviewed inputs without touching passwords or clicking submit buttons.
 */

// Global guard to prevent duplicate listeners if re-injected
if (!window.__APPLYPILOT_CONTENT_INITIALIZED__) {
  window.__APPLYPILOT_CONTENT_INITIALIZED__ = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_FIELDS') {
      try {
        const fields = extractApplicationFormFields();
        sendResponse({ ok: true, fields, url: window.location.href });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || 'Extraction failed' });
      }
      return true;
    }

    if (request.action === 'AUTOFILL_FIELDS') {
      try {
        const result = fillApprovedFields(request.mappings || []);
        sendResponse({ ok: true, result });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || 'Autofill execution failed' });
      }
      return true;
    }
  });
}

/**
 * Traverses forms on the active page and gathers accessible labels & input metadata.
 */
function extractApplicationFormFields() {
  const fields = [];
  const processedElements = new Set();
  const processedRadioGroups = new Set();

  // Query common input controls, excluding passwords, hidden, submits, buttons
  const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="password"]):not([type="button"]):not([type="reset"]):not([type="file"]), textarea, select';
  const elements = document.querySelectorAll(selector);

  elements.forEach((el, index) => {
    if (processedElements.has(el)) return;

    const tagName = el.tagName.toLowerCase();
    const rawType = (el.getAttribute('type') || '').toLowerCase();
    const type = tagName === 'textarea' ? 'textarea' : tagName === 'select' ? 'select' : rawType || 'text';

    // 1. Grouped Radio Buttons
    if (type === 'radio') {
      const groupName = el.name;
      if (groupName) {
        if (processedRadioGroups.has(groupName)) {
          processedElements.add(el);
          return;
        }
        processedRadioGroups.add(groupName);

        // Gather all radio buttons in this group
        const groupElements = Array.from(
          document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`)
        );
        groupElements.forEach((r) => processedElements.add(r));

        const groupLabel = findGroupLabel(el, groupElements);
        const options = groupElements
          .map((r) => {
            const optLabel = findLabelForElement(r);
            return optLabel || r.value;
          })
          .filter(Boolean);

        const checkedRadio = groupElements.find((r) => r.checked);
        const currentValue = checkedRadio ? (findLabelForElement(checkedRadio) || checkedRadio.value) : '';

        fields.push({
          fieldId: groupName,
          fieldLabel: groupLabel || groupName,
          fieldType: 'radio',
          options: options.length > 0 ? options : undefined,
          required: groupElements.some((r) => r.required || r.getAttribute('aria-required') === 'true'),
          currentValue: currentValue || undefined,
        });
        return;
      }
    }

    processedElements.add(el);

    // 2. Standard single controls (text, textarea, select, email, tel, checkbox)
    const label = findLabelForElement(el);
    if (!label) return; // Skip completely unlabeled obscure widgets

    const fieldId = el.id || el.name || `field_${index}_${type}`;
    const required = el.required || el.getAttribute('aria-required') === 'true' || label.includes('*');
    const placeholder = el.getAttribute('placeholder') || '';

    let options = [];
    if (type === 'select') {
      options = Array.from(el.querySelectorAll('option'))
        .map((opt) => opt.text.trim())
        .filter((txt) => txt && !txt.toLowerCase().includes('select an option') && !txt.toLowerCase().includes('please select'));
    }

    const fieldType = ['text', 'textarea', 'email', 'tel', 'select', 'checkbox'].includes(type) ? type : 'text';

    fields.push({
      fieldId,
      fieldLabel: label.replace(/\s*\*$/, '').trim(),
      fieldType,
      options: options.length > 0 ? options : undefined,
      required,
      placeholder,
      currentValue: type === 'checkbox' ? (el.checked ? 'true' : '') : (el.value ? el.value.trim() : undefined),
    });
  });

  return fields;
}

/**
 * Resolves accessible text label for a group of radio buttons.
 */
function findGroupLabel(firstEl) {
  // Check fieldset legend
  const fieldset = firstEl.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend && legend.innerText.trim()) return legend.innerText.trim();
  }

  // Check closest wrapper heading or label
  const container = firstEl.closest('.field, .form-group, .application-question, [role="radiogroup"]');
  if (container) {
    const ariaLabel = container.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const heading = container.querySelector('label, h3, h4, .text, .legend');
    if (heading && heading.innerText.trim()) return heading.innerText.trim();
  }

  return findLabelForElement(firstEl);
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
 * Only fields with status === 'reviewed' are filled.
 * Never touches passwords, never submits forms.
 */
function fillApprovedFields(mappings) {
  let filledCount = 0;
  let skippedCount = 0;
  const details = [];

  for (const mapping of mappings) {
    // ENFORCE HUMAN REVIEW: Skip anything not explicitly reviewed
    if (mapping.status !== 'reviewed') {
      skippedCount++;
      details.push({ fieldLabel: mapping.fieldLabel, status: 'requires_manual_input', reason: 'Unreviewed' });
      continue;
    }

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

    // Handle Radio Groups
    if (mapping.fieldType === 'radio' || (el && el.type === 'radio')) {
      const groupName = mapping.fieldId || (el && el.name);
      const radioElements = groupName
        ? Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`))
        : (el ? [el] : []);

      if (radioElements.length === 0) {
        skippedCount++;
        details.push({ fieldLabel: mapping.fieldLabel, status: 'not_found' });
        continue;
      }

      // Check if user already made a selection
      const alreadyChecked = radioElements.find((r) => r.checked);
      if (alreadyChecked) {
        skippedCount++;
        details.push({ fieldLabel: mapping.fieldLabel, status: 'preserved_existing' });
        continue;
      }

      const valLower = mapping.proposedValue.trim().toLowerCase();
      const targetRadio = radioElements.find((r) => {
        const rVal = (r.value || '').trim().toLowerCase();
        const rLbl = (findLabelForElement(r) || '').trim().toLowerCase();
        return rVal === valLower || rLbl === valLower || rLbl.includes(valLower);
      });

      if (targetRadio) {
        targetRadio.checked = true;
        dispatchChangeEvents(targetRadio);
        targetRadio.style.outline = '2px solid #27694e';
        filledCount++;
        details.push({ fieldLabel: mapping.fieldLabel, status: 'filled' });
      } else {
        skippedCount++;
        details.push({ fieldLabel: mapping.fieldLabel, status: 'option_not_matched' });
      }
      continue;
    }

    if (!el) {
      skippedCount++;
      details.push({ fieldLabel: mapping.fieldLabel, status: 'not_found' });
      continue;
    }

    // Preservation Check:
    // For checkboxes, only skip if already checked
    if (el.type === 'checkbox') {
      if (el.checked) {
        skippedCount++;
        details.push({ fieldLabel: mapping.fieldLabel, status: 'preserved_existing' });
        continue;
      }
      const valLower = mapping.proposedValue.trim().toLowerCase();
      el.checked = valLower === 'true' || valLower === 'yes' || valLower === '1';
      dispatchChangeEvents(el);
      el.style.outline = '2px solid #27694e';
      filledCount++;
      details.push({ fieldLabel: mapping.fieldLabel, status: 'filled' });
      continue;
    }

    // For Select dropdowns
    if (el.tagName.toLowerCase() === 'select') {
      const options = Array.from(el.querySelectorAll('option'));
      const valLower = mapping.proposedValue.trim().toLowerCase();
      const match = options.find((opt) => opt.text.trim().toLowerCase() === valLower || opt.value.trim().toLowerCase() === valLower);
      if (match) {
        if (el.value && el.value !== match.value && el.value !== '') {
          // If select has non-default value already selected
          skippedCount++;
          details.push({ fieldLabel: mapping.fieldLabel, status: 'preserved_existing' });
          continue;
        }
        el.value = match.value;
        dispatchChangeEvents(el);
        el.style.outline = '2px solid #27694e';
        filledCount++;
        details.push({ fieldLabel: mapping.fieldLabel, status: 'filled' });
      } else {
        skippedCount++;
        details.push({ fieldLabel: mapping.fieldLabel, status: 'option_not_matched' });
      }
      continue;
    }

    // For Text / Textarea / Email / Tel
    if (el.value && el.value.trim().length > 0) {
      // Preserve existing manual input
      skippedCount++;
      details.push({ fieldLabel: mapping.fieldLabel, status: 'preserved_existing' });
      continue;
    }

    // Populate React/Framework controlled input properly
    setNativeValue(el, mapping.proposedValue);
    dispatchChangeEvents(el);
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

/**
 * Ensures value change triggers React 16+ setter prototypes.
 */
function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
}

/**
 * Dispatches standard input, change, and blur events with bubbling.
 */
function dispatchChangeEvents(element) {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}
