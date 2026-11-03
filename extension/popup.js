/**
 * ApplyPilot AI — Popup Script
 * Orchestrates extraction, API transmission to ApplyPilot web service, and triggering autofill.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const originInput = document.getElementById('webOriginInput');
  const appIdInput = document.getElementById('appIdInput');
  const extractBtn = document.getElementById('extractBtn');
  const autofillBtn = document.getElementById('autofillBtn');
  const statusBox = document.getElementById('statusBox');

  // Load saved settings from Chrome storage
  chrome.storage.local.get(['webOrigin', 'activeAppId'], (res) => {
    if (res.webOrigin) originInput.value = res.webOrigin;
    if (res.activeAppId) appIdInput.value = res.activeAppId;
    if (res.activeAppId) {
      checkExistingAutofill(res.webOrigin || originInput.value, res.activeAppId);
    }
  });

  function setStatus(msg, isError = false) {
    statusBox.style.display = 'block';
    statusBox.className = isError ? 'status error' : 'status';
    statusBox.innerText = msg;
  }

  async function checkExistingAutofill(origin, appId) {
    try {
      const res = await fetch(`${origin}/api/applications/autofill?applicationId=${encodeURIComponent(appId)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.ok && json.data && json.data.fields && json.data.fields.length > 0) {
        autofillBtn.style.display = 'flex';
        setStatus(`Found ${json.data.fields.length} prepared fields ready to autofill.`);
      }
    } catch {}
  }

  // 1. EXTRACT ACTION
  extractBtn.addEventListener('click', async () => {
    const origin = originInput.value.trim().replace(/\/+$/, '');
    const appId = appIdInput.value.trim();

    if (!appId) {
      setStatus('Please enter your Application ID from ApplyPilot.', true);
      return;
    }

    chrome.storage.local.set({ webOrigin: origin, activeAppId: appId });

    extractBtn.disabled = true;
    setStatus('Scanning page for job application form fields…');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('Could not access active tab.', true);
      extractBtn.disabled = false;
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_FIELDS' }, async (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        setStatus('Failed to communicate with page. Make sure you are on a job application page and refresh.', true);
        extractBtn.disabled = false;
        return;
      }

      const extractedFields = response.fields || [];
      if (extractedFields.length === 0) {
        setStatus('No standard application form fields detected on this page.', true);
        extractBtn.disabled = false;
        return;
      }

      setStatus(`Found ${extractedFields.length} fields. Sending to ApplyPilot Gemini pipeline…`);

      // Post to ApplyPilot API
      try {
        const apiRes = await fetch(`${origin}/api/applications/autofill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'process_fields',
            applicationId: appId,
            url: response.url || tab.url,
            fields: extractedFields,
          }),
        });

        const json = await apiRes.json();
        if (!json.ok) {
          throw new Error(json.error || 'Server error processing fields');
        }

        setStatus(`Success! Mapped & answered ${json.data.fields.length} fields. Return to ApplyPilot to review, or click Autofill below.`);
        autofillBtn.style.display = 'flex';
      } catch (err) {
        setStatus(`API Error: ${err.message}. Ensure you are logged into ApplyPilot in this browser.`, true);
      } finally {
        extractBtn.disabled = false;
      }
    });
  });

  // 2. AUTOFILL ACTION
  autofillBtn.addEventListener('click', async () => {
    const origin = originInput.value.trim().replace(/\/+$/, '');
    const appId = appIdInput.value.trim();

    autofillBtn.disabled = true;
    setStatus('Retrieving approved answers from ApplyPilot…');

    try {
      const apiRes = await fetch(`${origin}/api/applications/autofill?applicationId=${encodeURIComponent(appId)}`, {
        credentials: 'include',
      });
      const json = await apiRes.json();
      if (!json.ok || !json.data || !json.data.fields) {
        throw new Error(json.error || 'No approved answers found');
      }

      const fieldsToFill = json.data.fields;
      setStatus(`Filling ${fieldsToFill.length} fields on page…`);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL_FIELDS', mappings: fieldsToFill }, async (fillRes) => {
        if (!fillRes || !fillRes.ok) {
          setStatus('Autofill failed to apply to current tab.', true);
          autofillBtn.disabled = false;
          return;
        }

        const { filledCount, skippedCount } = fillRes.result;
        setStatus(`Done! Filled ${filledCount} fields (${skippedCount} skipped/preserved). Final submission requires your manual click!`);

        // Record autofill status back in ApplyPilot
        await fetch(`${origin}/api/applications/autofill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'save_autofill',
            applicationId: appId,
            fields: fieldsToFill,
            autofillStatus: 'completed',
          }),
        }).catch(() => {});

        autofillBtn.disabled = false;
      });
    } catch (err) {
      setStatus(`Autofill error: ${err.message}`, true);
      autofillBtn.disabled = false;
    }
  });
});

